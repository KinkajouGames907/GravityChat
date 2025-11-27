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
        if (!currentUser) return;

        // Initialize Peer with user's UID as the Peer ID
        // This makes it easy to call someone if you know their UID
        const newPeer = new Peer(currentUser.uid, {
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
        });

        return () => {
            newPeer.destroy();
        };
    }, [currentUser]);

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
