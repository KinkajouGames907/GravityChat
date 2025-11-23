import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Presence Heartbeat
    useEffect(() => {
        let interval;
        if (currentUser) {
            const userRef = doc(db, "users", currentUser.uid);

            const updateStatus = async () => {
                try {
                    await setDoc(userRef, {
                        lastSeen: serverTimestamp(),
                        status: 'online',
                        email: currentUser.email,
                        displayName: currentUser.displayName || currentUser.email.split('@')[0],
                        photoURL: currentUser.photoURL
                    }, { merge: true });
                } catch (error) {
                    console.error("Error updating presence:", error);
                }
            };

            // Update immediately
            updateStatus();

            // Update every minute
            interval = setInterval(updateStatus, 60000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentUser]);

    const value = {
        currentUser
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
