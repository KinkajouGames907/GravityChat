import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';
import { useAuth } from './AuthContext';

const PeerContext = createContext();

export function usePeer() {
    return useContext(PeerContext);
}

export function PeerProvider({ children }) {
    const [peer, setPeer] = useState(null);
    const [myPeerId, setMyPeerId] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null); // The actual MediaConnection object
    const [activeCall, setActiveCall] = useState(null); // The active call object (either incoming or outgoing)
    const { currentUser } = useAuth();
    const peerRef = useRef(null);

    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid) return;

        console.log('Initializing PeerJS for user:', uid);

        // Initialize Peer with user's UID as the Peer ID
        const newPeer = new Peer(uid, {
            debug: 2
        });

        newPeer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            setMyPeerId(id);
            setPeer(newPeer);
            peerRef.current = newPeer;
        });

        newPeer.on('call', (call) => {
            console.log('Incoming call from:', call.peer);
            setIncomingCall(call);
        });

        newPeer.on('error', (err) => {
            console.error('PeerJS error:', err);
            if (err.type === 'unavailable-id') {
                console.error(`Peer ID ${uid} is already taken. This might happen if you have multiple tabs open or just reloaded.`);
                // Optional: You could try to append a random suffix if you want to allow multiple tabs, 
                // but for a 1-on-1 calling app, you usually want one active session per user.
            }
        });

        return () => {
            console.log('Destroying PeerJS instance for user:', uid);
            newPeer.destroy();
        };
    }, [currentUser?.uid]);

    const callUser = (remotePeerId, stream) => {
        if (!peer) {
            console.error("Peer not initialized");
            return null;
        }
        const call = peer.call(remotePeerId, stream);
        setActiveCall(call);
        return call;
    };

    const answerCall = (stream) => {
        if (incomingCall) {
            incomingCall.answer(stream);
            setActiveCall(incomingCall);
            setIncomingCall(null);
            return incomingCall;
        }
    };

    const endCall = () => {
        if (activeCall) {
            activeCall.close();
        }
        setActiveCall(null);
        setIncomingCall(null);
    };

    const value = {
        peer,
        myPeerId,
        incomingCall,
        activeCall,
        setIncomingCall, // Exposed to allow closing the modal to clear the state
        setActiveCall,
        callUser,
        answerCall,
        endCall
    };

    return (
        <PeerContext.Provider value={value}>
            {children}
        </PeerContext.Provider>
    );
}
