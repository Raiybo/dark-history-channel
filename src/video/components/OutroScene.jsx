import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export const OutroScene = ({ channelName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 20, stiffness: 90 } });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  const textOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [20, 45], [10, 0], { extrapolateRight: 'clamp' });

  const subOpacity = interpolate(frame, [50, 75], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Channel logo area */}
      <div style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        border: '2px solid #c9a84c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: logoOpacity,
        transform: `scale(${logoScale})`,
        marginBottom: 36,
        backgroundColor: 'rgba(139,26,26,0.2)'
      }}>
        <div style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 36,
          color: '#c9a84c'
        }}>
          ✦
        </div>
      </div>

      {/* Channel name */}
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 52,
        fontWeight: 'bold',
        color: '#e8d5b7',
        opacity: logoOpacity,
        transform: `scale(${0.85 + logoScale * 0.15})`,
        textShadow: '0 0 40px rgba(139,26,26,0.5)',
        marginBottom: 20,
        letterSpacing: 2
      }}>
        {channelName}
      </div>

      {/* Tagline */}
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 22,
        color: '#7a6a50',
        letterSpacing: 5,
        textTransform: 'uppercase',
        opacity: textOpacity,
        transform: `translateY(${textY}px)`,
        marginBottom: 50
      }}>
        True Stories From the Shadows of History
      </div>

      {/* Subscribe CTA */}
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 26,
        color: '#c9a84c',
        opacity: subOpacity,
        textAlign: 'center',
        lineHeight: 1.6,
        letterSpacing: 1
      }}>
        Subscribe for a new dark history story every day
      </div>
    </div>
  );
};
