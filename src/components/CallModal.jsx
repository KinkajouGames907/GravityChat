import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Minimize2, Maximize2, Settings, X } from 'lucide-react';
import { usePeer } from '../context/PeerContext';
import { createFallbackMediaStream } from '../utils/mediaFallback';
import { appAlert } from '../utils/dialogService';

export default function CallModal({ call, currentUser, isCaller, onClose, remoteUserId }) {
    const [callStatus, setCallStatus] = useState('initializing'); // initializing, calling, incoming, connected, ended
    const [stream, setStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isMinimized, setIsMinimized] = useState(Boolean(isCaller));

    // Device Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedAudioInput, setSelectedAudioInput] = useState('');
    const [selectedVideoInput, setSelectedVideoInput] = useState('');
    const [selectedAudioOutput, setSelectedAudioOutput] = useState('');
    const [remoteVolume, setRemoteVolume] = useState(1); // Default 100%
    const [mediaWarning, setMediaWarning] = useState('');
    const [peerCall, setPeerCall] = useState(null); // Store the actual PeerJS MediaConnection

    const { callUser, answerCall, endCall: endPeerCall } = usePeer();
    const myVideo = useRef();
    const userVideo = useRef();
    const fallbackCleanupRef = useRef(null);

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
                audioOutputRef.current.play().catch(e => import.meta.env.DEV && console.error("Error playing processed audio:", e));

                // Apply sink ID if already selected
                if (selectedAudioOutput && typeof audioOutputRef.current.setSinkId === 'function') {
                    audioOutputRef.current.setSinkId(selectedAudioOutput).catch(err => import.meta.env.DEV && console.error("Error setting sink ID:", err));
                }
            }

            // Store refs
            audioContextRef.current = audioCtx;
            gainNodeRef.current = gainNode;

        } catch (err) {
            if (import.meta.env.DEV) import.meta.env.DEV && console.error("Web Audio API setup failed:", err);
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
            // Always clean up event listeners regardless of audioCtx setup success
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('touchstart', resumeAudio);
            if (audioCtx) {
                audioCtx.close().catch(() => {});
            }
            audioContextRef.current = null;
            gainNodeRef.current = null;
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
                import.meta.env.DEV && console.error("Error enumerating devices:", error);
            }
        };
        getDevices();

        // Listen for device changes
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    useEffect(() => {
        let currentCall = call;
        let currentStream = null;
        let cancelled = false;

        // Get user media with specific devices if selected, otherwise default
        const constraints = {
            video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
            audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then((newStream) => {
                if (cancelled) {
                    newStream.getTracks().forEach(track => track.stop());
                    return;
                }
                currentStream = newStream;
                setStream(newStream);

                if (isCaller) {
                    // Initiate call
                    setCallStatus('calling');
                    currentCall = callUser(remoteUserId, newStream);
                    if (currentCall) {
                        setPeerCall(currentCall); // Save reference
                        currentCall.on('stream', (remoteStream) => {
                            setRemoteStream(remoteStream);
                            setCallStatus('connected');
                        });
                        currentCall.on('close', () => handleEndCall());
                        currentCall.on('error', (e) => {
                            import.meta.env.DEV && console.error("Call error:", e);
                            handleEndCall();
                        });
                    } else {
                        void appAlert("Call failed, user not online.", { title: 'Call Failed', danger: true });
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
                import.meta.env.DEV && console.error("Error accessing media devices, using fallback:", err);
                const fallback = createFallbackMediaStream({ includeVideo: false });
                const fallbackStream = fallback.stream;

                if (!fallbackStream || fallbackStream.getTracks().length === 0) {
                    void appAlert("Could not initialize call media.", { title: 'Call Failed', danger: true });
                    onClose();
                    return;
                }

                fallbackCleanupRef.current = fallback.cleanup;
                currentStream = fallbackStream;
                setStream(fallbackStream);
                setIsMuted(true);
                setIsVideoOff(true);
                setMediaWarning('No camera/microphone detected. You joined in listen-only mode.');

                if (isCaller) {
                    setCallStatus('calling');
                    currentCall = callUser(remoteUserId, fallbackStream);
                    if (currentCall) {
                        setPeerCall(currentCall);
                        currentCall.on('stream', (incomingRemoteStream) => {
                            setRemoteStream(incomingRemoteStream);
                            setCallStatus('connected');
                        });
                        currentCall.on('close', () => handleEndCall());
                        currentCall.on('error', (e) => {
                            import.meta.env.DEV && console.error("Call error:", e);
                            handleEndCall();
                        });
                    } else {
                        void appAlert("Call failed, user not online.", { title: 'Call Failed', danger: true });
                        onClose();
                    }
                } else {
                    setCallStatus('incoming');
                    setPeerCall(call);
                }
            });

        return () => {
            cancelled = true;
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
            fallbackCleanupRef.current?.();
            fallbackCleanupRef.current = null;
        };
    }, []); // Run once on mount. Device switching is handled separately.

    const handleAcceptCall = () => {
        if (!call || !stream) return;

        setCallStatus('connected');
        // Use context function to answer, which clears incomingCall state
        const acceptedCall = answerCall(stream);

        if (acceptedCall) {
            setPeerCall(acceptedCall);

            acceptedCall.on('stream', (remoteStream) => {
                setRemoteStream(remoteStream);
            });
            acceptedCall.on('close', () => handleEndCall());
            acceptedCall.on('error', (e) => {
                import.meta.env.DEV && console.error("Call error:", e);
                handleEndCall();
            });
        }
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
            import.meta.env.DEV && console.error(`Error switching ${type}:`, err);
            await appAlert(`Failed to switch ${isVideo ? 'camera' : 'microphone'}.`, { title: 'Device Switch Failed', danger: true });
        }
    };

    const handleAudioOutputChange = async (deviceId) => {
        setSelectedAudioOutput(deviceId);
        // Apply to the hidden audio element instead of video element
        if (audioOutputRef.current && typeof audioOutputRef.current.setSinkId === 'function') {
            try {
                await audioOutputRef.current.setSinkId(deviceId);
            } catch (err) {
                import.meta.env.DEV && console.error("Error setting audio output:", err);
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
        fallbackCleanupRef.current?.();
        fallbackCleanupRef.current = null;
        endPeerCall();
        setTimeout(() => {
            onClose();
        }, 1000);
    };

    const statusLabel = callStatus === 'initializing'
        ? 'Initializing...'
        : callStatus === 'calling'
            ? 'Calling...'
            : callStatus === 'incoming'
                ? 'Incoming Call'
                : callStatus === 'connected'
                    ? 'Connected'
                    : 'Call Ended';

    if (isMinimized) {
        return createPortal(
            <motion.div
                drag
                dragMomentum={false}
                dragConstraints={{
                    left: 0,
                    right: Math.max(0, window.innerWidth - 220),
                    top: 0,
                    bottom: Math.max(0, window.innerHeight - 180)
                }}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    width: '220px',
                    height: '180px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    zIndex: 5000,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    border: '1px solid var(--glass-border)'
                }}
            >
                <div style={{ height: '132px', position: 'relative', backgroundColor: '#0a0b0d' }}>
                    {remoteStream ? (
                        <video playsInline ref={userVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                backgroundColor: 'var(--bg-tertiary)',
                                marginBottom: '8px'
                            }} />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{statusLabel}</span>
                        </div>
                    )}
                    {mediaWarning && (
                        <div style={{
                            position: 'absolute',
                            left: '6px',
                            right: '6px',
                            bottom: '6px',
                            fontSize: '10px',
                            color: '#facc15',
                            background: 'rgba(0,0,0,0.55)',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            textAlign: 'center'
                        }}>
                            {mediaWarning}
                        </div>
                    )}
                </div>

                <div style={{
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 8px',
                    borderTop: '1px solid var(--glass-border)',
                    background: 'rgba(10,10,12,0.9)'
                }}>
                    {callStatus === 'incoming' ? (
                        <>
                            <button
                                onClick={handleAcceptCall}
                                className="icon-btn"
                                style={{ backgroundColor: 'var(--success)', width: '34px', height: '34px', borderRadius: '50%', color: 'white' }}
                            >
                                <Phone size={16} />
                            </button>
                            <button
                                onClick={handleEndCall}
                                className="icon-btn"
                                style={{ backgroundColor: 'var(--danger)', width: '34px', height: '34px', borderRadius: '50%', color: 'white' }}
                            >
                                <PhoneOff size={16} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={toggleMute}
                                className="icon-btn"
                                style={{ backgroundColor: isMuted ? 'var(--danger)' : 'var(--bg-tertiary)', width: '34px', height: '34px', borderRadius: '50%' }}
                            >
                                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>
                            <button
                                onClick={() => setIsMinimized(false)}
                                className="icon-btn"
                                style={{ backgroundColor: 'var(--bg-tertiary)', width: '34px', height: '34px', borderRadius: '50%' }}
                            >
                                <Maximize2 size={16} />
                            </button>
                            <button
                                onClick={handleEndCall}
                                className="icon-btn"
                                style={{ backgroundColor: 'var(--danger)', width: '34px', height: '34px', borderRadius: '50%', color: 'white' }}
                            >
                                <PhoneOff size={16} />
                            </button>
                        </>
                    )}
                </div>

                {/* Hidden Audio Output for Amplification */}
                <audio ref={audioOutputRef} style={{ display: 'none' }} />
            </motion.div>,
            document.body
        );
    }

    return createPortal(
        <motion.div
            drag
            dragMomentum={false}
            dragConstraints={{
                left: 0,
                right: Math.max(0, window.innerWidth - 460),
                top: 0,
                bottom: Math.max(0, window.innerHeight - 560)
            }}
            style={{
                position: 'fixed',
                right: '20px',
                bottom: '20px',
                width: 'min(460px, calc(100vw - 24px))',
                height: 'min(560px, calc(100vh - 24px))',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '16px',
                overflow: 'hidden',
                zIndex: 5000,
                border: '1px solid var(--glass-border)',
                boxShadow: '0 18px 45px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <div style={{
                height: '44px',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--glass-border)',
                background: 'rgba(10,10,12,0.88)',
                flexShrink: 0,
            }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {statusLabel}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="icon-btn"
                        style={{ width: '30px', height: '30px', backgroundColor: 'var(--bg-tertiary)' }}
                    >
                        <Minimize2 size={16} />
                    </button>
                    <button
                        onClick={handleEndCall}
                        className="icon-btn"
                        style={{ width: '30px', height: '30px', backgroundColor: 'rgba(237,66,69,0.9)', color: 'white' }}
                    >
                        <PhoneOff size={16} />
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative', backgroundColor: '#0a0b0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {remoteStream ? (
                    <video playsInline ref={userVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '96px',
                            height: '96px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-tertiary)',
                            boxShadow: '0 0 30px rgba(143, 152, 163, 0.22)'
                        }} />
                        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{statusLabel}</h2>
                    </div>
                )}

                {mediaWarning && (
                    <div style={{
                        position: 'absolute',
                        left: '10px',
                        right: '10px',
                        top: '10px',
                        fontSize: '12px',
                        color: '#facc15',
                        background: 'rgba(0,0,0,0.55)',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        textAlign: 'center',
                        border: '1px solid rgba(250, 204, 21, 0.3)'
                    }}>
                        {mediaWarning}
                    </div>
                )}

                <motion.div
                    drag
                    dragMomentum={false}
                    dragConstraints={{ left: 0, right: 300, top: 0, bottom: 360 }}
                    style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '12px',
                        width: '128px',
                        height: '96px',
                        backgroundColor: '#000',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid var(--glass-border)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.5)'
                    }}
                >
                    <video playsInline muted ref={myVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </motion.div>
            </div>

            <div style={{
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '0 10px',
                borderTop: '1px solid var(--glass-border)',
                background: 'rgba(10,10,12,0.92)',
                flexShrink: 0,
            }}>
                {callStatus === 'incoming' ? (
                    <>
                        <button
                            onClick={handleAcceptCall}
                            className="icon-btn"
                            style={{ backgroundColor: 'var(--success)', width: '44px', height: '44px', borderRadius: '50%', color: 'white' }}
                        >
                            <Phone size={20} />
                        </button>
                        <button
                            onClick={handleEndCall}
                            className="icon-btn"
                            style={{ backgroundColor: 'var(--danger)', width: '44px', height: '44px', borderRadius: '50%', color: 'white' }}
                        >
                            <PhoneOff size={20} />
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={toggleMute}
                            className="icon-btn"
                            style={{ backgroundColor: isMuted ? 'var(--danger)' : 'var(--bg-tertiary)', width: '42px', height: '42px', borderRadius: '50%' }}
                        >
                            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>

                        <button
                            onClick={handleEndCall}
                            className="icon-btn"
                            style={{ backgroundColor: 'var(--danger)', width: '46px', height: '46px', borderRadius: '50%', color: 'white' }}
                        >
                            <PhoneOff size={20} />
                        </button>

                        <button
                            onClick={toggleVideo}
                            className="icon-btn"
                            style={{ backgroundColor: isVideoOff ? 'var(--danger)' : 'var(--bg-tertiary)', width: '42px', height: '42px', borderRadius: '50%' }}
                        >
                            {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                        </button>

                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="icon-btn"
                            style={{ backgroundColor: showSettings ? 'var(--accent)' : 'var(--bg-tertiary)', width: '42px', height: '42px', borderRadius: '50%' }}
                        >
                            <Settings size={18} />
                        </button>
                    </>
                )}
            </div>

            {/* Hidden Audio Output for Amplification */}
            <audio ref={audioOutputRef} style={{ display: 'none' }} />

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        style={{
                            position: 'absolute',
                            bottom: '72px',
                            left: '10px',
                            right: '10px',
                            maxHeight: '60%',
                            overflowY: 'auto',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            padding: '14px',
                            border: '1px solid var(--glass-border)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            zIndex: 5100
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Call Settings</h3>
                            <button onClick={() => setShowSettings(false)} className="icon-btn" style={{ width: '28px', height: '28px' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={13} /> REMOTE VOLUME</span>
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

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    <Video size={13} /> CAMERA
                                </label>
                                <select
                                    value={selectedVideoInput}
                                    onChange={(e) => switchMediaDevice('videoinput', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '7px 8px',
                                        borderRadius: '8px',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        border: '1px solid var(--glass-border)',
                                        color: 'white',
                                        fontSize: '12px'
                                    }}
                                >
                                    {devices.filter(d => d.kind === 'videoinput').map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    <Mic size={13} /> MICROPHONE
                                </label>
                                <select
                                    value={selectedAudioInput}
                                    onChange={(e) => switchMediaDevice('audioinput', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '7px 8px',
                                        borderRadius: '8px',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        border: '1px solid var(--glass-border)',
                                        color: 'white',
                                        fontSize: '12px'
                                    }}
                                >
                                    {devices.filter(d => d.kind === 'audioinput').map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    <Phone size={13} /> SPEAKER
                                </label>
                                <select
                                    value={selectedAudioOutput}
                                    onChange={(e) => handleAudioOutputChange(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '7px 8px',
                                        borderRadius: '8px',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        border: '1px solid var(--glass-border)',
                                        color: 'white',
                                        fontSize: '12px'
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
        </motion.div>,
        document.body
    );
}
