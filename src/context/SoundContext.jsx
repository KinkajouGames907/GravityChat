import React, { createContext, useContext, useState, useEffect } from 'react';
import notificationSoundFile from '../assets/sounds/notification.mp3';
import ringtoneSoundFile from '../assets/sounds/ringtone.mp3';

const SoundContext = createContext();

export function useSound() {
    return useContext(SoundContext);
}

export function SoundProvider({ children }) {
    const [isMuted, setIsMuted] = useState(() => {
        const saved = localStorage.getItem('gravity_muted');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('gravity_muted', isMuted);
    }, [isMuted]);

    const playNotification = () => {
        if (isMuted) return;
        try {
            const audio = new Audio(notificationSoundFile);
            audio.play().catch(e => console.log("Notification play failed:", e));
        } catch (e) {
            console.error("Audio playback error:", e);
        }
    };

    // For ringtone, we return the audio object so the caller can control loop/pause
    // But we wrap the play method to check for mute
    const createRingtone = () => {
        const audio = new Audio(`${ringtoneSoundFile}?t=${Date.now()}`);
        const originalPlay = audio.play.bind(audio);

        audio.play = async () => {
            if (isMuted) return Promise.resolve();
            return originalPlay();
        };

        return audio;
    };

    const toggleMute = () => setIsMuted(prev => !prev);

    const value = {
        isMuted,
        toggleMute,
        playNotification,
        createRingtone
    };

    return (
        <SoundContext.Provider value={value}>
            {children}
        </SoundContext.Provider>
    );
}
