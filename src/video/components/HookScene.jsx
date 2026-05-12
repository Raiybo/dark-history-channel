import { useCurrentFrame, interpolate, spring } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

export const HOOK_FRAMES = 150;

const { fontFamily } = loadFont();

const GENRE_ACCENT = {
  future:   '#00C8FF',
  optimize: '#F5A623',
};

export const HookScene = ({ hookText, genre }) => {
  const frame = useCurrentFrame();
  const accent = GENRE_ACCENT[genre] || GENRE_ACCENT.future;
  const words = (hookText || '').split(' ');

  const containerOpacity = interpolate(
    frame,
    [0, 12, HOOK_FRAMES - 18, HOOK_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.08) 60%, rgba(0,0,0,0.80) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 56px',
      opacity: containerOpacity,
    }}>
      <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
        {words.map((word, i) => {
          const delay = i * 9;
          const wordScale = spring({
            frame: Math.max(0, frame - delay),
            fps: 30,
            config: { damping: 13, stiffness: 260 },
          });
          const wordOpacity = interpolate(
            frame,
            [delay, delay + 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
          const isAccented = i % 3 === 1;

          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: 10,
                marginBottom: 8,
                fontFamily,
                fontSize: 90,
                fontWeight: 900,
                letterSpacing: -1,
                textTransform: 'uppercase',
                transform: `scale(${0.65 + wordScale * 0.35})`,
                opacity: wordOpacity,
                ...(isAccented ? {
                  backgroundColor: accent,
                  color: '#000',
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 2,
                  paddingBottom: 4,
                } : {
                  color: '#FFFFFF',
                  textShadow: '0 2px 28px rgba(0,0,0,0.98), 0 0 60px rgba(0,0,0,0.85)',
                }),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
