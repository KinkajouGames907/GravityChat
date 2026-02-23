import { createContext, useContext, useMemo, useState } from 'react';

const VoiceControlsContext = createContext(null);

export function VoiceControlsProvider({ children }) {
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);

    const toggleMicMute = () => {
        setIsMicMuted((prev) => {
            const next = !prev;
            if (!next) {
                setIsDeafened(false);
            }
            return next;
        });
    };

    const toggleDeafen = () => {
        setIsDeafened((prev) => {
            const next = !prev;
            if (next) {
                setIsMicMuted(true);
            }
            return next;
        });
    };

    const setMicMuted = (value) => {
        const next = Boolean(value);
        setIsMicMuted(next);
        if (!next) {
            setIsDeafened(false);
        }
    };

    const setDeafened = (value) => {
        const next = Boolean(value);
        setIsDeafened(next);
        if (next) {
            setIsMicMuted(true);
        }
    };

    const value = useMemo(() => ({
        isMicMuted,
        isDeafened,
        toggleMicMute,
        toggleDeafen,
        setMicMuted,
        setDeafened,
    }), [isMicMuted, isDeafened]);

    return (
        <VoiceControlsContext.Provider value={value}>
            {children}
        </VoiceControlsContext.Provider>
    );
}

export function useVoiceControls() {
    const context = useContext(VoiceControlsContext);
    if (!context) {
        return {
            isMicMuted: false,
            isDeafened: false,
            toggleMicMute: () => { },
            toggleDeafen: () => { },
            setMicMuted: () => { },
            setDeafened: () => { },
        };
    }
    return context;
}
