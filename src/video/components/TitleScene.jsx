import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export const TitleScene = ({ title, channelName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const channelOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const channelY = interpolate(frame, [0, 20], [-10, 0], { extrapolateRight: 'clamp' });

  const titleScale = spring({ frame: frame - 15, fps, config: { damping: 18, stiffness: 80 } });
  const titleOpacity = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: 'clamp' });

  const lineWidth = interpolate(frame, [40, 80], [0, 320], { extrapolateRight: 'clamp' });

  const subtitleOpacity = interpolate(frame, [70, 100], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 120px'
    }}>
      {/* Channel name */}
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 22,
        letterSpacing: 8,
        color: '#8b1a1a',
        textTransform: 'uppercase',
        opacity: channelOpacity,
        transform: `translateY(${channelY}px)`,
        marginBottom: 32
      }}>
        {channelName}
      </div>

      {/* Decorative line */}
      <div style={{
        width: lineWidth,
        height: 1,
        backgroundColor: '#c9a84c',
        marginBottom: 40,
        opacity: 0.6
      }} />

      {/* Main title */}
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 72,
        fontWeight: 'bold',
        color: '#e8d5b7',
        textAlign: 'center',
        lineHeight: 1.2,
        opacity: titleOpacity,
        transform: `scale(${0.85 + titleScale * 0.15})`,
        textShadow: '0 0 60px rgba(139,26,26,0.4), 0 2px 8px rgba(0,0,0,0.8)',
        maxWidth: 1100
      }}>
        {title}
      </div>

      {/* Decorative line bottom */}
      <div style={{
        width: lineWidth,
        height: 1,
        backgroundColor: '#c9a84c',
        marginTop: 40,
        opacity: 0.6
      }} />

      {/* Era tag */}
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 20,
        letterSpacing: 4,
        color: '#7a6a50',
        textTransform: 'uppercase',
        opacity: subtitleOpacity,
        marginTop: 28
      }}>
        A True Story
      </div>
    </div>
  );
};
