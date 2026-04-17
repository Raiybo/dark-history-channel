import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const ShortsFooter = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const hue = (frame / fps * 15) % 360;

  // Fade in near the end as CTA
  const opacity = interpolate(frame, [durationInFrames - 45, durationInFrames - 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Progress bar
  const progress = frame / durationInFrames;

  return (
    <>
      {/* Progress bar at bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, backgroundColor: '#ffffff15' }}>
        <div style={{
          height: '100%',
          width: `${progress * 100}%`,
          backgroundColor: `hsl(${hue}, 100%, 60%)`,
          boxShadow: `0 0 10px hsl(${hue}, 100%, 60%)`
        }} />
      </div>

      {/* Follow CTA — appears near end */}
      <div style={{
        position: 'absolute',
        bottom: 100,
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity
      }}>
        <div style={{
          fontFamily: '"Arial Black", sans-serif',
          fontSize: 38,
          fontWeight: 900,
          textTransform: 'uppercase',
          color: '#FFFFFF',
          textShadow: `-4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000`,
          textAlign: 'center',
          padding: '0 60px'
        }}>
          Follow for more. No cap.
        </div>
      </div>
    </>
  );
};
