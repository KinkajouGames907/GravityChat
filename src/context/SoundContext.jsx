import React, { createContext, useContext, useState, useEffect } from 'react';
import notificationSoundFile from '../assets/sounds/notification.mp3';
import ringtoneSoundFile from '../assets/sounds/ringtone.mp3';
import { useTheme } from './ThemeContext';

const SoundContext = createContext();

export function useSound() {
    return useContext(SoundContext);
}

export function SoundProvider({ children }) {
    const { theme } = useTheme();
    const [isMuted, setIsMuted] = useState(() => {
        const saved = localStorage.getItem('gravity_sound_muted');
        return saved === 'true';
    });

    const toggleMute = () => {
        setIsMuted(prev => {
            const newValue = !prev;
            localStorage.setItem('gravity_sound_muted', newValue);
            return newValue;
        });
    };

    const playNotification = () => {
        if (isMuted) return;
        try {
            const src = theme?.sounds?.notification || notificationSoundFile;
            const audio = new Audio(src);
            audio.play().catch(e => { if (import.meta.env.DEV) console.log("Notification play failed:", e); });
        } catch (e) {
            if (import.meta.env.DEV) console.error("Error playing notification:", e);
        }
    };

    const playClick = () => {
        if (isMuted) return;
        try {
            if (theme?.sounds?.click) {
                const audio = new Audio(theme.sounds.click);
                audio.volume = 0.5; // Lower volume for clicks
                audio.play().catch(e => { if (import.meta.env.DEV) console.log("Click play failed:", e); });
            }
        } catch (e) {
            if (import.meta.env.DEV) console.error("Error playing click:", e);
        }
    };

    const createRingtone = () => {
        const src = theme?.sounds?.ringtone || ringtoneSoundFile;
        // Add timestamp to prevent caching issues if URL changes
        const audio = new Audio(`${src}${src.startsWith('data:') ? '' : '?t=' + Date.now()}`);
        audio.loop = true;
        return audio;
    };

    const value = {
        isMuted,
        toggleMute,
        playNotification,
        playClick,
        createRingtone
    };

    // Global click listener for custom click sounds
    useEffect(() => {
        const handleClick = () => {
            playClick();
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [isMuted, theme?.sounds?.click]);

    return (
        <SoundContext.Provider value={value}>
            {children}
        </SoundContext.Provider>
    );
}
