const glyphs = {
  play: 'M7 4 L21 12 L7 20 Z',
  pause: 'M5 4 H9 V20 H5 Z M15 4 H19 V20 H15 Z',
  sound: 'M3 9 H7 L12 5 V19 L7 15 H3 Z M16 8 Q20 12 16 16 M19 5 Q26 12 19 19',
  muted: 'M3 9 H7 L12 5 V19 L7 15 H3 Z M16 9 L22 15 M22 9 L16 15',
  expand: 'M3 9 V3 H9 M15 3 H21 V9 M21 15 V21 H15 M9 21 H3 V15',
  collapse: 'M9 3 V9 H3 M15 3 V9 H21 M21 15 H15 V21 M3 15 H9 V21',
  rewind: 'M3 4 V9 H8 M3 9 A9 9 0 1 1 7 20',
  forward: 'M21 4 V9 H16 M21 9 A9 9 0 1 0 17 20',
  settings: 'M4 6 H20 M4 12 H20 M4 18 H20 M8 4 V8 M16 10 V14 M10 16 V20',
};

export type PlayerIconName = keyof typeof glyphs;

export function PlayerIcon({ name }: { name: PlayerIconName }) {
  return (
    <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24"
      fill={name === 'play' || name === 'pause' ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={glyphs[name]} />
      {(name === 'rewind' || name === 'forward') && (
        <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">10</text>
      )}
    </svg>
  );
}
