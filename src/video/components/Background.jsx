import { useCurrentFrame, useVideoConfig } from 'remotion';

// Deterministic pseudo-random seeded by index
function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const EMBER_COUNT = 25;

export const Background = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Base gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 60%, #180a06 0%, #0d0404 55%, #040101 100%)'
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)'
      }} />

      {/* Floating embers */}
      {Array.from({ length: EMBER_COUNT }).map((_, i) => {
        const x = seededRand(i * 3) * 100;
        const baseY = seededRand(i * 7) * 100;
        const speed = 0.4 + seededRand(i * 11) * 0.8;
        const size = 1 + seededRand(i * 5) * 2;
        const y = ((baseY - (frame * speed * 0.04)) % 110 + 110) % 110 - 5;
        const sway = Math.sin(frame / fps * 0.8 + i) * 1.5;
        const opacity = (Math.sin(frame / fps * 1.2 + i * 2) * 0.3 + 0.4) * 0.5;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x + sway}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: i % 3 === 0 ? '#c9a84c' : '#8b3a1a',
              opacity,
              filter: `blur(${size > 2 ? 1 : 0}px)`
            }}
          />
        );
      })}

      {/* Subtle horizontal scan line texture */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 4px)',
        pointerEvents: 'none'
      }} />
    </div>
  );
};
