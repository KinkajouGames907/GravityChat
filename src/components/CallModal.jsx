import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X, Minimize2, Maximize2 } from 'lucide-react';
import SimplePeer from 'simple-peer';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';

export default function CallModal({ callId, currentUser, isCaller, onClose }) {
    const [callStatus, setCallStatus] = useState('initializing'); // initializing, calling, connected, ended
    const [stream, setStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [remoteUser, setRemoteUser] = useState(null);

    const myVideo = useRef();
    const userVideo = useRef();
    const connectionRef = useRef();
    const callDocRef = useRef(doc(db, "calls", callId));

    useEffect(() => {
        // Get user media
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((currentStream) => {
                setStream(currentStream);
                if (myVideo.current) {
                    myVideo.current.srcObject = currentStream;
                }

                // Initialize Peer
                const peer = new SimplePeer({
                    initiator: isCaller,
                    trickle: false,
                    stream: currentStream
                });

                // Handle Signals
                peer.on('signal', (data) => {
                    if (isCaller) {
                        updateDoc(callDocRef.current, { offer: JSON.stringify(data) });
                    } else {
                        updateDoc(callDocRef.current, { answer: JSON.stringify(data) });
                    }
                });

                peer.on('stream', (currentRemoteStream) => {
                    setRemoteStream(currentRemoteStream);
                    if (userVideo.current) {
                        userVideo.current.srcObject = currentRemoteStream;
                    }
                });

                peer.on('close', () => {
                    endCall();
                });

                peer.on('error', (err) => {
                    console.error("Peer error:", err);
                    endCall();
                });

                connectionRef.current = peer;

                // Listen to Firestore for signaling
                const unsubscribe = onSnapshot(callDocRef.current, (snapshot) => {
                    const data = snapshot.data();
                    if (!data) {
                        // Call ended remotely
                        endCall();
                        return;
                    }

                    if (isCaller) {
                        setRemoteUser(data.receiver);
                        if (data.answer && !peer.connected) {
                            peer.signal(JSON.parse(data.answer));
                            setCallStatus('connected');
                        }
                    } else {
                        setRemoteUser(data.caller);
                        if (data.offer && !peer.connected && callStatus === 'initializing') {
                            peer.signal(JSON.parse(data.offer));
                            setCallStatus('connected');
                        }
                    }

                    if (data.status === 'ended') {
                        endCall();
                    }
                });

                return () => {
                    unsubscribe();
                };
            })
            .catch((err) => {
                console.error("Error accessing media devices:", err);
                alert("Could not access camera/microphone.");
                onClose();
            });

        return () => {
            // Cleanup
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (connectionRef.current) {
                connectionRef.current.destroy();
            }
        };
    }, []);

    const toggleMute = () => {
        if (stream) {
            stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks()[0].enabled = !stream.getVideoTracks()[0].enabled;
            setIsVideoOff(!isVideoOff);
        }
    };

    const endCall = async () => {
        setCallStatus('ended');
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (connectionRef.current) {
            connectionRef.current.destroy();
        }

        try {
            await updateDoc(callDocRef.current, { status: 'ended' });
            // Optional: delete doc after delay
        } catch (e) {
            // Document might already be deleted
        }

        setTimeout(() => {
            onClose();
        }, 1000);
    };

    if (isMinimized) {
        return createPortal(
            <motion.div
                drag
                dragConstraints={{ left: 0, right: window.innerWidth - 200, top: 0, bottom: window.innerHeight - 150 }}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    width: '200px',
                    height: '150px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    zIndex: 2000,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    border: '1px solid var(--glass-border)'
                }}
            >
                {remoteStream ? (
                    <video playsInline ref={userVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            backgroundImage: `url(${remoteUser?.photoURL})`, backgroundSize: 'cover',
                            marginBottom: '8px'
                        }} />
                        <span style={{ fontSize: '12px' }}>{callStatus === 'connected' ? 'Connected' : 'Calling...'}</span>
                    </div>
                )}
                <button
                    onClick={() => setIsMinimized(false)}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', padding: '4px' }}
                >
                    <Maximize2 size={14} />
                </button>
            </motion.div>,
            document.body
        );
    }

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '1000px',
                height: '80vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#1a1a1a',
                borderRadius: '16px',
                overflow: 'hidden'
            }}>
                {/* Remote Video */}
                {remoteStream ? (
                    <video playsInline ref={userVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            backgroundImage: `url(${remoteUser?.photoURL})`,
                            backgroundSize: 'cover',
                            backgroundColor: 'var(--bg-tertiary)',
                            boxShadow: '0 0 40px var(--accent-glow)'
                        }} />
                        <h2 style={{ fontSize: '24px', fontWeight: 700 }}>
                            {callStatus === 'initializing' ? 'Calling...' : 'Connecting...'}
                        </h2>
                        <p style={{ color: 'var(--text-muted)' }}>{remoteUser?.displayName}</p>
                    </div>
                )}

                {/* Local Video (PIP) */}
                <motion.div
                    drag
                    dragConstraints={{ left: 0, right: 800, top: 0, bottom: 600 }}
                    style={{
                        position: 'absolute',
                        bottom: '20px',
                        right: '20px',
                        width: '200px',
                        height: '150px',
                        backgroundColor: '#000',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '2px solid var(--glass-border)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}
                >
                    <video playsInline muted ref={myVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </motion.div>

                {/* Controls */}
                <div style={{
                    position: 'absolute',
                    bottom: '30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '20px',
                    padding: '16px 32px',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '40px',
                    border: '1px solid var(--glass-border)'
                }}>
                    <button
                        onClick={toggleMute}
                        className="icon-btn"
                        style={{
                            backgroundColor: isMuted ? 'var(--error)' : 'var(--bg-tertiary)',
                            width: '50px', height: '50px', borderRadius: '50%'
                        }}
                    >
                        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>

                    <button
                        onClick={endCall}
                        className="icon-btn"
                        style={{
                            backgroundColor: 'var(--error)',
                            width: '60px', height: '60px', borderRadius: '50%'
                        }}
                    >
                        <PhoneOff size={28} />
                    </button>

                    <button
                        onClick={toggleVideo}
                        className="icon-btn"
                        style={{
                            backgroundColor: isVideoOff ? 'var(--error)' : 'var(--bg-tertiary)',
                            width: '50px', height: '50px', borderRadius: '50%'
                        }}
                    >
                        {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>
                </div>

                {/* Top Controls */}
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    display: 'flex',
                    gap: '10px'
                }}>
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="icon-btn"
                        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    >
                        <Minimize2 size={20} />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
