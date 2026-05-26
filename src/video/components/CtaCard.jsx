import { useCurrentFrame, interpolate, spring } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();

export const CtaCard = ({ accent = '#FFC83D' }) => {
  const frame = useCurrentFrame();

  const slideUp = spring({
    frame,
    fps: 30,
    config: { damping: 18, stiffness: 220, mass: 0.7 },
  });
  const translateY = interpolate(slideUp, [0, 1], [120, 0]);
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // Pulse glow on the accent bar
  const glow = 0.7 + Math.sin((frame / 30) * Math.PI * 1.5) * 0.3;

  return (
    <div style={{
      position: 'absolute',
      bottom: 160,
      left: 0,
      right: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      transform: `translateY(${translateY}px)`,
      opacity,
      pointerEvents: 'none',
    }}>
      {/* Accent bar */}
      <div style={{
        width: 56,
        height: 4,
        borderRadius: 2,
        backgroundColor: accent,
        boxShadow: `0 0 ${16 * glow}px ${accent}, 0 0 ${32 * glow}px ${accent}88`,
      }} />

      {/* Main CTA */}
      <div style={{
        fontFamily,
        fontSize: 52,
        fontWeight: 900,
        letterSpacing: -1,
        textTransform: 'uppercase',
        color: '#FFFFFF',
        textShadow: '0 2px 24px rgba(0,0,0,1)',
        textAlign: 'center',
        lineHeight: 1.1,
      }}>
        Follow <span style={{ color: accent }}>+</span> Like
      </div>

      {/* Subtext */}
      <div style={{
        fontFamily,
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.75)',
        textShadow: '0 2px 12px rgba(0,0,0,0.9)',
        textAlign: 'center',
      }}>
        For your daily did you know
      </div>
    </div>
  );
};
