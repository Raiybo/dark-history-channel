import { useCurrentFrame, interpolate, Img, staticFile } from 'remotion';

const KEN_BURNS = [
  { startScale: 1.0, endScale: 1.18, startX: 0,  endX: 0,  startY: 0,  endY: 0  }, // zoom in
  { startScale: 1.18, endScale: 1.0, startX: 0,  endX: 0,  startY: 0,  endY: 0  }, // zoom out
  { startScale: 1.1, endScale: 1.1,  startX: -3, endX: 3,  startY: 0,  endY: 0  }, // pan left→right
  { startScale: 1.1, endScale: 1.1,  startX: 3,  endX: -3, startY: 0,  endY: 0  }, // pan right→left
  { startScale: 1.0, endScale: 1.15, startX: -2, endX: 1,  startY: 1,  endY: -1 }, // zoom in + drift
];

const FALLBACK_COLORS = ['#0a0a0f', '#050a0f', '#0a0f05'];

export const Slide = ({ src, index, totalFrames, crossfade = 15, isFirst = false, isLast = false }) => {
  const frame = useCurrentFrame();
  const preset = KEN_BURNS[index % KEN_BURNS.length];

  const progress = Math.min(frame / Math.max(totalFrames, 1), 1);
  const scale = preset.startScale + (preset.endScale - preset.startScale) * progress;
  const tx = preset.startX + (preset.endX - preset.startX) * progress;
  const ty = preset.startY + (preset.endY - preset.startY) * progress;

  const fadeIn = isFirst ? 1 : interpolate(frame, [0, crossfade], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = isLast ? 1 : interpolate(frame, [totalFrames, totalFrames + crossfade], [1, 0], { extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  if (!src) {
    return (
      <div style={{
        position: 'absolute', inset: 0, opacity,
        backgroundColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      }} />
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity }}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
};
