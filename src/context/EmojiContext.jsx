import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const EmojiContext = createContext();

export function useEmoji() {
    return useContext(EmojiContext);
}

export function EmojiProvider({ children }) {
    const [customEmojis, setCustomEmojis] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "customEmojis"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const emojis = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                emojis[data.shortcode] = data.url;
            });
            setCustomEmojis(emojis);
            setLoading(false);
        }, (error) => {
            if (import.meta.env.DEV) console.error("Error fetching custom emojis:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const getEmojiUrl = (shortcode) => {
        return customEmojis[shortcode];
    };

    const value = {
        customEmojis,
        getEmojiUrl,
        loading
    };

    return (
        <EmojiContext.Provider value={value}>
            {children}
        </EmojiContext.Provider>
    );
}
