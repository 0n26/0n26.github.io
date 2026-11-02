import React, { useEffect, useRef } from 'react';

export default function ClickSpark({
  sparkColor = ['#a6d9ed', '#f0eee7'],
  sparkCount = 8,
  sparkSize = 10,
  sparkRadius = 24,
  duration = 400
}) {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && /jsdom/i.test(window.navigator?.userAgent)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = Array.isArray(sparkColor) ? sparkColor : [sparkColor];

    const createSparks = (x, y) => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
      const now = performance.now();
      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.5;
        const speed = sparkRadius * (0.7 + Math.random() * 0.6);
        sparksRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: sparkSize * (0.6 + Math.random() * 0.5),
          color: colors[Math.floor(Math.random() * colors.length)],
          startTime: now,
          life: duration * (0.8 + Math.random() * 0.4)
        });
      }
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(animate);
      }
    };

    const animate = now => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sparks = sparksRef.current;
      const alive = [];

      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        const elapsed = now - s.startTime;
        const progress = elapsed / s.life;

        if (progress < 1) {
          alive.push(s);
          const ease = 1 - Math.pow(1 - progress, 3);
          const px = s.x + s.vx * ease;
          const py = s.y + s.vy * ease;
          const alpha = 1 - progress;
          const len = s.size * (1 - progress * 0.7);

          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + (s.vx / sparkRadius) * len, py + (s.vy / sparkRadius) * len);
          ctx.stroke();
          ctx.restore();
        }
      }

      sparksRef.current = alive;

      if (alive.length > 0) {
        rafRef.current = window.requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    };

    const onPointerDown = e => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      createSparks(e.clientX, e.clientY);
    };

    window.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onPointerDown);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [sparkColor, sparkCount, sparkSize, sparkRadius, duration]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2147483646
      }}
      aria-hidden="true"
    />
  );
}
