import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';
import { useAuth } from './AuthContext';
import silentAudio from '../assets/sounds/silent.mp3';

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

        if (import.meta.env.DEV) console.log('Initializing PeerJS for user:', uid);

        // Initialize Peer with user's UID as the Peer ID
        const newPeer = new Peer(uid, {
            debug: 2
        });

        newPeer.on('open', (id) => {
            if (import.meta.env.DEV) console.log('My peer ID is: ' + id);
            setMyPeerId(id);
            setPeer(newPeer);
            peerRef.current = newPeer;
        });

        newPeer.on('call', (call) => {
            if (import.meta.env.DEV) console.log('Incoming call from:', call.peer);
            setIncomingCall(call);
        });

        newPeer.on('error', (err) => {
            if (import.meta.env.DEV) console.error('PeerJS error:', err);
            if (err.type === 'unavailable-id') {
                if (import.meta.env.DEV) console.error(`Peer ID ${uid} is already taken. This might happen if you have multiple tabs open or just reloaded.`);
                // Optional: You could try to append a random suffix if you want to allow multiple tabs, 
                // but for a 1-on-1 calling app, you usually want one active session per user.
            }
        });

        return () => {
            if (import.meta.env.DEV) console.log('Destroying PeerJS instance for user:', uid);
            newPeer.destroy();
        };
    }, [currentUser?.uid]);

    // Keep-Alive Mechanism (Wake Lock + Silent Audio)
    useEffect(() => {
        if (!activeCall) return;

        let wakeLock = null;
        const audio = new Audio(silentAudio);
        audio.loop = true;
        audio.volume = 0.01; // Barely audible, just enough to keep the tab active

        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    if (import.meta.env.DEV) console.log('Wake Lock active');
                }
            } catch (err) {
                if (import.meta.env.DEV) console.error('Wake Lock failed:', err);
            }
        };

        // Start everything
        requestWakeLock();
        audio.play().catch(e => { if (import.meta.env.DEV) console.log("Silent audio play failed:", e); });

        // Cleanup
        return () => {
            if (wakeLock) {
                wakeLock.release().then(() => { if (import.meta.env.DEV) console.log('Wake Lock released'); });
            }
            audio.pause();
            audio.src = "";
        };
    }, [activeCall]);

    const callUser = (remotePeerId, stream) => {
        if (!peer) {
            if (import.meta.env.DEV) console.error("Peer not initialized");
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
