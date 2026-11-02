import React, { useRef, useState } from 'react';
import './spotlight-card.css';

export default function SpotlightCard({
  as: Component = 'div',
  children,
  className = '',
  spotlightColor = 'rgba(166, 217, 237, 0.12)',
  borderColor = 'rgba(166, 217, 237, 0.45)',
  size = 280,
  onMouseEnter,
  onFocus,
  ...props
}) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState({ x: -size, y: -size, active: false });

  const onMouseMove = e => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true });
  };

  const onMouseLeave = () => {
    setPos(p => ({ ...p, active: false }));
  };

  return (
    <Component
      ref={cardRef}
      className={`spotlight-card ${className}`.trim()}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      style={{
        '--spotlight-x': `${pos.x}px`,
        '--spotlight-y': `${pos.y}px`,
        '--spotlight-color': spotlightColor,
        '--spotlight-border': borderColor,
        '--spotlight-size': `${size}px`,
        '--spotlight-opacity': pos.active ? '1' : '0'
      }}
      {...props}
    >
      <div className="spotlight-layer" aria-hidden="true" />
      {children}
    </Component>
  );
}
