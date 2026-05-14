import { Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const CharacterFrame = ({ characterImages, durationInFrames, wordTimings }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!characterImages) return null;

  const currentTime = frame / fps;

  // Which expression phase based on narration progress
  const progress = frame / durationInFrames;
  let expression;
  if (progress < 0.12)       expression = 'shocked';
  else if (progress < 0.42)  expression = 'serious';
  else if (progress < 0.75)  expression = 'explaining';
  else                        expression = 'amazed';

  // Lip sync: swap to talking image when a word is actively being spoken
  const isOnWord = Array.isArray(wordTimings) && wordTimings.some(
    wt => currentTime >= wt.start && currentTime < wt.end
  );
  const activeSrc = isOnWord && characterImages.talking
    ? 'characters/talking.jpg'
    : characterImages[expression]
      ? `characters/${expression}.jpg`
      : null;

  if (!activeSrc) return null;

  // Slide up from below on entry
  const slideUp = spring({ frame, fps, config: { damping: 22, stiffness: 180, mass: 0.9 } });
  const translateY = interpolate(slideUp, [0, 1], [300, 0]);

  // Gentle float bob
  const bob = Math.sin((frame / fps) * Math.PI * 0.6) * 6;

  // Subtle scale breathe while talking
  const breathe = isOnWord
    ? 1.0 + Math.abs(Math.sin((frame / fps) * Math.PI * 5.5)) * 0.018
    : 1.0;

  // Fade out at end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 25, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{
      position: 'absolute',
      bottom: 210,
      left: '50%',
      transform: `translateX(-50%) translateY(${translateY + bob}px) scale(${breathe})`,
      opacity: fadeOut,
      width: 380,
      height: 500,
      zIndex: 20,
      pointerEvents: 'none',
    }}>
      <Img
        src={staticFile(activeSrc)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          // Removes the white background — white × dark = dark, so white disappears
          mixBlendMode: 'multiply',
          filter: 'drop-shadow(0 16px 48px rgba(0,0,0,0.9))',
        }}
      />
    </div>
  );
};
