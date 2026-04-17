import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const ShortsHeader = ({ channelName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hue = (frame / fps * 15) % 360;
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute',
      top: 80,
      left: 0, right: 0,
      display: 'flex',
      justifyContent: 'center',
      opacity
    }}>
      <div style={{
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: 32,
        fontWeight: 900,
        letterSpacing: 6,
        textTransform: 'uppercase',
        color: `hsl(${hue}, 100%, 65%)`,
        textShadow: `0 0 25px hsl(${hue}, 100%, 65%)`,
      }}>
        {channelName}
      </div>
    </div>
  );
};
