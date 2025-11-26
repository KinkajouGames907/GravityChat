import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, FileText, Film, X, Upload, Loader, AlertCircle } from 'lucide-react';

// File size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_GIF_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// Allowed file types
const ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    gif: ['image/gif'],
    text: ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html']
};

export default function FileUpload({ isOpen, onClose, onFileSelect }) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const validateFile = (file) => {
        setError(null);

        // Check if file type is allowed
        const isImage = ALLOWED_TYPES.image.includes(file.type);
        const isGif = ALLOWED_TYPES.gif.includes(file.type);
        const isText = ALLOWED_TYPES.text.includes(file.type);

        if (!isImage && !isGif && !isText) {
            setError('File type not supported. Use images, GIFs, or text files.');
            return false;
        }

        // Check file size
        if (isGif && file.size > MAX_GIF_SIZE) {
            setError('GIF is too large. Maximum size is 15MB.');
            return false;
        } else if (isImage && file.size > MAX_IMAGE_SIZE) {
            setError('Image is too large. Maximum size is 10MB.');
            return false;
        } else if (isText && file.size > MAX_FILE_SIZE) {
            setError('File is too large. Maximum size is 500MB.');
            return false;
        }

        return true;
    };

    const processFile = (file) => {
        if (!validateFile(file)) return;

        setSelectedFile(file);

        // Create preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target.result);
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setError(null);

        try {
            // Convert file to base64 for storage in Firestore
            // In production, you'd use Firebase Storage instead
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target.result;

                const fileData = {
                    name: selectedFile.name,
                    type: selectedFile.type,
                    size: selectedFile.size,
                    data: base64Data,
                    isImage: selectedFile.type.startsWith('image/'),
                    isGif: selectedFile.type === 'image/gif'
                };

                onFileSelect(fileData);
                handleClose();
            };
            reader.onerror = () => {
                setError('Failed to read file. Please try again.');
                setUploading(false);
            };
            reader.readAsDataURL(selectedFile);
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to upload file. Please try again.');
            setUploading(false);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setPreview(null);
        setError(null);
        setUploading(false);
        onClose();
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getFileIcon = () => {
        if (!selectedFile) return null;
        if (selectedFile.type === 'image/gif') return <Film size={24} />;
        if (selectedFile.type.startsWith('image/')) return <Image size={24} />;
        return <FileText size={24} />;
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) handleClose();
                    }}
                >
                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        style={{
                            width: '100%',
                            maxWidth: '480px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                            position: 'relative'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--glass-border)'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                                Upload File
                            </h3>
                            <button
                                onClick={handleClose}
                                className="icon-btn"
                                style={{ margin: '-8px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '20px' }}>
                            {/* Drop Zone */}
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--glass-border)'}`,
                                    borderRadius: '12px',
                                    padding: '40px 20px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    backgroundColor: dragActive ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,.txt,.md,.csv,.json,.html"
                                    onChange={handleFileInput}
                                    style={{ display: 'none' }}
                                />

                                {selectedFile ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                    >
                                        {preview ? (
                                            <img
                                                src={preview}
                                                alt="Preview"
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '200px',
                                                    borderRadius: '8px',
                                                    marginBottom: '16px',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '64px',
                                                height: '64px',
                                                backgroundColor: 'var(--bg-secondary)',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 16px',
                                                color: 'var(--accent)'
                                            }}>
                                                {getFileIcon()}
                                            </div>
                                        )}
                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                                            {selectedFile.name}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            {formatFileSize(selectedFile.size)}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <>
                                        <Upload
                                            size={48}
                                            color="var(--text-muted)"
                                            style={{ marginBottom: '16px' }}
                                        />
                                        <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                                            Drag and drop a file here
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            or click to browse
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '12px',
                                        backgroundColor: 'rgba(244, 33, 46, 0.1)',
                                        borderRadius: '8px',
                                        marginTop: '16px',
                                        color: 'var(--danger)',
                                        fontSize: '13px'
                                    }}
                                >
                                    <AlertCircle size={18} />
                                    {error}
                                </motion.div>
                            )}

                            {/* File Type Info */}
                            <div style={{
                                display: 'flex',
                                gap: '16px',
                                justifyContent: 'center',
                                marginTop: '20px',
                                padding: '12px',
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '8px'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    color: 'var(--text-muted)'
                                }}>
                                    <Image size={16} /> Images (10MB)
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    color: 'var(--text-muted)'
                                }}>
                                    <Film size={16} /> GIFs (15MB)
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    color: 'var(--text-muted)'
                                }}>
                                    <FileText size={16} /> Text/HTML (500MB)
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            padding: '16px 20px',
                            borderTop: '1px solid var(--glass-border)',
                            backgroundColor: 'var(--bg-tertiary)'
                        }}>
                            <button
                                onClick={handleClose}
                                style={{
                                    padding: '10px 20px',
                                    background: 'transparent',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading}
                                className="glossy-button"
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    opacity: (!selectedFile || uploading) ? 0.5 : 1
                                }}
                            >
                                {uploading ? (
                                    <>
                                        <Loader size={18} className="animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        Upload
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
