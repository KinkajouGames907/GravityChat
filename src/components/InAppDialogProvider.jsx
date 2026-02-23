import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { registerDialogHandlers } from '../utils/dialogService';

const TITLE_BY_TYPE = {
    alert: 'Notice',
    confirm: 'Confirm Action',
    prompt: 'Input Required',
};

let dialogIdCounter = 0;

function nextDialogId() {
    dialogIdCounter += 1;
    return `dialog-${dialogIdCounter}`;
}

function buildDefaultResult(dialog) {
    if (!dialog) return undefined;
    if (dialog.type === 'confirm') return false;
    if (dialog.type === 'prompt') return null;
    return undefined;
}

export default function InAppDialogProvider({ children }) {
    const [queue, setQueue] = useState([]);
    const [promptValue, setPromptValue] = useState('');
    const [promptError, setPromptError] = useState('');
    const queueRef = useRef([]);
    const promptInputRef = useRef(null);

    const activeDialog = queue[0] || null;
    const activeDialogType = activeDialog?.type;
    const activeDialogOptions = activeDialog?.options || {};

    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    const dequeueWithResult = useCallback((result) => {
        setQueue((prev) => {
            if (prev.length === 0) return prev;
            const [current, ...rest] = prev;
            try {
                current.resolve(result);
            } catch (_) {
                // Ignore resolver failures.
            }
            return rest;
        });
    }, []);

    const enqueue = useCallback((type, message, options = {}) => {
        return new Promise((resolve) => {
            setQueue((prev) => [
                ...prev,
                {
                    id: nextDialogId(),
                    type,
                    message: String(message ?? ''),
                    options: options || {},
                    resolve,
                },
            ]);
        });
    }, []);

    useEffect(() => {
        const unregister = registerDialogHandlers({
            alert: (message, options) => enqueue('alert', message, options),
            confirm: (message, options) => enqueue('confirm', message, options),
            prompt: (message, options) => enqueue('prompt', message, options),
        });

        return () => {
            unregister();
            queueRef.current.forEach((dialog) => {
                try {
                    dialog.resolve(buildDefaultResult(dialog));
                } catch (_) {
                    // Ignore resolver failures.
                }
            });
            queueRef.current = [];
        };
    }, [enqueue]);

    useEffect(() => {
        if (activeDialogType !== 'prompt') {
            setPromptValue('');
            setPromptError('');
            return;
        }

        const initialValue = activeDialogOptions.defaultValue ?? '';
        setPromptValue(String(initialValue));
        setPromptError('');

        const focusTimer = setTimeout(() => {
            promptInputRef.current?.focus();
            promptInputRef.current?.select();
        }, 0);

        return () => clearTimeout(focusTimer);
    }, [activeDialog?.id, activeDialogType, activeDialogOptions.defaultValue]);

    const closeDialog = useCallback(() => {
        dequeueWithResult(buildDefaultResult(activeDialog));
    }, [activeDialog, dequeueWithResult]);

    const cancelDialog = useCallback(() => {
        if (!activeDialog) return;
        if (activeDialog.type === 'alert') {
            dequeueWithResult(undefined);
            return;
        }
        if (activeDialog.type === 'confirm') {
            dequeueWithResult(false);
            return;
        }
        dequeueWithResult(null);
    }, [activeDialog, dequeueWithResult]);

    const confirmDialog = useCallback(() => {
        if (!activeDialog) return;

        if (activeDialog.type === 'alert') {
            dequeueWithResult(undefined);
            return;
        }

        if (activeDialog.type === 'confirm') {
            dequeueWithResult(true);
            return;
        }

        const isRequired = activeDialog.options?.required !== false;
        if (isRequired && !promptValue.trim()) {
            setPromptError('Please enter a value.');
            return;
        }

        dequeueWithResult(promptValue);
    }, [activeDialog, dequeueWithResult, promptValue]);

    useEffect(() => {
        if (!activeDialog) return;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                cancelDialog();
                return;
            }

            if (event.key !== 'Enter') return;

            if (activeDialog.type === 'prompt') {
                if (event.target instanceof HTMLTextAreaElement) return;
                event.preventDefault();
                confirmDialog();
                return;
            }

            event.preventDefault();
            confirmDialog();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeDialog, cancelDialog, confirmDialog]);

    const dialogUi = useMemo(() => {
        if (!activeDialog || typeof document === 'undefined') return null;

        const title = activeDialogOptions.title || TITLE_BY_TYPE[activeDialog.type] || 'Notice';
        const confirmText = activeDialogOptions.confirmText || (activeDialog.type === 'alert' ? 'OK' : 'Confirm');
        const cancelText = activeDialogOptions.cancelText || 'Cancel';
        const danger = Boolean(activeDialogOptions.danger);

        return createPortal(
            <AnimatePresence>
                <motion.div
                    key={activeDialog.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 13000,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                    }}
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            if (activeDialog.type === 'alert') closeDialog();
                            else cancelDialog();
                        }
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 18, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                        style={{
                            width: 'min(460px, 100%)',
                            borderRadius: '14px',
                            border: '1px solid var(--glass-border)',
                            background: 'linear-gradient(180deg, rgba(16, 18, 22, 0.98), rgba(10, 11, 14, 0.98))',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.58)',
                            overflow: 'hidden',
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {(danger || activeDialog.type !== 'prompt') && (
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: danger ? 'rgba(239, 68, 68, 0.14)' : 'rgba(148, 163, 184, 0.14)',
                                    }}>
                                        <AlertTriangle size={16} color={danger ? '#f87171' : '#cbd5e1'} />
                                    </div>
                                )}
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {title}
                                </h3>
                            </div>
                        </div>

                        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                {activeDialog.message}
                            </div>

                            {activeDialog.type === 'prompt' && (
                                <div>
                                    <input
                                        ref={promptInputRef}
                                        type="text"
                                        value={promptValue}
                                        onChange={(event) => {
                                            setPromptValue(event.target.value);
                                            if (promptError) setPromptError('');
                                        }}
                                        placeholder={activeDialogOptions.placeholder || ''}
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: `1px solid ${promptError ? '#f87171' : 'var(--glass-border)'}`,
                                            backgroundColor: 'rgba(255,255,255,0.04)',
                                            color: 'var(--text-primary)',
                                            fontSize: '14px',
                                        }}
                                    />
                                    {promptError && (
                                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#f87171' }}>
                                            {promptError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{
                            padding: '12px 18px 18px',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '10px',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            {activeDialog.type !== 'alert' && (
                                <button
                                    onClick={cancelDialog}
                                    className="secondary-button"
                                    style={{ padding: '8px 14px', fontSize: '13px' }}
                                >
                                    {cancelText}
                                </button>
                            )}
                            <button
                                onClick={confirmDialog}
                                className="glossy-button"
                                style={{
                                    padding: '8px 14px',
                                    fontSize: '13px',
                                    ...(danger ? {
                                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                        boxShadow: '0 10px 24px rgba(239, 68, 68, 0.36)',
                                    } : {}),
                                }}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>,
            document.body
        );
    }, [
        activeDialog,
        activeDialogOptions,
        cancelDialog,
        closeDialog,
        confirmDialog,
        promptError,
        promptValue,
    ]);

    return (
        <>
            {children}
            {dialogUi}
        </>
    );
}
