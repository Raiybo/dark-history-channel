import { useCurrentFrame, interpolate, spring, Img, staticFile } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();

// End-of-reel subscribe card: logo + "Follow Distoir". The logo only renders if
// a logo file was provided (renderer passes the prop only when public/logo.png
// exists), so renders never break when it's absent.
export const CtaCard = ({ accent = '#FFC83D', logo = null }) => {
  const frame = useCurrentFrame();

  const slideUp = spring({ frame, fps: 30, config: { damping: 18, stiffness: 220, mass: 0.7 } });
  const translateY = interpolate(slideUp, [0, 1], [120, 0]);
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const glow = 0.7 + Math.sin((frame / 30) * Math.PI * 1.5) * 0.3;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      transform: `translateY(${translateY}px)`,
      opacity,
      pointerEvents: 'none',
    }}>
      {logo && (
        <Img
          src={staticFile(logo)}
          style={{
            width: 140,
            height: 140,
            objectFit: 'contain',
            borderRadius: 28,
            filter: `drop-shadow(0 0 ${20 * glow}px ${accent})`,
          }}
        />
      )}

      {/* Main CTA */}
      <div style={{
        fontFamily,
        fontSize: 66,
        fontWeight: 900,
        letterSpacing: -1,
        textTransform: 'uppercase',
        color: '#FFFFFF',
        textShadow: '0 2px 24px rgba(0,0,0,1)',
        textAlign: 'center',
        lineHeight: 1.05,
      }}>
        Follow <span style={{ color: accent }}>Distoir</span>
      </div>

      {/* Accent bar */}
      <div style={{
        width: 56,
        height: 4,
        borderRadius: 2,
        backgroundColor: accent,
        boxShadow: `0 0 ${16 * glow}px ${accent}, 0 0 ${32 * glow}px ${accent}88`,
      }} />

      {/* Subtext */}
      <div style={{
        fontFamily,
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.8)',
        textShadow: '0 2px 12px rgba(0,0,0,0.9)',
        textAlign: 'center',
      }}>
        New facts every day
      </div>
    </div>
  );
};
