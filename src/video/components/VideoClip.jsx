import { OffthreadVideo, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { Slide } from './Slide.jsx';

const FALLBACK_COLORS = ['#06080f', '#080610', '#06100a'];
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

export const VideoClip = (props) => {
  // AI-generated fallback images (Pollinations) come back as .jpg paths; render
  // them as Ken-Burns slides instead of video. Keeps SlideshowVideo simple — it
  // always uses <VideoClip> and we route here.
  if (props.src && IMAGE_RE.test(props.src)) {
    return <Slide {...props} />;
  }
  return <VideoClipInner {...props} />;
};

const VideoClipInner = ({ src, index, totalFrames, crossfade = 15, isFirst = false, isLast = false }) => {
  const frame = useCurrentFrame();

  const fadeIn  = isFirst ? 1 : interpolate(frame, [0, crossfade], [0, 1], { extrapolateRight: 'clamp' });
  // Last clip never fades out — video stays visible until the audio ends
  const fadeOut = isLast  ? 1 : interpolate(frame, [totalFrames, totalFrames + crossfade], [1, 0], { extrapolateRight: 'clamp' });
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
        playbackRate={1}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};
