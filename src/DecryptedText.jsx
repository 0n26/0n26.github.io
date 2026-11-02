import React, { useState, useEffect, useRef } from 'react';

const DEFAULT_CHARS = '0123456789_/#<>[]*+=~-';

export default function DecryptedText({
  text = '',
  speed = 35,
  maxIterations = 8,
  characters = DEFAULT_CHARS,
  className = '',
  scrambleColor = '#a6d9ed',
  animateOn = 'hover',
  as: Component = 'span',
  ...props
}) {
  const [displayText, setDisplayText] = useState(text);
  const [scrambling, setScrambling] = useState(false);
  const intervalRef = useRef(null);
  const iterationRef = useRef(0);

  const startAnimation = () => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      return;
    }
    clearInterval(intervalRef.current);
    iterationRef.current = 0;
    setScrambling(true);

    intervalRef.current = setInterval(() => {
      iterationRef.current += 1;
      const progress = iterationRef.current;

      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < progress / 1.5) return char;
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('')
      );

      if (iterationRef.current >= text.length * 1.5 + maxIterations) {
        clearInterval(intervalRef.current);
        setDisplayText(text);
        setScrambling(false);
      }
    }, speed);
  };

  useEffect(() => {
    setDisplayText(text);
    return () => clearInterval(intervalRef.current);
  }, [text]);

  const handleMouseEnter = () => {
    if (animateOn === 'hover' || animateOn === 'both') {
      startAnimation();
    }
  };

  return (
    <Component
      className={`decrypted-text ${className}`.trim()}
      onMouseEnter={handleMouseEnter}
      style={{
        color: scrambling ? scrambleColor : undefined,
        fontVariantNumeric: 'tabular-nums',
        transition: 'color 0.2s ease'
      }}
      {...props}
    >
      {displayText}
    </Component>
  );
}
