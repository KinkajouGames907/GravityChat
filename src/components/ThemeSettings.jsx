import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';
import { Palette, Zap, Music, Save, RotateCcw, Upload, Play, Check } from 'lucide-react';

export default function ThemeSettings() {
    const { theme, updateTheme, resetTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('colors');
    const [localTheme, setLocalTheme] = useState(theme);
    const [hasChanges, setHasChanges] = useState(false);

    const handleColorChange = (key, value) => {
        setLocalTheme(prev => ({
            ...prev,
            colors: { ...prev.colors, [key]: value }
        }));
        setHasChanges(true);
    };

    const handleAnimationChange = (key, value) => {
        setLocalTheme(prev => ({
            ...prev,
            animations: { ...prev.animations, [key]: value }
        }));
        setHasChanges(true);
    };

    const handleParticleChange = (key, value) => {
        setLocalTheme(prev => ({
            ...prev,
            particles: { ...prev.particles, [key]: value }
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        updateTheme(localTheme);
        setHasChanges(false);
    };

    const handleReset = () => {
        if (window.confirm('Reset all theme settings to default?')) {
            resetTheme();
            setLocalTheme(theme); // Will be updated by context, but for immediate feedback
            setHasChanges(false);
        }
    };

    const tabs = [
        { id: 'colors', label: 'Colors', icon: Palette },
        { id: 'animations', label: 'Animations', icon: Zap },
        { id: 'sounds', label: 'Sounds', icon: Music },
    ];

    return (
        <div style={{ padding: '20px', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Theme & Appearance</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleReset} className="secondary-button" title="Reset to Default">
                        <RotateCcw size={18} />
                    </button>
                    <button
                        onClick={handleSave}
                        className="glossy-button"
                        disabled={!hasChanges}
                        style={{ opacity: hasChanges ? 1 : 0.5 }}
                    >
                        <Save size={18} /> Save Changes
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            background: activeTab === tab.id ? 'var(--accent-dim)' : 'transparent',
                            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 600
                        }}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ height: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                {activeTab === 'colors' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                        {Object.entries(localTheme.colors).map(([key, value]) => (
                            <div key={key} style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '12px' }}>
                                <div style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                    {key.replace('--', '').replace(/-/g, ' ')}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={value}
                                        onChange={(e) => handleColorChange(key, e.target.value)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            background: 'none'
                                        }}
                                    />
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => handleColorChange(key, e.target.value)}
                                        className="input-field"
                                        style={{ flex: 1, padding: '8px' }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'animations' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={localTheme.animations.enabled}
                                    onChange={(e) => handleAnimationChange('enabled', e.target.checked)}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                <span style={{ fontWeight: 600 }}>Enable Animations</span>
                            </label>
                        </div>

                        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px' }}>
                            <h4 style={{ marginTop: 0 }}>Particle Effects</h4>
                            <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input
                                        type="checkbox"
                                        checked={localTheme.particles.enabled}
                                        onChange={(e) => handleParticleChange('enabled', e.target.checked)}
                                    />
                                    Enable Particles
                                </label>
                                <select
                                    value={localTheme.particles.type}
                                    onChange={(e) => handleParticleChange('type', e.target.value)}
                                    className="input-field"
                                    style={{ width: 'auto' }}
                                >
                                    <option value="snow">Snow</option>
                                    <option value="rain">Rain</option>
                                    <option value="sparks">Sparks</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px' }}>
                            <h4 style={{ marginTop: 0 }}>Custom CSS Animations</h4>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Add your own CSS keyframes and classes here. They will be injected into the page.
                            </p>
                            <textarea
                                value={localTheme.animations.customCSS}
                                onChange={(e) => handleAnimationChange('customCSS', e.target.value)}
                                className="input-field"
                                style={{ height: '150px', fontFamily: 'monospace', fontSize: '13px' }}
                                placeholder="@keyframes myAnim { ... }"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'sounds' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px' }}>
                            <h4 style={{ marginTop: 0, marginBottom: '16px' }}>Custom Sounds</h4>

                            {['click', 'notification', 'ringtone'].map(type => (
                                <div key={type} style={{ marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <label style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                                            {type} Sound
                                        </label>
                                        {localTheme.sounds[type] && (
                                            <button
                                                onClick={() => {
                                                    const audio = new Audio(localTheme.sounds[type]);
                                                    audio.play().catch(e => { if (import.meta.env.DEV) console.error(e); });
                                                }}
                                                className="icon-btn"
                                                title="Preview"
                                            >
                                                <Play size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="text"
                                            value={localTheme.sounds[type] || ''}
                                            onChange={(e) => {
                                                setLocalTheme(prev => ({
                                                    ...prev,
                                                    sounds: { ...prev.sounds, [type]: e.target.value }
                                                }));
                                                setHasChanges(true);
                                            }}
                                            placeholder="https://example.com/sound.mp3"
                                            className="input-field"
                                            style={{ flex: 1 }}
                                        />
                                        <label className="secondary-button" style={{ cursor: 'pointer' }}>
                                            <Upload size={16} />
                                            <input
                                                type="file"
                                                accept="audio/*"
                                                style={{ display: 'none' }}
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (event) => {
                                                            setLocalTheme(prev => ({
                                                                ...prev,
                                                                sounds: { ...prev.sounds, [type]: event.target.result }
                                                            }));
                                                            setHasChanges(true);
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        Paste a URL or upload a file (max 1MB recommended).
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
