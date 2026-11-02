import React, { useEffect, useRef, useState } from 'react';
import './mascot.css';
const faces = ['idle', 'happy', 'curious', 'surprised', 'sleepy', 'wave'];
const labels = { idle: 'на связи', blink: 'моргает', happy: 'радуется', curious: 'интересуется', surprised: 'удивлён', sleepy: 'отдыхает', walk: 'гуляет', wave: 'машет' };
const width = 144;
const limit = () => Math.max(8, window.innerWidth - width - 8);
export default function Mascot({ projectSignal = 0, driveMode = false, onDriveChange }) {
  const [driving, setDriving] = useState(driveMode);
  const [y, setY] = useState(0);
  const vy = useRef(0);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [x, setX] = useState(() => limit());
  const [face, setFace] = useState('idle');
  const [moving, setMoving] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(document.hidden);
  const cycle = useRef(0);
  const reactionTimer = useRef(null);
  const walkTimer = useRef(null);
  const finishTimer = useRef(null);
  const stopped = paused || hovered || focused || reduced || hidden || documentHidden || driving;
  const cancelReaction = () => { window.clearTimeout(reactionTimer.current); reactionTimer.current = null; window.clearInterval(walkTimer.current); window.clearTimeout(finishTimer.current); };
  function react(next) {
    cancelReaction();
    setMoving(false);
    setFace(next);
    // Explicit interactions may change a still image even with reduced motion.
    reactionTimer.current = window.setTimeout(() => { setFace('idle'); reactionTimer.current = null; }, 2400);
  }
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media?.matches ?? false);
    const resize = () => setX(value => Math.min(value, limit()));
    const visibility = () => setDocumentHidden(document.hidden);
    media?.addEventListener?.('change', change);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      media?.removeEventListener?.('change', change);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      cancelReaction();
    };
  }, []);
  useEffect(() => {
    if (stopped) { setMoving(false); setFace(current => ['blink', 'walk'].includes(current) ? 'idle' : current); return; }
    let blink;
    const tick = window.setInterval(() => {
      cancelReaction();
      const next = Math.random();
      if (next < .45) {
        const direction = Math.random() > .5 ? 1 : -1;
        walkTimer.current = window.setInterval(() => setX(old => Math.max(8, Math.min(limit(), old + direction * 4))), 80);
        setMoving(true); setFace('walk');
      } else { setFace(faces[Math.floor(Math.random() * faces.length)]); }
      finishTimer.current = window.setTimeout(() => { window.clearInterval(walkTimer.current); setMoving(false); setFace('idle'); }, 3000);
    }, 12000);
    const blinker = window.setInterval(() => {
      setFace(current => current === 'idle' ? 'blink' : current);
      blink = window.setTimeout(() => setFace(current => current === 'blink' ? 'idle' : current), 160);
    }, 5100);
    return () => { window.clearInterval(tick); window.clearInterval(blinker); window.clearTimeout(finishTimer.current); window.clearTimeout(blink); window.clearInterval(walkTimer.current); };
  }, [stopped]);
  useEffect(() => { if (projectSignal && !hidden && !paused) react('curious'); }, [projectSignal]);
  useEffect(() => { if (paused || hidden || reduced) { cancelReaction(); setFace('idle'); setDriving(false); } }, [paused, hidden, reduced]);
  useEffect(() => { if (driveMode !== undefined) setDriving(driveMode); }, [driveMode]);

  useEffect(() => {
    if (!driving) return;
    let animId;
    const keys = new Set();

    const onKeyDown = e => {
      keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (y === 0) {
          vy.current = -12;
          setFace('surprised');
        }
      }
      if (e.code === 'Escape') {
        setDriving(false);
        onDriveChange?.(false);
      }
    };

    const onKeyUp = e => {
      keys.delete(e.code);
      if (!keys.has('KeyA') && !keys.has('KeyD') && !keys.has('ArrowLeft') && !keys.has('ArrowRight') && y === 0) {
        setFace('idle');
      }
    };

    const loop = () => {
      let dx = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 6;
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 6;
      if (dx !== 0) {
        setX(old => Math.max(8, Math.min(limit(), old + dx)));
        if (y === 0) setFace('walk');
      }

      if (y < 0 || vy.current !== 0) {
        vy.current += 0.9;
        setY(old => {
          const next = old + vy.current;
          if (next >= 0) {
            vy.current = 0;
            setFace(dx !== 0 ? 'walk' : 'happy');
            return 0;
          }
          return next;
        });
      }

      animId = window.requestAnimationFrame(loop);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    animId = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.cancelAnimationFrame(animId);
      setY(0);
      vy.current = 0;
    };
  }, [driving, y, onDriveChange]);
  if (hidden) return <button className="mascot-restore" onClick={() => { setHidden(false); setHovered(false); setFocused(false); setFace('idle'); }} aria-label="Показать робота 0n26">0n26 <span aria-hidden="true">↗</span></button>;
  return <aside className={`mascot ${moving && !stopped ? 'mascot-moving' : ''} ${driving ? 'mascot-driving' : ''}`} style={{ left: x, transform: y ? `translateY(${y}px)` : undefined }} aria-label="Мини-робот 0n26" data-face={face} data-paused={stopped} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {driving && <div className="mascot-drive-hud" aria-live="polite">WASD: движение · Пробел: прыжок · Esc: на базу</div>}
    <button className="mascot-character" onClick={() => react(faces[(++cycle.current) % faces.length])} aria-label={`Робот 0n26: ${labels[face]}. Нажмите, чтобы сменить эмоцию`} title="0n26 · сменить эмоцию">
      <img src={`${import.meta.env.BASE_URL}assets/mascot/${face}.svg`} width="96" height="112" alt="" draggable="false" />
    </button>
    <div className="mascot-controls">
      <button onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? 'Продолжить анимацию робота' : 'Приостановить анимацию робота'} title={paused ? 'Продолжить' : 'Пауза'}>{paused ? '▶' : 'Ⅱ'}</button>
      <button onClick={() => { const next = !driving; setDriving(next); onDriveChange?.(next); }} aria-pressed={driving} aria-label={driving ? 'Вернуть робота на базу' : 'Управление роботом'} title={driving ? 'На базу (Esc)' : 'Управление'}>{driving ? '🛑' : '🎮'}</button>
      <span aria-hidden="true">0n26</span>
      <button onClick={() => setHidden(true)} aria-label="Скрыть робота" title="Скрыть">×</button>
    </div>
  </aside>;
}
