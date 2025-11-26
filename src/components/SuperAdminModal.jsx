import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Shield, Users, Flag, Ban, Trash2, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy, onSnapshot, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function SuperAdminModal({ isOpen, onClose }) {
    const [activeTab, setActiveTab] = useState('reports');
    const [reports, setReports] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [foundUser, setFoundUser] = useState(null);
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!isOpen) return;

        // Fetch Reports
        if (activeTab === 'reports') {
            const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            return () => unsubscribe();
        }

        // Fetch Team
        if (activeTab === 'team') {
            const fetchTeam = async () => {
                const q = query(collection(db, "users"), where("superAdminTeam", "==", true));
                const snapshot = await getDocs(q);
                setTeamMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            };
            fetchTeam();
        }
    }, [isOpen, activeTab]);

    const handleInviteTeam = async (e) => {
        e.preventDefault();
        if (!inviteEmail) return;

        try {
            const q = query(collection(db, "users"), where("email", "==", inviteEmail));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert("User not found with that email.");
                return;
            }

            const userDoc = snapshot.docs[0];
            await updateDoc(doc(db, "users", userDoc.id), {
                superAdminTeam: true
            });

            alert("User added to Super Admin Team.");
            setInviteEmail('');
            // Refresh team list
            const newTeam = [...teamMembers, { id: userDoc.id, ...userDoc.data(), superAdminTeam: true }];
            setTeamMembers(newTeam);
        } catch (error) {
            console.error("Error inviting team member:", error);
            alert("Failed to add team member.");
        }
    };

    const handleRemoveTeam = async (userId) => {
        if (!confirm("Remove this user from the Super Admin Team?")) return;
        try {
            await updateDoc(doc(db, "users", userId), {
                superAdminTeam: false
            });
            setTeamMembers(teamMembers.filter(m => m.id !== userId));
        } catch (error) {
            console.error("Error removing team member:", error);
        }
    };

    const handleSearchUser = async (e) => {
        e.preventDefault();
        if (!userSearch) return;

        try {
            // Search by email or ID
            let q = query(collection(db, "users"), where("email", "==", userSearch));
            let snapshot = await getDocs(q);

            if (snapshot.empty) {
                // Try by ID
                const docRef = doc(db, "users", userSearch);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setFoundUser({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setFoundUser(null);
                    alert("User not found.");
                }
            } else {
                setFoundUser({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            }
        } catch (error) {
            console.error("Error searching user:", error);
        }
    };

    const handleGlobalBan = async (userId, isBanned) => {
        const action = isBanned ? "unban" : "ban";
        if (!confirm(`Are you sure you want to ${action} this user globally?`)) return;

        try {
            await updateDoc(doc(db, "users", userId), {
                globalBan: !isBanned
            });
            if (foundUser && foundUser.id === userId) {
                setFoundUser({ ...foundUser, globalBan: !isBanned });
            }
            alert(`User ${action}ned successfully.`);
        } catch (error) {
            console.error(`Error ${action}ning user:`, error);
        }
    };

    const handleResolveReport = async (reportId) => {
        try {
            await updateDoc(doc(db, "reports", reportId), {
                status: 'resolved'
            });
        } catch (error) {
            console.error("Error resolving report:", error);
        }
    };

    const handleDeleteContent = async (report) => {
        if (!confirm("Delete the reported content?")) return;
        try {
            if (report.type === 'message') {
                await deleteDoc(doc(db, "messages", report.targetId));
                await updateDoc(doc(db, "reports", report.id), { status: 'resolved', actionTaken: 'deleted' });
                alert("Content deleted.");
            }
        } catch (error) {
            console.error("Error deleting content:", error);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
        }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                    width: '900px',
                    height: '700px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '16px',
                    display: 'flex',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    border: '1px solid var(--glass-border)'
                }}
            >
                {/* Sidebar */}
                <div style={{
                    width: '240px',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '24px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ padding: '0 12px 24px', fontWeight: 800, fontSize: '18px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={24} />
                        SUPER ADMIN
                    </div>
                    {[
                        { id: 'reports', label: 'Reports', icon: Flag },
                        { id: 'users', label: 'User Management', icon: Users },
                        { id: 'team', label: 'Admin Team', icon: Shield },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: activeTab === item.id ? 'var(--accent-dim)' : 'transparent',
                                color: activeTab === item.id ? 'var(--accent)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '15px',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                            }}
                        >
                            <item.icon size={20} style={{ marginRight: '12px' }} />
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 700 }}>
                            {activeTab === 'reports' && 'Moderation Reports'}
                            {activeTab === 'users' && 'Global User Management'}
                            {activeTab === 'team' && 'Super Admin Team'}
                        </h2>
                        <button onClick={onClose} className="icon-btn"><X size={24} /></button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                        {activeTab === 'reports' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {reports.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No reports found.</div>}
                                {reports.map(report => (
                                    <div key={report.id} style={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--glass-border)',
                                        opacity: report.status === 'resolved' ? 0.6 : 1
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--warning)', fontSize: '12px', textTransform: 'uppercase' }}>
                                                {report.type} • {report.status}
                                            </span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {report.createdAt?.toDate().toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reason: {report.reason}</div>
                                            <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '14px' }}>
                                                "{report.content}"
                                            </div>
                                        </div>
                                        {report.status !== 'resolved' && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleResolveReport(report.id)}
                                                    className="glossy-button"
                                                >
                                                    Resolve (Ignore)
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteContent(report)}
                                                    className="glossy-button"
                                                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid var(--error)' }}
                                                >
                                                    Delete Content
                                                </button>
                                                <button
                                                    onClick={() => handleGlobalBan(report.reportedUser, false)}
                                                    className="glossy-button"
                                                    style={{ backgroundColor: 'var(--error)', color: 'white' }}
                                                >
                                                    Ban User
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div>
                                <form onSubmit={handleSearchUser} style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                                    <input
                                        type="text"
                                        placeholder="Search by Email or User ID"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--glass-border)',
                                            backgroundColor: 'var(--bg-secondary)',
                                            color: 'white'
                                        }}
                                    />
                                    <button type="submit" className="glossy-button">Search</button>
                                </form>

                                {foundUser && (
                                    <div style={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        padding: '24px',
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '24px'
                                    }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            backgroundImage: `url(${foundUser.photoURL})`,
                                            backgroundSize: 'cover',
                                            backgroundColor: 'var(--bg-tertiary)'
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{foundUser.displayName}</h3>
                                            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{foundUser.email}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {foundUser.id}</div>
                                            {foundUser.globalBan && (
                                                <div style={{ color: 'var(--error)', fontWeight: 700, marginTop: '8px' }}>🚫 GLOBALLY BANNED</div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleGlobalBan(foundUser.id, foundUser.globalBan)}
                                            className="glossy-button"
                                            style={{
                                                backgroundColor: foundUser.globalBan ? 'var(--success)' : 'var(--error)',
                                                color: 'white',
                                                borderColor: 'transparent'
                                            }}
                                        >
                                            {foundUser.globalBan ? 'Unban User' : 'Global Ban'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'team' && (
                            <div>
                                <div style={{ marginBottom: '32px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Invite Team Member</h3>
                                    <form onSubmit={handleInviteTeam} style={{ display: 'flex', gap: '12px' }}>
                                        <input
                                            type="email"
                                            placeholder="User Email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--glass-border)',
                                                backgroundColor: 'var(--bg-secondary)',
                                                color: 'white'
                                            }}
                                        />
                                        <button type="submit" className="glossy-button">Add to Team</button>
                                    </form>
                                </div>

                                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Current Team</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {teamMembers.map(member => (
                                        <div key={member.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '16px',
                                            backgroundColor: 'var(--bg-secondary)',
                                            borderRadius: '12px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    backgroundImage: `url(${member.photoURL})`,
                                                    backgroundSize: 'cover',
                                                    backgroundColor: 'var(--bg-tertiary)'
                                                }} />
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{member.displayName}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.email}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveTeam(member.id)}
                                                className="icon-btn"
                                                style={{ color: 'var(--error)' }}
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}
