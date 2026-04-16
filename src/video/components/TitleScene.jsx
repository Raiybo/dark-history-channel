import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const TitleScene = ({ title, channelName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hue = (frame / fps * 15) % 360;

  // Channel name drops in
  const channelScale = spring({ frame, fps, config: { damping: 15, stiffness: 200 } });
  const channelOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // Title slams in
  const titleScale = spring({ frame: frame - 20, fps, config: { damping: 10, stiffness: 400 } });
  const titleOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: 'clamp' });

  // Subtitle fades
  const subOpacity = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: 'clamp' });

  // Line grows
  const lineWidth = interpolate(frame, [35, 65], [0, 600], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 100px'
    }}>
      {/* Channel name */}
      <div style={{
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: 28,
        fontWeight: 900,
        letterSpacing: 10,
        textTransform: 'uppercase',
        color: `hsl(${hue}, 100%, 60%)`,
        textShadow: `0 0 30px hsl(${hue}, 100%, 60%)`,
        opacity: channelOpacity,
        transform: `scale(${channelScale})`,
        marginBottom: 30
      }}>
        {channelName}
      </div>

      {/* Animated line */}
      <div style={{
        width: lineWidth,
        height: 3,
        backgroundColor: `hsl(${hue}, 100%, 60%)`,
        boxShadow: `0 0 15px hsl(${hue}, 100%, 60%)`,
        marginBottom: 40
      }} />

      {/* Main title — slams in */}
      <div style={{
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: 80,
        fontWeight: 900,
        textTransform: 'uppercase',
        color: '#FFFFFF',
        textAlign: 'center',
        lineHeight: 1.1,
        opacity: titleOpacity,
        transform: `scale(${0.6 + titleScale * 0.4})`,
        textShadow: '-4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000, 0 0 40px rgba(255,255,255,0.3)',
        maxWidth: 1400
      }}>
        {title}
      </div>

      {/* Subtitle */}
      <div style={{
        fontFamily: '"Arial Black", sans-serif',
        fontSize: 22,
        fontWeight: 900,
        letterSpacing: 5,
        textTransform: 'uppercase',
        color: `hsl(${hue}, 100%, 60%)`,
        opacity: subOpacity,
        marginTop: 35,
        textShadow: `0 0 20px hsl(${hue}, 100%, 60%)`
      }}>
        No Cap. True History. Fr Fr.
      </div>
    </div>
  );
};
