import { useCurrentFrame, interpolate, spring } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

export const HOOK_FRAMES = 150;

const { fontFamily } = loadFont();

const GENRE_ACCENT = {
  money:    '#00D97E',
  future:   '#00C8FF',
  optimize: '#F5A623',
};

export const HookScene = ({ hookText, genre }) => {
  const frame = useCurrentFrame();
  const accent = GENRE_ACCENT[genre] || GENRE_ACCENT.money;
  const words = (hookText || '').split(' ');

  // Quick flash-in from black on the very first frames
  const flashIn = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });

  // Fade out near the end
  const fadeOut = interpolate(
    frame,
    [HOOK_FRAMES - 18, HOOK_FRAMES],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const containerOpacity = Math.min(flashIn, fadeOut);

  // Pulsing glow on the accent word (peaks at frame 60)
  const glowPulse = interpolate(
    frame,
    [30, 60, 90, HOOK_FRAMES - 20],
    [0.6, 1.0, 0.7, 0.5],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.10) 40%, rgba(0,0,0,0.10) 60%, rgba(0,0,0,0.85) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 52px',
      opacity: containerOpacity,
    }}>
      <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
        {words.map((word, i) => {
          // Each word slams in earlier and harder
          const delay = i * 7;
          const wordSpring = spring({
            frame: Math.max(0, frame - delay),
            fps: 30,
            config: { damping: 10, stiffness: 300, mass: 0.6 },
          });
          const wordOpacity = interpolate(
            frame,
            [delay, delay + 8],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // Every 3rd word (index 1, 4, 7…) gets the accent treatment
          const isAccented = i % 3 === 1;

          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: 10,
                marginBottom: 10,
                fontFamily,
                fontSize: 96,
                fontWeight: 900,
                letterSpacing: -2,
                textTransform: 'uppercase',
                transform: `scale(${0.55 + wordSpring * 0.45}) translateY(${(1 - wordSpring) * 20}px)`,
                opacity: wordOpacity,
                ...(isAccented ? {
                  backgroundColor: accent,
                  color: '#000',
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 2,
                  paddingBottom: 6,
                  boxShadow: `0 0 ${40 * glowPulse}px ${accent}, 0 0 ${80 * glowPulse}px ${accent}88`,
                } : {
                  color: '#FFFFFF',
                  textShadow: '0 3px 30px rgba(0,0,0,1), 0 0 60px rgba(0,0,0,0.9)',
                }),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Thin accent line that draws in under the text */}
      <div style={{
        position: 'absolute',
        bottom: '38%',
        left: '50%',
        transform: 'translateX(-50%)',
        height: 3,
        backgroundColor: accent,
        width: `${interpolate(frame, [20, 80], [0, 60], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`,
        opacity: 0.7,
        borderRadius: 2,
      }} />
    </div>
  );
};
