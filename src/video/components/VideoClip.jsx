import { OffthreadVideo, staticFile, useCurrentFrame, interpolate } from 'remotion';

const FALLBACK_COLORS = ['#06080f', '#080610', '#06100a'];

export const VideoClip = ({ src, index, totalFrames, crossfade = 15, isFirst = false }) => {
  const frame = useCurrentFrame();

  const fadeIn  = isFirst ? 1 : interpolate(frame, [0, crossfade], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [totalFrames, totalFrames + crossfade], [1, 0], { extrapolateRight: 'clamp' });
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
      <OffthreadVideo
        src={staticFile(src)}
        muted
        playbackRate={0.88}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};
