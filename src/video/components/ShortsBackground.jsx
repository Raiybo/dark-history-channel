import { useCurrentFrame, useVideoConfig } from 'remotion';

function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export const ShortsBackground = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hue = (frame / fps * 12) % 360;
  const hue2 = (hue + 150) % 360;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#060606' }} />

      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse at 50% 30%, hsla(${hue}, 90%, 18%, 0.7) 0%, transparent 55%),
          radial-gradient(ellipse at 50% 80%, hsla(${hue2}, 90%, 14%, 0.5) 0%, transparent 50%)
        `
      }} />

      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px'
      }} />

      {/* Particles */}
      {Array.from({ length: 15 }).map((_, i) => {
        const x = seededRand(i * 3) * 100;
        const baseY = seededRand(i * 7) * 100;
        const speed = 0.3 + seededRand(i * 11) * 0.5;
        const size = 2 + seededRand(i * 5) * 3;
        const y = ((baseY - (frame * speed * 0.025)) % 110 + 110) % 110 - 5;
        const particleHue = (hue + i * 30) % 360;
        const opacity = (Math.sin(frame / fps * 1.2 + i) * 0.25 + 0.45) * 0.7;

        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${x}%`, top: `${y}%`,
            width: size, height: size,
            borderRadius: '50%',
            backgroundColor: `hsl(${particleHue}, 100%, 60%)`,
            opacity,
            boxShadow: `0 0 ${size * 4}px hsl(${particleHue}, 100%, 60%)`
          }} />
        );
      })}

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.8) 100%)'
      }} />
    </div>
  );
};
