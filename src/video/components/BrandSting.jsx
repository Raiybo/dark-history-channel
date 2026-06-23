import { useCurrentFrame, interpolate, spring, Img, staticFile } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();

// Branded entrance for every reel. ~1s sting where the logo slams down,
// sweeps a quick white flash across the channel wordmark, then shrinks up to
// settle into the persistent top watermark position. Gives every video the
// same recognizable opening beat without delaying the audio.
export const STING_FRAMES = 30;

export const BrandSting = ({ accent = '#FFC83D', logo = null, channelName = 'DID YOU KNOW' }) => {
  const frame = useCurrentFrame();

  // Logo drops in (spring) for the first 10 frames, holds 10-20, then shrinks
  // and lifts to the watermark position (frames 20-30).
  const dropIn = spring({ frame, fps: 30, config: { damping: 12, stiffness: 240, mass: 0.6 } });
  const settle = interpolate(frame, [20, STING_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Big -> watermark size (190 -> 150) and centered -> top.
  const size = interpolate(settle, [0, 1], [320, 150]);
  const topPx = interpolate(settle, [0, 1], [520, 72]);
  const logoOpacity = interpolate(settle, [0, 1], [1, 0.55]);

  const dropTranslate = interpolate(dropIn, [0, 1], [-160, 0]);
  const containerOpacity = interpolate(frame, [0, 3, STING_FRAMES - 2, STING_FRAMES], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // White sweep across the wordmark (left -> right) at frames 6-16.
  const sweepX = interpolate(frame, [6, 16], [-120, 220], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const sweepOpacity = interpolate(frame, [6, 9, 14, 16], [0, 0.9, 0.9, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const wordmarkOpacity = interpolate(frame, [4, 12, 22, STING_FRAMES], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const wordmarkY = interpolate(settle, [0, 1], [0, -40]);

  // Glow on accent — pulses during the hold.
  const glow = interpolate(frame, [0, 10, 22, STING_FRAMES], [0.3, 1.0, 0.7, 0.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none',
      opacity: containerOpacity,
      zIndex: 50,
    }}>
      {/* Dim flash backdrop (only during the first half of the sting). */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 28%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.10) 60%)',
        opacity: interpolate(frame, [0, 6, 18, STING_FRAMES], [0.9, 0.7, 0.3, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        }),
      }} />

      <div style={{
        position: 'absolute',
        left: 0, right: 0,
        top: topPx,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        transform: `translateY(${dropTranslate}px)`,
      }}>
        {logo ? (
          <Img
            src={staticFile(logo)}
            style={{
              width: size,
              height: size,
              objectFit: 'contain',
              opacity: logoOpacity,
              filter: `drop-shadow(0 3px 12px rgba(0,0,0,0.8)) drop-shadow(0 0 ${24 * glow}px ${accent})`,
            }}
          />
        ) : (
          <div style={{
            fontFamily,
            fontSize: interpolate(settle, [0, 1], [80, 30]),
            fontWeight: 900,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: accent,
            textShadow: `0 0 ${30 * glow}px ${accent}, 0 4px 28px rgba(0,0,0,0.9)`,
          }}>
            {channelName}
          </div>
        )}

        {/* Wordmark + accent underline + sweep — only visible during the sting. */}
        <div style={{
          position: 'relative',
          opacity: wordmarkOpacity,
          transform: `translateY(${wordmarkY}px)`,
          padding: '6px 18px',
          overflow: 'hidden',
        }}>
          <div style={{
            fontFamily,
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: 8,
            textTransform: 'uppercase',
            color: '#FFFFFF',
            textShadow: '0 4px 24px rgba(0,0,0,0.95)',
          }}>
            {channelName}
          </div>
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 80,
            height: 3,
            backgroundColor: accent,
            boxShadow: `0 0 ${16 * glow}px ${accent}`,
            borderRadius: 2,
          }} />
          {/* Quick white sweep */}
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0,
            left: `${sweepX}%`,
            width: '40%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%)',
            opacity: sweepOpacity,
            filter: 'blur(6px)',
            mixBlendMode: 'screen',
          }} />
        </div>
      </div>
    </div>
  );
};
