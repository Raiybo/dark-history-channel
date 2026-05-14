import { Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const CharacterFrame = ({ characterImages, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!characterImages) return null;

  // Which expression to show based on narration progress
  const progress = frame / durationInFrames;
  let expression;
  if (progress < 0.12)       expression = 'shocked';
  else if (progress < 0.42)  expression = 'serious';
  else if (progress < 0.75)  expression = 'explaining';
  else                        expression = 'amazed';

  const src = characterImages[expression];
  if (!src) return null;

  // Slide up from below on first appearance
  const slideUp = spring({ frame, fps, config: { damping: 22, stiffness: 180, mass: 0.9 } });
  const translateY = interpolate(slideUp, [0, 1], [300, 0]);

  // Gentle floating bob
  const bob = Math.sin((frame / fps) * Math.PI * 0.6) * 6;

  // Fade out near end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 25, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Subtle scale pulse on expression change
  const expressionFrame = progress < 0.12 ? frame
    : progress < 0.42 ? frame - Math.round(durationInFrames * 0.12)
    : progress < 0.75 ? frame - Math.round(durationInFrames * 0.42)
    : frame - Math.round(durationInFrames * 0.75);

  const pulse = spring({
    frame: Math.min(expressionFrame, 12),
    fps,
    config: { damping: 14, stiffness: 400, mass: 0.5 },
  });
  const scale = interpolate(pulse, [0, 1], [0.88, 1.0]);

  return (
    <div style={{
      position: 'absolute',
      bottom: 210,
      left: '50%',
      transform: `translateX(-50%) translateY(${translateY + bob}px) scale(${scale})`,
      opacity: fadeOut,
      width: 380,
      height: 500,
      zIndex: 20,
      pointerEvents: 'none',
    }}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 16px 48px rgba(0,0,0,0.9)) drop-shadow(0 4px 12px rgba(0,0,0,1))',
        }}
      />
    </div>
  );
};
