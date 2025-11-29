import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ParticleEffects() {
    const { theme } = useTheme();
    const canvasRef = useRef(null);
    const requestRef = useRef();
    const particlesRef = useRef([]);

    useEffect(() => {
        if (!theme.particles.enabled) {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Initialize particles
        const createParticle = () => {
            const type = theme.particles.type;
            const x = Math.random() * canvas.width;
            let y, speed, size, color;

            if (type === 'snow') {
                y = -10;
                speed = Math.random() * 2 + 1;
                size = Math.random() * 3 + 1;
                color = 'rgba(255, 255, 255, 0.8)';
            } else if (type === 'rain') {
                y = -20;
                speed = Math.random() * 10 + 15;
                size = Math.random() * 2 + 1; // length
                color = 'rgba(174, 194, 224, 0.6)';
            } else if (type === 'sparks') {
                y = canvas.height + 10;
                speed = Math.random() * 5 + 2;
                size = Math.random() * 3 + 1;
                color = `rgba(255, ${Math.random() * 100 + 100}, 0, ${Math.random()})`;
            }

            return { x, y, speed, size, color, type };
        };

        const particleCount = theme.particles.intensity || 50;
        particlesRef.current = Array.from({ length: particleCount }, createParticle);

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particlesRef.current.forEach((p, index) => {
                ctx.fillStyle = p.color;
                ctx.beginPath();

                if (p.type === 'snow') {
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    p.y += p.speed;
                    p.x += Math.sin(p.y * 0.01) * 0.5;

                    if (p.y > canvas.height) {
                        particlesRef.current[index] = createParticle();
                    }
                } else if (p.type === 'rain') {
                    ctx.fillRect(p.x, p.y, 1, p.size * 5);
                    p.y += p.speed;

                    if (p.y > canvas.height) {
                        particlesRef.current[index] = createParticle();
                    }
                } else if (p.type === 'sparks') {
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    p.y -= p.speed;
                    p.x += (Math.random() - 0.5) * 2;
                    p.size *= 0.95;

                    if (p.y < 0 || p.size < 0.1) {
                        particlesRef.current[index] = createParticle();
                    }
                }

                ctx.fill();
            });

            requestRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(requestRef.current);
        };
    }, [theme.particles]);

    if (!theme.particles.enabled) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 9999 // Very high z-index but below modals if needed, adjust as necessary
            }}
        />
    );
}
