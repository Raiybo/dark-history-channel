import { useCurrentFrame, useVideoConfig } from 'remotion';

function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export const Background = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slow color shift
  const hue = (frame / fps * 8) % 360;
  const hue2 = (hue + 140) % 360;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Deep dark base */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#080808' }} />

      {/* Slow shifting gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 30% 40%, hsla(${hue}, 80%, 15%, 0.6) 0%, transparent 60%),
                     radial-gradient(ellipse at 70% 70%, hsla(${hue2}, 80%, 12%, 0.5) 0%, transparent 55%)`
      }} />

      {/* Grid lines - subtle cyberpunk feel */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px'
      }} />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => {
        const x = seededRand(i * 3) * 100;
        const baseY = seededRand(i * 7) * 100;
        const speed = 0.3 + seededRand(i * 11) * 0.6;
        const size = 2 + seededRand(i * 5) * 3;
        const y = ((baseY - (frame * speed * 0.03)) % 110 + 110) % 110 - 5;
        const particleHue = (hue + i * 25) % 360;
        const opacity = (Math.sin(frame / fps * 1.5 + i) * 0.3 + 0.5) * 0.6;

        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: `hsl(${particleHue}, 100%, 60%)`,
            opacity,
            filter: `blur(1px)`,
            boxShadow: `0 0 ${size * 3}px hsl(${particleHue}, 100%, 60%)`
          }} />
        );
      })}

      {/* Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.85) 100%)'
      }} />
    </div>
  );
};
