import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
    X, Upload, RefreshCw, Users, CheckCircle, AlertCircle,
    Loader, GitBranch, Trash2, ExternalLink, UploadCloud
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
    doc, setDoc, updateDoc, onSnapshot,
    serverTimestamp, arrayUnion, arrayRemove,
    collection, addDoc, query, orderBy, limit
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/permissions';
import { pushZipToGitHub, verifyGitHubConfig } from '../utils/githubUpdate';
import { appAlert, appConfirm } from '../utils/dialogService';

const TABS = [
    { id: 'deploy', label: 'Deploy', icon: UploadCloud },
    { id: 'access', label: 'Access', icon: Users, superAdminOnly: true },
    { id: 'history', label: 'History', icon: RefreshCw },
];

const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER;
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO;
const GITHUB_BRANCH = import.meta.env.VITE_GITHUB_BRANCH || 'main';

function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Unknown time';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

export default function UpdateCenterModal({ isOpen, onClose, isMobile }) {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('deploy');

    // Deploy tab state
    const [zipFile, setZipFile] = useState(null);
    const [zipFileName, setZipFileName] = useState('');
    const [commitMessage, setCommitMessage] = useState('');
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployProgress, setDeployProgress] = useState(null);
    const [deployResult, setDeployResult] = useState(null);
    const [configStatus, setConfigStatus] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [fileError, setFileError] = useState('');

    // Access tab state
    const [authorizedEmails, setAuthorizedEmails] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [accessLoading, setAccessLoading] = useState(false);

    // History tab state
    const [deployLogs, setDeployLogs] = useState([]);

    const fileInputRef = useRef(null);
    const configRef = doc(db, 'updateCenter', 'config');

    // Verify GitHub config on open
    useEffect(() => {
        if (!isOpen) return;
        setConfigStatus(null);
        verifyGitHubConfig().then(setConfigStatus);
    }, [isOpen]);

    // Live-listen to authorized emails + auto-close if access revoked
    useEffect(() => {
        if (!isOpen) return;
        const unsubscribe = onSnapshot(configRef, (snap) => {
            if (snap.exists()) {
                const emails = snap.data().authorizedEmails || [];
                setAuthorizedEmails(emails);
                // Auto-close if current non-super-admin user loses access
                if (!isSuperAdmin(currentUser) && !emails.includes(currentUser?.email)) {
                    onClose();
                }
            } else {
                setAuthorizedEmails([]);
            }
        }, () => {
            // Silently ignore permission errors
            setAuthorizedEmails([]);
        });
        return () => unsubscribe();
    }, [isOpen, currentUser?.uid]);

    // History tab listener
    useEffect(() => {
        if (!isOpen || activeTab !== 'history') return;
        const q = query(
            collection(db, 'updateCenter', 'config', 'deployLogs'),
            orderBy('deployedAt', 'desc'),
            limit(20)
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            setDeployLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, () => setDeployLogs([]));
        return () => unsubscribe();
    }, [isOpen, activeTab]);

    const validateFile = (file) => {
        if (!file) return 'No file selected.';
        if (!file.name.endsWith('.zip') && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
            return 'Only ZIP files are accepted.';
        }
        if (file.size > 500 * 1024 * 1024) {
            return 'ZIP file must be under 500MB.';
        }
        return '';
    };

    const handleFileSelect = (file) => {
        const error = validateFile(file);
        if (error) {
            setFileError(error);
            setZipFile(null);
            setZipFileName('');
            return;
        }
        setFileError('');
        setZipFile(file);
        setZipFileName(file.name);
        setDeployResult(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleDeploy = async () => {
        if (!zipFile || !commitMessage.trim() || isDeploying || !configStatus?.valid) return;

        const confirmed = await appConfirm(
            `You are about to push all files from "${zipFileName}" to the "${GITHUB_BRANCH}" branch of ${configStatus.repoName}.\n\nThis will trigger an automatic Vercel redeploy for ALL users.\n\nAre you sure?`,
            { title: 'Deploy Update', confirmText: 'Deploy', cancelText: 'Cancel', danger: true }
        );
        if (!confirmed) return;

        setIsDeploying(true);
        setDeployResult(null);
        setDeployProgress({ current: 0, total: 0, fileName: 'Parsing ZIP...', status: 'processing' });

        try {
            const result = await pushZipToGitHub(zipFile, commitMessage.trim(), (progress) => {
                setDeployProgress(progress);
            });

            setDeployResult(result);

            await addDoc(collection(db, 'updateCenter', 'config', 'deployLogs'), {
                deployedAt: serverTimestamp(),
                deployedBy: currentUser.email,
                commitMessage: commitMessage.trim(),
                pushedCount: result.pushedFiles.length,
                skippedCount: result.skippedFiles.length,
                errorCount: result.errors.length,
                status: result.errors.length === 0 ? 'success'
                    : result.pushedFiles.length > 0 ? 'partial'
                        : 'failed',
                repoName: configStatus?.repoName || `${GITHUB_OWNER}/${GITHUB_REPO}`,
            });
        } catch (err) {
            setDeployResult({ pushedFiles: [], skippedFiles: [], errors: [err.message] });
        } finally {
            setIsDeploying(false);
        }
    };

    const handleGrantAccess = async (e) => {
        e.preventDefault();
        const email = newEmail.trim().toLowerCase();
        if (!email) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            await appAlert('Please enter a valid email address.', { title: 'Invalid Email' });
            return;
        }
        if (authorizedEmails.includes(email)) {
            await appAlert('This user already has access.', { title: 'Duplicate User' });
            return;
        }
        setAccessLoading(true);
        try {
            await setDoc(configRef, {
                authorizedEmails: arrayUnion(email),
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.email,
            }, { merge: true });
            setNewEmail('');
        } catch (err) {
            await appAlert(`Failed to grant access: ${err.message}`, { title: 'Access Update Failed', danger: true });
        } finally {
            setAccessLoading(false);
        }
    };

    const handleRevokeAccess = async (email) => {
        const confirmed = await appConfirm(
            `Remove Update Center access for ${email}?`,
            { title: 'Remove Access', confirmText: 'Remove', cancelText: 'Cancel', danger: true }
        );
        if (!confirmed) return;
        try {
            await updateDoc(configRef, {
                authorizedEmails: arrayRemove(email),
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.email,
            });
        } catch (err) {
            await appAlert(`Failed to revoke access: ${err.message}`, { title: 'Access Update Failed', danger: true });
        }
    };

    const resetDeploy = () => {
        setZipFile(null);
        setZipFileName('');
        setCommitMessage('');
        setDeployResult(null);
        setDeployProgress(null);
        setFileError('');
    };

    if (!isOpen) return null;

    const visibleTabs = TABS.filter(t => !t.superAdminOnly || isSuperAdmin(currentUser));

    const progressPercent = deployProgress?.total > 0
        ? Math.round((deployProgress.current / deployProgress.total) * 100)
        : 0;

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
                padding: isMobile ? 0 : '20px',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                    width: isMobile ? '100%' : '900px',
                    height: isMobile ? '100%' : '680px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: isMobile ? 0 : '16px',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    border: isMobile ? 'none' : '1px solid var(--glass-border)',
                }}
            >
                {/* Sidebar / Tab Strip */}
                <div style={{
                    width: isMobile ? '100%' : '220px',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: isMobile ? '16px' : '24px 12px',
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    gap: isMobile ? '8px' : '4px',
                    overflowX: isMobile ? 'auto' : 'visible',
                    borderBottom: isMobile ? '1px solid var(--glass-border)' : 'none',
                    flexShrink: 0,
                }}>
                    {/* Header */}
                    <div style={{
                        padding: isMobile ? '0 12px 0 0' : '0 12px 20px',
                        fontWeight: 800,
                        fontSize: isMobile ? '16px' : '16px',
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginRight: isMobile ? '16px' : 0,
                        borderRight: isMobile ? '1px solid var(--glass-border)' : 'none',
                        flexShrink: 0,
                    }}>
                        <GitBranch size={isMobile ? 18 : 20} style={{ color: '#22c55e' }} />
                        {!isMobile && 'UPDATE CENTER'}
                    </div>

                    {/* Tabs */}
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: isMobile ? '8px 12px' : '12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: activeTab === tab.id ? 'rgba(34,197,94,0.15)' : 'transparent',
                                color: activeTab === tab.id ? '#22c55e' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '14px',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <tab.icon size={16} style={{ marginRight: '8px', flexShrink: 0 }} />
                            {tab.label}
                        </button>
                    ))}

                    {/* Config status chip at bottom of sidebar (desktop) */}
                    {!isMobile && configStatus && (
                        <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                            <div style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                backgroundColor: configStatus.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${configStatus.valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                fontSize: '11px',
                                color: configStatus.valid ? '#22c55e' : 'var(--error)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}>
                                {configStatus.valid
                                    ? <><CheckCircle size={12} /> Connected</>
                                    : <><AlertCircle size={12} /> Not configured</>
                                }
                            </div>
                        </div>
                    )}

                    {isMobile && (
                        <button onClick={onClose} style={{ marginLeft: 'auto', padding: '8px', background: 'transparent', border: 'none', color: 'white', flexShrink: 0 }}>
                            <X size={24} />
                        </button>
                    )}
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    {/* Header bar */}
                    <div style={{
                        padding: isMobile ? '16px' : '20px 24px',
                        borderBottom: '1px solid var(--glass-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexShrink: 0,
                    }}>
                        <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 700, margin: 0 }}>
                            {activeTab === 'deploy' && 'Deploy New Version'}
                            {activeTab === 'access' && 'Manage Access'}
                            {activeTab === 'history' && 'Deploy History'}
                        </h2>
                        {!isMobile && (
                            <button onClick={onClose} className="icon-btn"><X size={22} /></button>
                        )}
                    </div>

                    {/* Scrollable body */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px' }}>

                        {/* ---- DEPLOY TAB ---- */}
                        {activeTab === 'deploy' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* Config status banner */}
                                {configStatus ? (
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        backgroundColor: configStatus.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                        border: `1px solid ${configStatus.valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '13px',
                                        color: configStatus.valid ? '#22c55e' : 'var(--error)',
                                    }}>
                                        {configStatus.valid
                                            ? <><CheckCircle size={16} /> Connected to <strong>{configStatus.repoName}</strong> on branch <strong>{GITHUB_BRANCH}</strong></>
                                            : <><AlertCircle size={16} /> {configStatus.error}</>
                                        }
                                        {!configStatus.valid && (
                                            <button
                                                onClick={() => { setConfigStatus(null); verifyGitHubConfig().then(setConfigStatus); }}
                                                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                            >
                                                Re-check
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Checking GitHub configuration...
                                    </div>
                                )}

                                {/* ZIP Drop zone */}
                                {!deployResult && (
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                        onDragLeave={() => setDragActive(false)}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            border: `2px dashed ${dragActive ? '#22c55e' : zipFile ? 'rgba(34,197,94,0.5)' : 'var(--glass-border)'}`,
                                            borderRadius: '12px',
                                            padding: '32px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            backgroundColor: dragActive ? 'rgba(34,197,94,0.05)' : zipFile ? 'rgba(34,197,94,0.03)' : 'var(--bg-secondary)',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".zip,application/zip,application/x-zip-compressed"
                                            style={{ display: 'none' }}
                                            onChange={(e) => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); }}
                                        />
                                        {zipFile ? (
                                            <>
                                                <CheckCircle size={36} style={{ color: '#22c55e', margin: '0 auto 12px' }} />
                                                <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: '4px' }}>{zipFileName}</div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                    {(zipFile.size / 1024 / 1024).toFixed(2)} MB — Click to change file
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                    {dragActive ? 'Drop ZIP here' : 'Drag & drop your project ZIP'}
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                    or click to browse — ZIP files only, max 500MB
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {fileError && (
                                    <div style={{ color: 'var(--error)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <AlertCircle size={14} /> {fileError}
                                    </div>
                                )}

                                {/* Commit message input */}
                                {!deployResult && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            Commit Message
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={`Update v${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}`}
                                            value={commitMessage}
                                            onChange={(e) => setCommitMessage(e.target.value)}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--glass-border)',
                                                backgroundColor: 'var(--bg-secondary)',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px',
                                                outline: 'none',
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Warning box */}
                                {!deployResult && configStatus?.valid && (
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        backgroundColor: 'rgba(234,179,8,0.08)',
                                        border: '1px solid rgba(234,179,8,0.3)',
                                        fontSize: '12px',
                                        color: 'rgba(234,179,8,0.9)',
                                        lineHeight: 1.5,
                                    }}>
                                        This will overwrite files in the <strong>{GITHUB_BRANCH}</strong> branch of <strong>{configStatus.repoName}</strong>. The app will automatically redeploy for all users via Vercel. Files in <code>node_modules/</code>, <code>.env</code>, and <code>dist/</code> are excluded.
                                    </div>
                                )}

                                {/* Deploy button */}
                                {!deployResult && (
                                    <button
                                        onClick={handleDeploy}
                                        disabled={!zipFile || !commitMessage.trim() || isDeploying || !configStatus?.valid}
                                        style={{
                                            padding: '14px 24px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: (zipFile && commitMessage.trim() && !isDeploying && configStatus?.valid)
                                                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                                                : 'var(--bg-tertiary)',
                                            color: (zipFile && commitMessage.trim() && !isDeploying && configStatus?.valid) ? 'white' : 'var(--text-muted)',
                                            fontWeight: 700,
                                            fontSize: '15px',
                                            cursor: (zipFile && commitMessage.trim() && !isDeploying && configStatus?.valid) ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '10px',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {isDeploying
                                            ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Deploying...</>
                                            : <><GitBranch size={18} /> Deploy Update</>
                                        }
                                    </button>
                                )}

                                {/* Progress section */}
                                {(isDeploying || (deployProgress && !deployResult)) && (
                                    <div style={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        borderRadius: '12px',
                                        padding: '20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                                                {deployProgress?.fileName || 'Starting...'}
                                            </span>
                                            <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>
                                                {deployProgress?.current || 0} / {deployProgress?.total || 0} files
                                            </span>
                                        </div>
                                        <div style={{ height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <motion.div
                                                animate={{ width: `${progressPercent}%` }}
                                                style={{ height: '100%', background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: '4px' }}
                                                transition={{ duration: 0.3 }}
                                            />
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                            Pushing files to GitHub... {progressPercent}%
                                        </div>
                                    </div>
                                )}

                                {/* Result section */}
                                {deployResult && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{
                                            padding: '20px',
                                            borderRadius: '12px',
                                            backgroundColor: deployResult.errors.length === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(234,179,8,0.08)',
                                            border: `1px solid ${deployResult.errors.length === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                                {deployResult.errors.length === 0
                                                    ? <CheckCircle size={24} style={{ color: '#22c55e' }} />
                                                    : <AlertCircle size={24} style={{ color: 'rgba(234,179,8,0.9)' }} />
                                                }
                                                <span style={{ fontWeight: 700, fontSize: '16px' }}>
                                                    {deployResult.errors.length === 0 ? 'Deploy Successful!' : 'Deploy Completed with Warnings'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div>✓ {deployResult.pushedFiles.length} files pushed to GitHub</div>
                                                {deployResult.skippedFiles.length > 0 && (
                                                    <div style={{ color: 'var(--text-muted)' }}>— {deployResult.skippedFiles.length} files skipped</div>
                                                )}
                                                {deployResult.errors.length > 0 && (
                                                    <div style={{ color: 'var(--error)' }}>✗ {deployResult.errors.length} files failed</div>
                                                )}
                                            </div>
                                        </div>

                                        {deployResult.errors.length > 0 && (
                                            <div style={{
                                                backgroundColor: 'var(--bg-secondary)',
                                                borderRadius: '10px',
                                                padding: '16px',
                                                maxHeight: '160px',
                                                overflowY: 'auto',
                                            }}>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--error)', marginBottom: '8px' }}>FAILED FILES</div>
                                                {deployResult.errors.map((err, i) => (
                                                    <div key={i} style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0', borderBottom: '1px solid var(--glass-border)' }}>
                                                        {err}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            {GITHUB_OWNER && GITHUB_REPO && (
                                                <a
                                                    href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '10px 16px',
                                                        borderRadius: '8px',
                                                        backgroundColor: 'var(--bg-secondary)',
                                                        border: '1px solid var(--glass-border)',
                                                        color: 'var(--text-secondary)',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        textDecoration: 'none',
                                                    }}
                                                >
                                                    <ExternalLink size={14} /> View on GitHub
                                                </a>
                                            )}
                                            <button
                                                onClick={resetDeploy}
                                                className="glossy-button"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <Upload size={14} /> Deploy Another
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ---- ACCESS TAB ---- */}
                        {activeTab === 'access' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* Add user form */}
                                <div>
                                    <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Grant Access
                                    </h3>
                                    <form onSubmit={handleGrantAccess} style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="email"
                                            placeholder="user@example.com"
                                            value={newEmail}
                                            onChange={(e) => setNewEmail(e.target.value)}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--glass-border)',
                                                backgroundColor: 'var(--bg-secondary)',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px',
                                                outline: 'none',
                                            }}
                                        />
                                        <button
                                            type="submit"
                                            disabled={accessLoading}
                                            className="glossy-button"
                                            style={{ flexShrink: 0 }}
                                        >
                                            {accessLoading ? 'Adding...' : 'Grant Access'}
                                        </button>
                                    </form>
                                </div>

                                {/* Authorized users list */}
                                <div>
                                    <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Authorized Users
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Super admin (always shown, immovable) */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '14px 16px',
                                            backgroundColor: 'var(--bg-secondary)',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(34,197,94,0.2)',
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>albertderek6878@gmail.com</div>
                                                <div style={{ fontSize: '12px', color: '#22c55e' }}>Super Admin — Always has access</div>
                                            </div>
                                        </div>

                                        {/* Additional authorized emails */}
                                        {authorizedEmails.filter(e => e !== 'albertderek6878@gmail.com').map(email => (
                                            <div
                                                key={email}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '14px 16px',
                                                    backgroundColor: 'var(--bg-secondary)',
                                                    borderRadius: '10px',
                                                    border: '1px solid var(--glass-border)',
                                                }}
                                            >
                                                <div style={{ fontWeight: 500, fontSize: '14px' }}>{email}</div>
                                                <button
                                                    onClick={() => handleRevokeAccess(email)}
                                                    className="icon-btn"
                                                    style={{ color: 'var(--error)' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}

                                        {authorizedEmails.filter(e => e !== 'albertderek6878@gmail.com').length === 0 && (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
                                                No additional users authorized. Add emails above to grant access.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ---- HISTORY TAB ---- */}
                        {activeTab === 'history' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {deployLogs.length === 0 && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                                        No deployments yet. Deploy your first update above!
                                    </div>
                                )}
                                {deployLogs.map(log => (
                                    <div
                                        key={log.id}
                                        style={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            border: `1px solid ${log.status === 'success' ? 'rgba(34,197,94,0.2)' : log.status === 'partial' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: log.status === 'success' ? '#22c55e' : log.status === 'partial' ? 'rgba(234,179,8,0.9)' : 'var(--error)',
                                                    flexShrink: 0,
                                                }} />
                                                <span style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {log.commitMessage}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                                {formatRelativeTime(log.deployedAt)}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                            <span>By {log.deployedBy}</span>
                                            <span>✓ {log.pushedCount} pushed</span>
                                            {log.errorCount > 0 && <span style={{ color: 'var(--error)' }}>✗ {log.errorCount} failed</span>}
                                        </div>
                                        {log.repoName && GITHUB_BRANCH && (
                                            <a
                                                href={`https://github.com/${log.repoName}/commits/${GITHUB_BRANCH}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    marginTop: '10px',
                                                    fontSize: '12px',
                                                    color: 'var(--text-muted)',
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                <ExternalLink size={12} /> View on GitHub
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}
