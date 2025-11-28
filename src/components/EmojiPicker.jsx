import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Clock, Smile, Sticker, Gift, X, Star } from 'lucide-react';
import { useEmoji } from '../context/EmojiContext';

// Comprehensive emoji data organized by category
const emojiData = {
    'Custom': [], // Will be populated dynamically
    'Recently Used': [],
    'Smileys & Emotion': [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
        '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝',
        '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
        '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
        '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟',
        '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢',
        '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
        '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺',
        '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊'
    ],
    'Gestures & People': [
        '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
        '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
        '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶',
        '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋',
        '🩸', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵'
    ],
    'Hearts & Love': [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
        '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💐', '🌹', '🥀', '🌷', '🌸',
        '💮', '🏵️', '🌻', '🌼', '💍', '👰', '🤵', '💒', '💑', '👩‍❤️‍👨', '👨‍❤️‍👨', '👩‍❤️‍👩'
    ],
    'Animals & Nature': [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷',
        '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🦍', '🦧', '🐔', '🐧', '🐦', '🐤', '🦆',
        '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞',
        '🐜', '🪳', '🪲', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🐙', '🦑', '🦐',
        '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓'
    ],
    'Food & Drink': [
        '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭',
        '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕',
        '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈',
        '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪',
        '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍜', '🍝', '🍛', '🍣', '🍱', '🥟', '🦪',
        '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧',
        '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯',
        '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹'
    ],
    'Activities': [
        '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸',
        '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋',
        '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸',
        '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵',
        '🎮', '🕹️', '🎲', '🧩', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘'
    ],
    'Objects': [
        '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾',
        '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠',
        '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡',
        '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷',
        '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️',
        '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️'
    ],
    'Symbols': [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
        '💓', '💗', '💖', '💘', '💝', '✨', '⭐', '🌟', '💫', '⚡', '🔥', '💥', '☀️',
        '🌈', '☁️', '❄️', '💧', '🌊', '🎵', '🎶', '🔔', '🔕', '📣', '📢', '💬', '💭',
        '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🔇', '🔈', '🔉', '🔊', '📳',
        '📴', '✅', '❌', '❓', '❔', '❕', '❗', '💯', '🔴', '🟠', '🟡', '🟢', '🔵',
        '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🏁'
    ],
    'Flags': [
        '🏳️', '🏴', '🏴‍☠️', '🏁', '🚩', '🎌', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺',
        '🇩🇪', '🇫🇷', '🇯🇵', '🇰🇷', '🇨🇳', '🇮🇳', '🇧🇷', '🇲🇽', '🇪🇸', '🇮🇹', '🇷🇺', '🇳🇱'
    ]
};

const categoryIcons = {
    'Custom': Star,
    'Recently Used': Clock,
    'Smileys & Emotion': Smile,
    'Gestures & People': Sticker,
    'Hearts & Love': Sticker,
    'Animals & Nature': Sticker,
    'Food & Drink': Sticker,
    'Activities': Sticker,
    'Objects': Sticker,
    'Symbols': Sticker,
    'Flags': Sticker
};

