import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const OutroScene = ({ channelName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hue = (frame / fps * 20) % 360;

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 250 } });
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const textOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [45, 65], [0, 1], { extrapolateRight: 'clamp' });
  const ctaScale = spring({ frame: frame - 45, fps, config: { damping: 15, stiffness: 200 } });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center'
    }}>
      {/* Channel name */}
      <div style={{
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: 72,
        fontWeight: 900,
        textTransform: 'uppercase',
        color: '#FFFFFF',
        textShadow: `-4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000, 0 0 50px hsl(${hue}, 100%, 60%)`,
        opacity: logoOpacity,
        transform: `scale(${0.5 + logoScale * 0.5})`,
        letterSpacing: 4,
        marginBottom: 20
      }}>
        {channelName}
      </div>

      {/* Tagline */}
      <div style={{
        fontFamily: '"Arial Black", sans-serif',
        fontSize: 26,
        fontWeight: 900,
        letterSpacing: 4,
        textTransform: 'uppercase',
        color: `hsl(${hue}, 100%, 65%)`,
        textShadow: `0 0 20px hsl(${hue}, 100%, 65%)`,
        opacity: textOpacity,
        marginBottom: 50
      }}>
        Real History. Unfiltered Rizz.
      </div>

      {/* CTA */}
      <div style={{
        fontFamily: '"Arial Black", sans-serif',
        fontSize: 32,
        fontWeight: 900,
        textTransform: 'uppercase',
        color: '#FFFFFF',
        textShadow: '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000',
        opacity: ctaOpacity,
        transform: `scale(${ctaScale})`,
        textAlign: 'center',
        lineHeight: 1.6
      }}>
        Subscribe or you have no aura. No cap.
      </div>
    </div>
  );
};
