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

    value = { selectedVideoInput }
    onChange = {(e) => switchMediaDevice('videoinput', e.target.value)
}
style = {{
    width: '100%',
        padding: '8px',
            borderRadius: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--glass-border)',
                        color: 'white',
                            fontSize: '13px'
}}
                                    >
{
    devices.filter(d => d.kind === 'videoinput').map(device => (
        <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
        </option>
    ))
}
                                    </select >
                                </div >

    {/* Microphone */ }
    < div >
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
                                </div >

    {/* Speaker */ }
    < div >
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
                                </div >
                            </div >
                        </motion.div >
                    )}
                </AnimatePresence >
            </div >
        </div >,
    document.body
    );
}