export default function EmojiPicker({ isOpen, onClose, onEmojiSelect, position = 'top', isMobile }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Smileys & Emotion');
    const [recentEmojis, setRecentEmojis] = useState(() => {
        const saved = localStorage.getItem('gravity_recent_emojis'); // Changed key to match existing logic
        return saved ? JSON.parse(saved) : [];
    });
    const [currentEmojis, setCurrentEmojis] = useState([]); // Added currentEmojis state
    const { customEmojis } = useEmoji();
    const pickerRef = useRef(null);
    const searchInputRef = useRef(null);

    // Update current emojis when category changes
    useEffect(() => {
        if (activeCategory === 'Recently Used') {
            setCurrentEmojis(recentEmojis);
        } else if (activeCategory === 'Custom') {
            setCurrentEmojis(Object.keys(customEmojis));
        } else {
            setCurrentEmojis(emojiData[activeCategory] || []);
        }
    }, [activeCategory, recentEmojis, customEmojis]);

    // Focus search input when opened
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const handleEmojiClick = (emoji) => {
        // Add to recent emojis
        const newRecent = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 20);
        setRecentEmojis(newRecent);
        localStorage.setItem('gravity_recent_emojis', JSON.stringify(newRecent));

        onEmojiSelect(emoji);
    };

    // Filter emojis based on search
    const getFilteredEmojis = () => {
        if (!searchQuery.trim()) {
            return null; // Return null to show categories
        }

        const query = searchQuery.toLowerCase();
        const results = [];

        Object.values(emojiData).forEach(emojis => {
            emojis.forEach(emoji => {
                if (!results.includes(emoji)) {
                    results.push(emoji);
                }
            });
        });

        // Simple filter - in a real app, you'd have emoji names/keywords
        return results.slice(0, 50);
    };

    const filteredEmojis = getFilteredEmojis();

    const pickerContent = (
        <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, scale: 0.9, y: isMobile ? 0 : (position === 'top' ? 10 : -10) }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: isMobile ? 0 : (position === 'top' ? 10 : -10) }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={isMobile ? {
                width: '90%',
                maxWidth: '352px',
                height: '50vh',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative'
            } : {
                position: 'absolute',
                [position]: '100%',
                right: 0,
                width: '352px',
                maxWidth: 'calc(100vw - 32px)',
                height: '420px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 1000,
                marginBottom: position === 'top' ? '8px' : 0,
                marginTop: position === 'bottom' ? '8px' : 0
            }}
        >
            {/* Search Header */}
            <div style={{
                padding: '12px',
                borderBottom: '1px solid var(--glass-border)',
                backgroundColor: 'var(--bg-tertiary)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    gap: '8px'
                }}>
                    <Search size={18} color="var(--text-muted)" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search emojis..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex'
                            }}
                        >
                            <X size={16} color="var(--text-muted)" />
                        </button>
                    )}
                </div>
            </div>

            {/* Category Tabs */}
            {!searchQuery && (
                <div style={{
                    display: 'flex',
                    padding: '8px',
                    gap: '4px',
                    borderBottom: '1px solid var(--glass-border)',
                    overflowX: 'auto',
                    flexShrink: 0
                }}>
                    {Object.keys(emojiData).map((category) => {
                        const Icon = categoryIcons[category] || Smile;
                        const isActive = activeCategory === category;
                        const isRecentEmpty = category === 'Recently Used' && recentEmojis.length === 0;

                        if (isRecentEmpty) return null;

                        return (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                title={category}
                                style={{
                                    background: isActive ? 'var(--accent-dim)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <Icon size={18} />
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Emoji Grid */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px'
            }}>
                {searchQuery && filteredEmojis ? (
                    <>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            marginBottom: '8px',
                            textTransform: 'uppercase'
                        }}>
                            Search Results
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(8, 1fr)',
                            gap: '4px'
                        }}>
                            {filteredEmojis.map((emoji, index) => (
                                <motion.button
                                    key={`${emoji} -${index} `}
                                    whileHover={{ scale: 1.2, backgroundColor: 'var(--bg-hover)' }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleEmojiClick(emoji)}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '22px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s'
                                    }}
                                >
                                    {emoji}
                                </motion.button>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            marginBottom: '8px',
                            textTransform: 'uppercase'
                        }}>
                            {activeCategory}
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(8, 1fr)',
                            gap: '4px'
                        }}>
                            {currentEmojis.map((emoji, index) => (
                                <motion.button
                                    key={`${emoji} -${index} `}
                                    whileHover={{ scale: 1.2, backgroundColor: 'var(--bg-hover)' }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleEmojiClick(emoji)}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '22px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s'
                                    }}
                                    title={emoji}
                                >
                                    {activeCategory === 'Custom' || (activeCategory === 'Recently Used' && customEmojis[emoji]) ? (
                                        <img
                                            src={customEmojis[emoji]}
                                            alt={emoji}
                                            style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                                        />
                                    ) : (
                                        emoji
                                    )}
                                </motion.button>
                            ))}
                        </div>
                        {currentEmojis.length === 0 && activeCategory === 'Recently Used' && (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px 20px',
                                color: 'var(--text-muted)'
                            }}>
                                <Clock size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                <div>No recent emojis yet</div>
                                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                    Emojis you use will appear here
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Skin Tone Selector (simplified) */}
            <div style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-tertiary)'
            }}>
                {['👋', '👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿'].map((emoji, i) => (
                    <button
                        key={i}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '18px',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px'
                        }}
                        title={`Skin tone ${i + 1} `}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </motion.div>
    );

    if (isMobile) {
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
                            if (e.target === e.currentTarget) onClose();
                        }}
                    >
                        {pickerContent}
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body
        );
    }

    return (
        <AnimatePresence>
            {isOpen && pickerContent}
        </AnimatePresence>
    );
}
