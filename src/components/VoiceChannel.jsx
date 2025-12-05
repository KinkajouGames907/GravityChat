import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones, VolumeX, PhoneOff, Settings, Volume2, Users, X, Monitor, MonitorOff } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Peer from 'peerjs';

export default function VoiceChannel({ channelId, channelName, serverId, onLeave }) {
    const { currentUser } = useAuth();
    const [participants, setParticipants] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [peers, setPeers] = useState({});
    const [remoteStreams, setRemoteStreams] = useState({});
    const [isSpeaking, setIsSpeaking] = useState({});
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const peerRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const audioElementsRef = useRef({});

    // Join voice channel
    useEffect(() => {
        if (!channelId || !currentUser) return;

        const joinChannel = async () => {
            try {
                // Get user media
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                });
                setLocalStream(stream);

                // Create PeerJS instance with unique ID
                const peerId = `voice_${currentUser.uid}_${Date.now()}`;
                const peer = new Peer(peerId, {
                    debug: 1
                });

                peer.on('open', async (id) => {
                    console.log('Voice channel peer opened:', id);
                    setConnectionStatus('connected');

                    // Add self to voice channel participants
                    const voiceRef = doc(db, "voiceChannels", channelId);
                    await setDoc(voiceRef, {
                        participants: arrayUnion({
                            odId: currentUser.uid,
                            peerId: id,
                            displayName: currentUser.displayName,
                            photoURL: currentUser.photoURL,
                            joinedAt: new Date().toISOString(),
                            isMuted: false,
                            isDeafened: false
                        })
                    }, { merge: true });
                });

                peer.on('call', (call) => {
                    console.log('Incoming call from:', call.peer);
                    call.answer(stream);

                    call.on('stream', (remoteStream) => {
                        setRemoteStreams(prev => ({
                            ...prev,
                            [call.peer]: remoteStream
                        }));
                    });

                    call.on('close', () => {
                        setRemoteStreams(prev => {
                            const updated = { ...prev };
                            delete updated[call.peer];
                            return updated;
                        });
                    });
                });

                peer.on('error', (err) => {
                    console.error('Peer error:', err);
                    setConnectionStatus('error');
                });

                peerRef.current = peer;

                // Setup audio analysis for speaking detection
                setupAudioAnalysis(stream);

            } catch (error) {
                console.error('Error joining voice channel:', error);
                setConnectionStatus('error');
            }
        };

        joinChannel();

        return () => {
            leaveChannel();
        };
    }, [channelId, currentUser]);

    // Listen for participants changes and connect to new peers
    useEffect(() => {
        if (!channelId) return;

        const voiceRef = doc(db, "voiceChannels", channelId);
        const unsubscribe = onSnapshot(voiceRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                const participantsList = data.participants || [];
                setParticipants(participantsList);

                // Connect to new participants
                if (peerRef.current && localStream) {
                    participantsList.forEach(participant => {
                        if (participant.odId !== currentUser.uid && !peers[participant.peerId]) {
                            connectToPeer(participant.peerId);
                        }
                    });
                }
            }
        });

        return unsubscribe;
    }, [channelId, localStream, currentUser, peers]);

    // Play remote audio streams
    useEffect(() => {
        Object.entries(remoteStreams).forEach(([peerId, stream]) => {
            if (!audioElementsRef.current[peerId]) {
                const audio = new Audio();
                audio.srcObject = stream;
                audio.autoplay = true;
                audio.muted = isDeafened;
                audioElementsRef.current[peerId] = audio;
            }
        });

        // Cleanup removed streams
        Object.keys(audioElementsRef.current).forEach(peerId => {
            if (!remoteStreams[peerId]) {
                audioElementsRef.current[peerId].pause();
                audioElementsRef.current[peerId].srcObject = null;
                delete audioElementsRef.current[peerId];
            }
        });
    }, [remoteStreams, isDeafened]);

    const setupAudioAnalysis = (stream) => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);

            analyser.fftSize = 256;
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            // Check speaking status periodically
            const checkSpeaking = () => {
                if (!analyserRef.current) return;

                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);

                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const speaking = average > 30; // Threshold for speaking detection

                setIsSpeaking(prev => ({
                    ...prev,
                    [currentUser.uid]: speaking
                }));

                requestAnimationFrame(checkSpeaking);
            };

            checkSpeaking();
        } catch (error) {
            console.error('Error setting up audio analysis:', error);
        }
    };

    const connectToPeer = (peerId) => {
        if (!peerRef.current || !localStream || peers[peerId]) return;

        console.log('Connecting to peer:', peerId);
        const call = peerRef.current.call(peerId, localStream);

        call.on('stream', (remoteStream) => {
            setRemoteStreams(prev => ({
                ...prev,
                [peerId]: remoteStream
            }));
        });

        call.on('close', () => {
            setRemoteStreams(prev => {
                const updated = { ...prev };
                delete updated[peerId];
                return updated;
            });
            setPeers(prev => {
                const updated = { ...prev };
                delete updated[peerId];
                return updated;
            });
        });

        setPeers(prev => ({
            ...prev,
            [peerId]: call
        }));
    };

    const leaveChannel = async () => {
        // Stop local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }

        // Close peer connections
        Object.values(peers).forEach(call => call.close());

        // Close peer instance
        if (peerRef.current) {
            peerRef.current.destroy();
        }

        // Close audio context
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }

        // Stop all audio elements
        Object.values(audioElementsRef.current).forEach(audio => {
            audio.pause();
            audio.srcObject = null;
        });

        // Remove from Firestore
        if (currentUser && channelId) {
            try {
                const voiceRef = doc(db, "voiceChannels", channelId);
                const voiceDoc = await getDoc(voiceRef);
                if (voiceDoc.exists()) {
                    const participants = voiceDoc.data().participants || [];
                    const myParticipant = participants.find(p => p.odId === currentUser.uid);
                    if (myParticipant) {
                        await updateDoc(voiceRef, {
                            participants: arrayRemove(myParticipant)
                        });
                    }
                }
            } catch (error) {
                console.error('Error leaving voice channel:', error);
            }
        }

        if (onLeave) onLeave();
    };

    const toggleMute = async () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);

                // Update Firestore
                try {
                    const voiceRef = doc(db, "voiceChannels", channelId);
                    const voiceDoc = await getDoc(voiceRef);
                    if (voiceDoc.exists()) {
                        const participants = voiceDoc.data().participants || [];
                        const updatedParticipants = participants.map(p =>
                            p.odId === currentUser.uid ? { ...p, isMuted: !audioTrack.enabled } : p
                        );
                        await updateDoc(voiceRef, { participants: updatedParticipants });
                    }
                } catch (error) {
                    console.error('Error updating mute status:', error);
                }
            }
        }
    };

    const toggleDeafen = () => {
        setIsDeafened(!isDeafened);

        // Mute/unmute all audio elements
        Object.values(audioElementsRef.current).forEach(audio => {
            audio.muted = !isDeafened;
        });

        // Also mute self when deafened
        if (!isDeafened && localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = false;
                setIsMuted(true);
            }
        }
    };

    return createPortal(
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            style={{
                position: 'fixed',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '16px',
                padding: '16px',
                minWidth: '300px',
                maxWidth: '400px',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                zIndex: 1000
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Volume2 size={18} color="var(--success)" />
                    <span style={{ fontWeight: 600 }}>{channelName}</span>
                    <span style={{
                        fontSize: '12px',
                        color: connectionStatus === 'connected' ? 'var(--success)' : 'var(--warning)',
                        backgroundColor: connectionStatus === 'connected' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '10px'
                    }}>
                        {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Error'}
                    </span>
                </div>
                <button onClick={leaveChannel} className="icon-btn" style={{ color: 'var(--danger)' }}>
                    <X size={18} />
                </button>
            </div>

            {/* Participants */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '16px'
            }}>
                {participants.map((participant) => (
                    <motion.div
                        key={participant.odId}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <div style={{
                            position: 'relative',
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            border: isSpeaking[participant.odId]
                                ? '3px solid var(--success)'
                                : '3px solid transparent',
                            transition: 'border-color 0.1s ease'
                        }}>
                            <img
                                src={participant.photoURL || '/default-avatar.png'}
                                alt={participant.displayName}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    objectFit: 'cover'
                                }}
                            />
                            {participant.isMuted && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-2px',
                                    right: '-2px',
                                    backgroundColor: 'var(--danger)',
                                    borderRadius: '50%',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <MicOff size={10} color="white" />
                                </div>
                            )}
                        </div>
                        <span style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            maxWidth: '60px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textAlign: 'center'
                        }}>
                            {participant.displayName}
                        </span>
                    </motion.div>
                ))}
            </div>

            {/* Controls */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--glass-border)'
            }}>
                <button
                    onClick={toggleMute}
                    className="icon-btn"
                    style={{
                        backgroundColor: isMuted ? 'var(--danger)' : 'var(--bg-tertiary)',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%'
                    }}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                    onClick={toggleDeafen}
                    className="icon-btn"
                    style={{
                        backgroundColor: isDeafened ? 'var(--danger)' : 'var(--bg-tertiary)',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%'
                    }}
                    title={isDeafened ? 'Undeafen' : 'Deafen'}
                >
                    {isDeafened ? <VolumeX size={20} /> : <Headphones size={20} />}
                </button>

                <button
                    onClick={leaveChannel}
                    className="icon-btn"
                    style={{
                        backgroundColor: 'var(--danger)',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%'
                    }}
                    title="Leave Voice Channel"
                >
                    <PhoneOff size={20} />
                </button>

                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="icon-btn"
                    style={{
                        backgroundColor: showSettings ? 'var(--accent)' : 'var(--bg-tertiary)',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%'
                    }}
                    title="Settings"
                >
                    <Settings size={20} />
                </button>
            </div>

            {/* Participant Count */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '12px',
                color: 'var(--text-muted)',
                fontSize: '12px'
            }}>
                <Users size={14} />
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </div>
        </motion.div>,
        document.body
    );
}
