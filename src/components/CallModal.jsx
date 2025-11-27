import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Minimize2, Maximize2, Settings, X, Check } from 'lucide-react';
import { usePeer } from '../context/PeerContext';

export default function CallModal({ call, currentUser, isCaller, onClose, remoteUserId }) {
    const [callStatus, setCallStatus] = useState('initializing'); // initializing, calling, incoming, connected, ended
    const [stream, setStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // Device Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedAudioInput, setSelectedAudioInput] = useState('');
    const [selectedVideoInput, setSelectedVideoInput] = useState('');
    const [selectedAudioOutput, setSelectedAudioOutput] = useState('');
    const [remoteVolume, setRemoteVolume] = useState(1); // Default 100%
    const [peerCall, setPeerCall] = useState(null); // Store the actual PeerJS MediaConnection

    const { callUser, answerCall, endCall: endPeerCall } = usePeer();
    const myVideo = useRef();
    const userVideo = useRef();

    // Web Audio API Refs
    const audioContextRef = useRef(null);
    const gainNodeRef = useRef(null);
    const audioOutputRef = useRef(null);

    useEffect(() => {
        if (myVideo.current && stream) {
            myVideo.current.srcObject = stream;
        }
    }, [stream, isMinimized]);

    // Handle Remote Stream & Audio Amplification
    useEffect(() => {
        if (!remoteStream) return;

        // 1. Set video source (visuals only)
        if (userVideo.current) {
            userVideo.current.srcObject = remoteStream;
            userVideo.current.muted = true; // Mute video element, we play audio via Web Audio API
        }

        // 2. Setup Web Audio API for amplification
        let audioCtx;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
            const gainNode = audioCtx.createGain();

            // Set initial volume
            gainNode.gain.value = remoteVolume;

            // Create source from remote stream
            const source = audioCtx.createMediaStreamSource(remoteStream);
            const destination = audioCtx.createMediaStreamDestination();

            // Connect graph: Source -> Gain -> Destination
            source.connect(gainNode);
            gainNode.connect(destination);

            // 3. Play processed audio through hidden audio element
            if (audioOutputRef.current) {
                audioOutputRef.current.srcObject = destination.stream;
                audioOutputRef.current.play().catch(e => console.error("Error playing processed audio:", e));

                // Apply sink ID if already selected
                if (selectedAudioOutput && typeof audioOutputRef.current.setSinkId === 'function') {
                    audioOutputRef.current.setSinkId(selectedAudioOutput).catch(err => console.error("Error setting sink ID:", err));
                }
            }

            // Store refs
            audioContextRef.current = audioCtx;
            gainNodeRef.current = gainNode;

        } catch (err) {
            console.error("Web Audio API setup failed:", err);
            // Fallback: Unmute video element if Web Audio fails
            if (userVideo.current) userVideo.current.muted = false;
        }

        // iOS AudioContext Resume Fix
        const resumeAudio = () => {
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('touchstart', resumeAudio);

        return () => {
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('touchstart', resumeAudio);
            if (audioCtx) {
                audioCtx.close();
            }
        };
    }, [remoteStream]); // Re-run if remote stream changes

    // Apply volume changes to GainNode
    useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = remoteVolume;
        }
    }, [remoteVolume]);

    // Fetch Devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devs = await navigator.mediaDevices.enumerateDevices();
                setDevices(devs);

                // Set defaults
                const audioIn = devs.find(d => d.kind === 'audioinput');
                const videoIn = devs.find(d => d.kind === 'videoinput');
                const audioOut = devs.find(d => d.kind === 'audiooutput');

                if (audioIn) setSelectedAudioInput(audioIn.deviceId);
                if (videoIn) setSelectedVideoInput(videoIn.deviceId);
                if (audioOut) setSelectedAudioOutput(audioOut.deviceId);
            } catch (error) {
                console.error("Error enumerating devices:", error);
            }
        };
        getDevices();

        // Listen for device changes
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    useEffect(() => {
        let currentCall = call;

        // Get user media with specific devices if selected, otherwise default
        const constraints = {
            video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
            audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then((currentStream) => {
                setStream(currentStream);

                if (isCaller) {
                    // Initiate call
                    setCallStatus('calling');
                    currentCall = callUser(remoteUserId, currentStream);
                    if (currentCall) {
                        setPeerCall(currentCall); // Save reference
                        currentCall.on('stream', (remoteStream) => {
                            setRemoteStream(remoteStream);
                            setCallStatus('connected');
                        });
                        currentCall.on('close', () => handleEndCall());
                        currentCall.on('error', (e) => {
                            console.error("Call error:", e);
                            handleEndCall();
                        });
                    } else {
                        alert("Failed to start call. Peer not ready.");
                        onClose();
                    }
                } else {
                    // Incoming call - wait for user action
                    setCallStatus('incoming');
                    // For incoming, 'call' prop IS the MediaConnection, but we don't set it to peerCall yet until answered?
                    // Actually we can set it, but we haven't answered yet.
                    setPeerCall(call);
                }
            })
            .catch((err) => {
                console.error("Error accessing media devices:", err);
                let errorMessage = "Could not access camera/microphone.";

                if (!window.isSecureContext) {
                    errorMessage = "iOS (iPhone/iPad) requires a secure HTTPS connection for calls. If testing locally, you must use localhost or setup HTTPS.";
                } else if (err.name === 'NotAllowedError') {
                    errorMessage = "Permission denied. Please allow camera/microphone access in your browser settings.";
                } else if (err.name === 'NotFoundError') {
                    errorMessage = "No camera or microphone found.";
                }

                alert(errorMessage);
                onClose();
            });

        return () => {
            // Cleanup
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []); // Run once on mount. Device switching is handled separately.

    const handleAcceptCall = () => {
        if (!call || !stream) return;

        setCallStatus('connected');
        call.answer(stream);
        setPeerCall(call); // Ensure we have the reference

        call.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
        });
        call.on('close', () => handleEndCall());
        call.on('error', (e) => {
            console.error("Call error:", e);
            handleEndCall();
        });
    };

    const switchMediaDevice = async (type, deviceId) => {
        if (!stream) return;

        const isVideo = type === 'videoinput';
        const constraints = {
            video: isVideo ? { deviceId: { exact: deviceId } } : false,
            audio: !isVideo ? { deviceId: { exact: deviceId } } : false
        };

        try {
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            const newTrack = isVideo ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];

            // Replace track in local stream
            const oldTrack = isVideo ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0];
            if (oldTrack) {
                stream.removeTrack(oldTrack);
                oldTrack.stop();
            }
            stream.addTrack(newTrack);

            // Force update video element
            if (myVideo.current) {
                myVideo.current.srcObject = stream;
            }

            // Replace track in Peer Connection
            if (peerCall && peerCall.peerConnection) {
                const senders = peerCall.peerConnection.getSenders();
                const sender = senders.find(s => s.track && s.track.kind === (isVideo ? 'video' : 'audio'));
                if (sender) {
                    sender.replaceTrack(newTrack);
                }
            }

            // Update state
            if (isVideo) {
                setSelectedVideoInput(deviceId);
                setIsVideoOff(false); // Reset mute state on switch
            } else {
                setSelectedAudioInput(deviceId);
                setIsMuted(false);
            }

            // We don't need to setStream(newStream) because we mutated the existing stream object by adding/removing tracks.
            // But React might not know to re-render if we need it to. 
            // Better to create a new MediaStream to trigger effects if needed, but srcObject updates usually handle it.
            // Let's force a re-render just in case.
            setStream(new MediaStream(stream.getTracks()));

        } catch (err) {
            console.error(`Error switching ${type}:`, err);
            alert(`Failed to switch ${isVideo ? 'camera' : 'microphone'}`);
        }
    };

    const handleAudioOutputChange = async (deviceId) => {
        setSelectedAudioOutput(deviceId);
        // Apply to the hidden audio element instead of video element
        if (audioOutputRef.current && typeof audioOutputRef.current.setSinkId === 'function') {
            try {
                await audioOutputRef.current.setSinkId(deviceId);
            } catch (err) {
                console.error("Error setting audio output:", err);
            }
        }
    };

    const toggleMute = () => {
        if (stream) {
            const track = stream.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setIsMuted(!track.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (stream) {
            const track = stream.getVideoTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setIsVideoOff(!track.enabled);
            }
        }
    };

    const handleEndCall = () => {
        setCallStatus('ended');
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        endPeerCall();
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
                            backgroundColor: 'var(--bg-tertiary)',
                            marginBottom: '8px'
                        }} />
                        <span style={{ fontSize: '12px' }}>{callStatus === 'connected' ? 'Connected' : (callStatus === 'incoming' ? 'Incoming Call...' : 'Calling...')}</span>
                    </div>
                )}
                <button
                    onClick={() => setIsMinimized(false)}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', padding: '4px' }}
                >
                    <Maximize2 size={14} />
                </button>
                {/* Hidden Audio Output for Amplification */}
                <audio ref={audioOutputRef} style={{ display: 'none' }} />
            </motion.div>,
            document.body
        );
    }

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
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
                            backgroundColor: 'var(--bg-tertiary)',
                            boxShadow: '0 0 40px var(--accent-glow)'
                        }} />
                        <h2 style={{ fontSize: '24px', fontWeight: 700 }}>
                            {callStatus === 'initializing' && 'Initializing...'}
                            {callStatus === 'calling' && 'Calling...'}
                            {callStatus === 'incoming' && 'Incoming Call...'}
                            {callStatus === 'connected' && 'Connecting...'}
                            {callStatus === 'ended' && 'Call Ended'}
                        </h2>
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

                {/* Hidden Audio Output for Amplification */}
                <audio ref={audioOutputRef} style={{ display: 'none' }} />

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
                    {callStatus === 'incoming' ? (
                        <>
                            <button
                                onClick={handleAcceptCall}
                                className="icon-btn"
                                style={{
                                    backgroundColor: 'var(--success)',
                                    width: '60px', height: '60px', borderRadius: '50%'
                                }}
                            >
                                <Phone size={28} />
                            </button>
                            <button
                                onClick={handleEndCall}
                                className="icon-btn"
                                style={{
                                    backgroundColor: 'var(--error)',
                                    width: '60px', height: '60px', borderRadius: '50%'
                                }}
                            >
                                <PhoneOff size={28} />
                            </button>
                        </>
                    ) : (
                        <>
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
                                onClick={handleEndCall}
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

                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="icon-btn"
                                style={{
                                    backgroundColor: showSettings ? 'var(--accent)' : 'var(--bg-tertiary)',
                                    width: '50px', height: '50px', borderRadius: '50%'
                                }}
                            >
                                <Settings size={24} />
                            </button>
                        </>
                    )}
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

                {/* Settings Modal */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            style={{
                                position: 'absolute',
                                bottom: '110px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '320px',
                                backgroundColor: 'var(--bg-secondary)',
                                borderRadius: '16px',
                                padding: '20px',
                                border: '1px solid var(--glass-border)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                zIndex: 2001
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Call Settings</h3>
                                <button onClick={() => setShowSettings(false)} className="icon-btn" style={{ width: '28px', height: '28px' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Remote Volume */}
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={14} /> REMOTE VOLUME</span>
                                        <span>{Math.round(remoteVolume * 100)}%</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        value={remoteVolume}
                                        onChange={(e) => setRemoteVolume(parseFloat(e.target.value))}
                                        style={{ width: '100%', accentColor: 'var(--accent)' }}
                                    />
                                </div>

                                {/* Camera */}
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        <Video size={14} /> CAMERA
                                    </label>
                                    <select
                                        value={selectedVideoInput}
                                        onChange={(e) => switchMediaDevice('videoinput', e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            border: '1px solid var(--glass-border)',
                                            color: 'white',
                                            fontSize: '13px'
                                        }}
                                    >
                                        {devices.filter(d => d.kind === 'videoinput').map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Microphone */}
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        <Mic size={14} /> MICROPHONE
                                    </label>
                                    <select
                                        value={selectedAudioInput}
                                        onChange={(e) => switchMediaDevice('audioinput', e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            border: '1px solid var(--glass-border)',
                                            color: 'white',
                                            fontSize: '13px'
                                        }}
                                    >
                                        {devices.filter(d => d.kind === 'audioinput').map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Speaker */}
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        <Phone size={14} /> SPEAKER
                                    </label>
                                    <select
                                        value={selectedAudioOutput}
                                        onChange={(e) => handleAudioOutputChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            border: '1px solid var(--glass-border)',
                                            color: 'white',
                                            fontSize: '13px'
                                        }}
                                        disabled={!('setSinkId' in HTMLMediaElement.prototype)}
                                    >
                                        {devices.filter(d => d.kind === 'audiooutput').map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Speaker ${device.deviceId.slice(0, 5)}...`}
                                            </option>
                                        ))}
                                        {!('setSinkId' in HTMLMediaElement.prototype) && (
                                            <option disabled>Browser not supported</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>,
        document.body
    );
}
