import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export function useTheme() {
    return useContext(ThemeContext);
}

const DEFAULT_THEME = {
    colors: {
        '--bg-primary': '#0b0d10',
        '--bg-secondary': '#111419',
        '--bg-tertiary': '#191d23',
        '--accent': '#8f98a3',
        '--text-primary': '#eef1f4',
        '--text-secondary': '#b2bac4'
    },
    animations: {
        enabled: true,
        customCSS: ''
    },
    particles: {
        enabled: false,
        type: 'snow', // snow, rain, sparks
        intensity: 50
    },
    sounds: {
        click: null, // URL or base64
        notification: null,
        ringtone: null
    }
};

const LEGACY_COLOR_MIGRATION = {
    '--bg-primary': '#06040f',
    '--bg-secondary': '#0b0818',
    '--bg-tertiary': '#130d22',
    '--accent': '#a855f7',
    '--text-primary': '#ede8ff',
    '--text-secondary': '#b0a0cc',
};

export function ThemeProvider({ children }) {
    const { currentUser } = useAuth();
    const [theme, setTheme] = useState(DEFAULT_THEME);
    const [loading, setLoading] = useState(true);

    // Load settings from Firestore
    useEffect(() => {
        if (!currentUser) {
            setTheme(DEFAULT_THEME);
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid, 'settings', 'theme'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                const mergedColors = { ...DEFAULT_THEME.colors, ...data.colors };

                // Migrate old purple defaults to the new neutral palette.
                Object.entries(LEGACY_COLOR_MIGRATION).forEach(([key, legacyValue]) => {
                    if (mergedColors[key] === legacyValue) {
                        mergedColors[key] = DEFAULT_THEME.colors[key];
                    }
                });

                // Merge with default to ensure all keys exist
                setTheme(prev => ({
                    ...DEFAULT_THEME,
                    ...data,
                    colors: mergedColors,
                    animations: { ...DEFAULT_THEME.animations, ...data.animations },
                    particles: { ...DEFAULT_THEME.particles, ...data.particles },
                    sounds: { ...DEFAULT_THEME.sounds, ...data.sounds }
                }));
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [currentUser]);

    // Apply CSS variables
    useEffect(() => {
        const root = document.documentElement;
        Object.entries(theme.colors).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        // Apply Custom CSS for animations
        let styleTag = document.getElementById('custom-theme-css');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'custom-theme-css';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = theme.animations.customCSS || '';

    }, [theme.colors, theme.animations.customCSS]);

    const updateTheme = async (newSettings) => {
        if (!currentUser) return;

        // Optimistic update
        setTheme(prev => {
            const updated = { ...prev, ...newSettings };
            return updated;
        });

        try {
            await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'theme'), newSettings, { merge: true });
        } catch (error) {
            if (import.meta.env.DEV) console.error("Failed to save theme:", error);
        }
    };

    const resetTheme = async () => {
        await updateTheme(DEFAULT_THEME);
    };

    const value = {
        theme,
        updateTheme,
        resetTheme,
        loading
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
