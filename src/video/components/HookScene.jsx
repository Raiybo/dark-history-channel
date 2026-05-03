import { useCurrentFrame, interpolate } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

export const HOOK_FRAMES = 150; // 5 seconds at 30fps

const { fontFamily } = loadFont();

export const HookScene = ({ hookText, genre }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, 20, HOOK_FRAMES - 20, HOOK_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const scale = interpolate(frame, [0, 50], [0.92, 1], { extrapolateRight: 'clamp' });

  const words = (hookText || '').split(' ');

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.10) 40%, rgba(0,0,0,0.10) 60%, rgba(0,0,0,0.70) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 64px',
      opacity,
    }}>
      <div style={{
        textAlign: 'center',
        transform: `scale(${scale})`,
        lineHeight: 1.15,
      }}>
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: 14,
              marginBottom: 10,
              fontFamily,
              fontSize: 86,
              fontWeight: 900,
              letterSpacing: -1,
              textTransform: 'uppercase',
              // Alternate: first half of words get yellow highlight, rest white
              ...(i % 3 === 0 ? {
                backgroundColor: '#FFD600',
                color: '#000000',
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 4,
                paddingBottom: 4,
              } : {
                color: '#FFFFFF',
                textShadow: '0 2px 20px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.8)',
              }),
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
};
