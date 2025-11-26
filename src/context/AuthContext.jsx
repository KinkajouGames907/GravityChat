import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeDoc = () => { };

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            unsubscribeDoc(); // Unsubscribe from previous user doc listener

            if (user) {
                // User is signed in, listen to Firestore doc
                unsubscribeDoc = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        // Merge Auth user with Firestore data
                        const mergedUser = { ...user, ...userData, uid: user.uid, email: user.email };

                        // Check Global Ban
                        if (mergedUser.globalBan) {
                            alert("You have been permanently banned from Gravity.");
                            signOut(auth);
                            setCurrentUser(null);
                            setLoading(false);
                            return;
                        }

                        // Only update if data actually changed to avoid loops
                        setCurrentUser(prev => {
                            if (JSON.stringify(prev) === JSON.stringify(mergedUser)) return prev;
                            return mergedUser;
                        });
                    } else {
                        setCurrentUser(user);
                    }
                    setLoading(false);
                });
            } else {
                setCurrentUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeDoc();
        };
    }, []);

    // Presence Heartbeat & Account Persistence
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

            // Save to known accounts
            try {
                const knownAccounts = JSON.parse(localStorage.getItem('knownAccounts') || '[]');
                const accountData = {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName || currentUser.email.split('@')[0],
                    photoURL: currentUser.photoURL
                };

                const existingIndex = knownAccounts.findIndex(acc => acc.uid === currentUser.uid);
                if (existingIndex >= 0) {
                    knownAccounts[existingIndex] = accountData;
                } else {
                    knownAccounts.push(accountData);
                }

                localStorage.setItem('knownAccounts', JSON.stringify(knownAccounts));
            } catch (e) {
                console.error("Error saving known accounts:", e);
            }
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentUser?.uid, currentUser?.displayName, currentUser?.photoURL]);

    const value = {
        currentUser
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
