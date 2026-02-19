import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

export default function AppLoader({ show }) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key="splash"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.04 }}
                    transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'radial-gradient(ellipse at 30% 20%, rgba(168,85,247,0.25), transparent 55%), radial-gradient(ellipse at 75% 80%, rgba(236,72,153,0.18), transparent 55%), #06040f',
                        overflow: 'hidden',
                    }}
                >
                    {/* Animated nebula orbs */}
                    <motion.div
                        animate={{ x: [0, 60, -20, 0], y: [0, -30, 50, 0], scale: [1, 1.2, 0.9, 1] }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                            position: 'absolute',
                            width: '500px', height: '500px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(168,85,247,0.35), transparent 70%)',
                            filter: 'blur(60px)',
                            top: '-100px', left: '-100px',
                            pointerEvents: 'none',
                        }}
                    />
                    <motion.div
                        animate={{ x: [0, -50, 30, 0], y: [0, 40, -40, 0], scale: [1, 0.85, 1.15, 1] }}
                        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                            position: 'absolute',
                            width: '450px', height: '450px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(236,72,153,0.28), transparent 70%)',
                            filter: 'blur(70px)',
                            bottom: '-80px', right: '-80px',
                            pointerEvents: 'none',
                        }}
                    />
                    <motion.div
                        animate={{ x: [0, 30, -40, 0], y: [0, -60, 20, 0], scale: [1, 1.1, 0.92, 1] }}
                        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                        style={{
                            position: 'absolute',
                            width: '300px', height: '300px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent 70%)',
                            filter: 'blur(50px)',
                            top: '60%', left: '20%',
                            pointerEvents: 'none',
                        }}
                    />

                    {/* Rotating rings */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                        style={{
                            position: 'absolute',
                            width: '500px', height: '500px',
                            borderRadius: '50%',
                            border: '1px solid rgba(168,85,247,0.15)',
                        }}
                    />
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
                        style={{
                            position: 'absolute',
                            width: '360px', height: '360px',
                            borderRadius: '50%',
                            border: '1px dashed rgba(236,72,153,0.12)',
                        }}
                    />

                    {/* Logo + brand */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.7, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', zIndex: 1 }}
                    >
                        {/* Icon */}
                        <motion.div
                            animate={{ boxShadow: ['0 0 30px rgba(168,85,247,0.5)', '0 0 60px rgba(168,85,247,0.8)', '0 0 30px rgba(168,85,247,0.5)'] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                                width: '88px', height: '88px',
                                borderRadius: '28px',
                                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 30px rgba(168,85,247,0.5)',
                            }}
                        >
                            <MessageCircle size={44} color="white" strokeWidth={2} />
                        </motion.div>

                        {/* Brand name */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                            style={{ textAlign: 'center' }}
                        >
                            <h1 style={{
                                margin: 0,
                                fontSize: '2.4rem',
                                fontWeight: 800,
                                fontFamily: 'Space Grotesk, sans-serif',
                                letterSpacing: '-0.02em',
                                background: 'linear-gradient(135deg, #c084fc, #ec4899)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>
                                GravityChat
                            </h1>
                            <p style={{ margin: '6px 0 0', color: 'rgba(176,160,204,0.7)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>
                                Loading your universe...
                            </p>
                        </motion.div>

                        {/* Progress bar */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            style={{
                                width: '200px', height: '3px',
                                borderRadius: '9999px',
                                background: 'rgba(168,85,247,0.15)',
                                overflow: 'hidden',
                            }}
                        >
                            <motion.div
                                initial={{ x: '-100%' }}
                                animate={{ x: '100%' }}
                                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
                                style={{
                                    height: '100%',
                                    width: '50%',
                                    background: 'linear-gradient(90deg, transparent, #a855f7, #ec4899, transparent)',
                                    borderRadius: '9999px',
                                }}
                            />
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
