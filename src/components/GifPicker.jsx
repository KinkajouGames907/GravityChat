import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, Loader } from 'lucide-react';

// Popular GIF categories with curated selections
const TRENDING_GIFS = [
    { id: 1, url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', title: 'Thumbs Up' },
    { id: 2, url: 'https://media.giphy.com/media/3o7TKU8RvQuomFfUUU/giphy.gif', title: 'Applause' },
    { id: 3, url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', title: 'Mind Blown' },
    { id: 4, url: 'https://media.giphy.com/media/l41lGvinEgARjB2HC/giphy.gif', title: 'Dancing' },
    { id: 5, url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', title: 'Excited' },
    { id: 6, url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', title: 'Laughing' },
    { id: 7, url: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif', title: 'Cat' },
    { id: 8, url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif', title: 'Dog' },
    { id: 9, url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', title: 'Celebration' },
    { id: 10, url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', title: 'Cute' },
    { id: 11, url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', title: 'Cat typing' },
    { id: 12, url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif', title: 'Sassy' },
];

const GIF_CATEGORIES = {
    'Reactions': [
        { id: 'r1', url: 'https://media.giphy.com/media/3o7TKU8RvQuomFfUUU/giphy.gif', title: 'Applause' },
        { id: 'r2', url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', title: 'Mind Blown' },
        { id: 'r3', url: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif', title: 'Cat' },
        { id: 'r4', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', title: 'Thumbs Up' },
        { id: 'r5', url: 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif', title: 'OK' },
        { id: 'r6', url: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif', title: 'Shrug' },
    ],
    'Happy': [
        { id: 'h1', url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', title: 'Laughing' },
        { id: 'h2', url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', title: 'Excited' },
        { id: 'h3', url: 'https://media.giphy.com/media/l41lGvinEgARjB2HC/giphy.gif', title: 'Dancing' },
        { id: 'h4', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', title: 'Celebration' },
        { id: 'h5', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', title: 'Cute' },
        { id: 'h6', url: 'https://media.giphy.com/media/UO5elnTqo4vSg/giphy.gif', title: 'Joy' },
    ],
    'Sad': [
        { id: 's1', url: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif', title: 'Crying' },
        { id: 's2', url: 'https://media.giphy.com/media/3o6wrvdHFbwBrUFenu/giphy.gif', title: 'Sad Cat' },
        { id: 's3', url: 'https://media.giphy.com/media/3oz8xLlw6GHVfokaNW/giphy.gif', title: 'Rain' },
        { id: 's4', url: 'https://media.giphy.com/media/l41lZxzroU33typuU/giphy.gif', title: 'Disappointed' },
    ],
    'Love': [
        { id: 'l1', url: 'https://media.giphy.com/media/l4pTdcifPZLpDjL1e/giphy.gif', title: 'Heart' },
        { id: 'l2', url: 'https://media.giphy.com/media/26FLdmIp6wJr91JAI/giphy.gif', title: 'Love' },
        { id: 'l3', url: 'https://media.giphy.com/media/3o7TKoWXm3okO1kgHC/giphy.gif', title: 'Kiss' },
        { id: 'l4', url: 'https://media.giphy.com/media/l0ExbnGIX9sMFS7PG/giphy.gif', title: 'Hug' },
    ],
    'Animals': [
        { id: 'a1', url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif', title: 'Dog' },
        { id: 'a2', url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', title: 'Cat' },
        { id: 'a3', url: 'https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif', title: 'Bunny' },
        { id: 'a4', url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif', title: 'Panda' },
    ],
    'Memes': [
        { id: 'm1', url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif', title: 'Sassy' },
        { id: 'm2', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif', title: 'This is fine' },
        { id: 'm3', url: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif', title: 'Cat typing' },
        { id: 'm4', url: 'https://media.giphy.com/media/3o7aCWJavAgtBzLWrS/giphy.gif', title: 'Deal with it' },
    ]
};

export default function GifPicker({ isOpen, onClose, onGifSelect, position = 'top' }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Trending');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [recentGifs, setRecentGifs] = useState([]);
    const pickerRef = useRef(null);
    const searchInputRef = useRef(null);

    // Load recent GIFs from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('gravity_recent_gifs');
        if (stored) {
            setRecentGifs(JSON.parse(stored));
        }
    }, [isOpen]);

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

    // Simulated search - in production, you'd use Tenor/Giphy API
    const searchGifs = useCallback((query) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);

        // Simulate API delay
        setTimeout(() => {
            // Filter from all categories based on query
            const allGifs = [
                ...TRENDING_GIFS,
                ...Object.values(GIF_CATEGORIES).flat()
            ];

            const filtered = allGifs.filter(gif =>
                gif.title.toLowerCase().includes(query.toLowerCase())
            );

            // Remove duplicates
            const unique = filtered.filter((gif, index, self) =>
                index === self.findIndex(g => g.url === gif.url)
            );

            setSearchResults(unique.length > 0 ? unique : TRENDING_GIFS.slice(0, 6));
            setIsSearching(false);
        }, 300);
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            searchGifs(searchQuery);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, searchGifs]);

    const handleGifClick = (gif) => {
        // Add to recent GIFs
        const newRecent = [gif, ...recentGifs.filter(g => g.url !== gif.url)].slice(0, 10);
        setRecentGifs(newRecent);
        localStorage.setItem('gravity_recent_gifs', JSON.stringify(newRecent));

        onGifSelect(gif.url);
        onClose();
    };

    const getCurrentGifs = () => {
        if (searchQuery) return searchResults;
        if (activeCategory === 'Trending') return TRENDING_GIFS;
        if (activeCategory === 'Recent') return recentGifs;
        return GIF_CATEGORIES[activeCategory] || [];
    };

    const currentGifs = getCurrentGifs();

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={pickerRef}
                    initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? 10 : -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: position === 'top' ? 10 : -10 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    style={{
                        position: 'absolute',
                        [position]: '100%',
                        right: 0,
                        width: '420px',
                        maxWidth: 'calc(100vw - 32px)',
                        height: '450px',
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
                            padding: '10px 12px',
                            gap: '8px'
                        }}>
                            <Search size={18} color="var(--text-muted)" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search GIFs..."
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
                            padding: '8px 12px',
                            gap: '8px',
                            borderBottom: '1px solid var(--glass-border)',
                            overflowX: 'auto',
                            flexShrink: 0
                        }}>
                            {['Trending', ...(recentGifs.length > 0 ? ['Recent'] : []), ...Object.keys(GIF_CATEGORIES)].map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    style={{
                                        background: activeCategory === category ? 'var(--accent)' : 'var(--bg-tertiary)',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '6px 12px',
                                        cursor: 'pointer',
                                        color: activeCategory === category ? 'white' : 'var(--text-secondary)',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    {category === 'Trending' && <TrendingUp size={14} />}
                                    {category}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* GIF Grid */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '12px'
                    }}>
                        {isSearching ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '200px',
                                color: 'var(--text-muted)'
                            }}>
                                <Loader size={24} className="animate-spin" />
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '8px'
                            }}>
                                {currentGifs.map((gif, index) => (
                                    <motion.button
                                        key={gif.id || index}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleGifClick(gif)}
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: 0,
                                            cursor: 'pointer',
                                            overflow: 'hidden',
                                            aspectRatio: '16/12',
                                            position: 'relative'
                                        }}
                                    >
                                        <img
                                            src={gif.url}
                                            alt={gif.title}
                                            loading="lazy"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            padding: '20px 8px 6px',
                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                            fontSize: '11px',
                                            color: 'white',
                                            textAlign: 'left'
                                        }}>
                                            {gif.title}
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        )}

                        {!isSearching && currentGifs.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px 20px',
                                color: 'var(--text-muted)'
                            }}>
                                {activeCategory === 'Recent' ? (
                                    <>
                                        <div style={{ marginBottom: '8px' }}>No recent GIFs</div>
                                        <div style={{ fontSize: '12px' }}>
                                            GIFs you use will appear here
                                        </div>
                                    </>
                                ) : (
                                    <div>No GIFs found</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Powered By */}
                    <div style={{
                        padding: '8px 12px',
                        borderTop: '1px solid var(--glass-border)',
                        textAlign: 'center',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-tertiary)'
                    }}>
                        GIFs powered by GIPHY
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
