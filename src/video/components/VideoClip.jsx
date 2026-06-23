import { OffthreadVideo, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { Slide } from './Slide.jsx';

const FALLBACK_COLORS = ['#06080f', '#080610', '#06100a'];
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

// Cinematic transition vocabulary. We rotate through these per scene so cuts
// stop feeling like a plain crossfade and start feeling like a produced reel.
// Each variant ships an enter (incoming clip) and an exit (outgoing clip)
// transform, computed from frame / totalFrames + crossfade window.
//   fade     — soft opacity blend (the original behavior, kept as fallback)
//   whipL    — incoming whips in from the right, outgoing flies left
//   whipR    — mirrored
//   zoomBlur — incoming punches in from a scale-down + blur
//   pushUp   — outgoing slides up, incoming rises from below
const VARIANTS = ['zoomBlur', 'whipL', 'pushUp', 'whipR', 'zoomBlur', 'whipL', 'pushUp', 'whipR'];

function transitionStyle(variant, frame, totalFrames, crossfade, isFirst, isLast) {
  const enterT = Math.min(1, Math.max(0, frame / Math.max(1, crossfade)));
  const exitProgress = (frame - totalFrames) / Math.max(1, crossfade);
  const exitT = Math.min(1, Math.max(0, exitProgress));

  // Defaults: classic crossfade opacity.
  let translateX = 0;
  let translateY = 0;
  let scale = 1;
  let blurPx = 0;
  let opacity = 1;

  if (!isFirst) {
    // Incoming animation: 0 -> 1 over the first `crossfade` frames.
    switch (variant) {
      case 'whipL':
        translateX = interpolate(enterT, [0, 1], [60, 0]);
        blurPx = interpolate(enterT, [0, 0.6, 1], [8, 3, 0]);
        opacity = enterT;
        break;
      case 'whipR':
        translateX = interpolate(enterT, [0, 1], [-60, 0]);
        blurPx = interpolate(enterT, [0, 0.6, 1], [8, 3, 0]);
        opacity = enterT;
        break;
      case 'zoomBlur':
        scale = interpolate(enterT, [0, 1], [1.18, 1.0]);
        blurPx = interpolate(enterT, [0, 0.7, 1], [10, 2, 0]);
        opacity = interpolate(enterT, [0, 0.4, 1], [0, 0.85, 1]);
        break;
      case 'pushUp':
        translateY = interpolate(enterT, [0, 1], [40, 0]);
        opacity = enterT;
        break;
      default:
        opacity = enterT;
    }
  }

  if (!isLast && frame > totalFrames) {
    // Outgoing animation: 0 -> 1 from totalFrames to totalFrames+crossfade.
    switch (variant) {
      case 'whipL':
        translateX = interpolate(exitT, [0, 1], [0, -100]);
        blurPx = interpolate(exitT, [0, 1], [0, 12]);
        opacity = 1 - exitT;
        break;
      case 'whipR':
        translateX = interpolate(exitT, [0, 1], [0, 100]);
        blurPx = interpolate(exitT, [0, 1], [0, 12]);
        opacity = 1 - exitT;
        break;
      case 'zoomBlur':
        scale = interpolate(exitT, [0, 1], [1.0, 0.92]);
        blurPx = interpolate(exitT, [0, 1], [0, 8]);
        opacity = 1 - exitT;
        break;
      case 'pushUp':
        translateY = interpolate(exitT, [0, 1], [0, -50]);
        opacity = 1 - exitT;
        break;
      default:
        opacity = 1 - exitT;
    }
  }

  return {
    transform: `translate(${translateX}%, ${translateY}%) scale(${scale})`,
    filter: blurPx > 0.05 ? `blur(${blurPx}px)` : 'none',
    opacity,
  };
}

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
  const variant = VARIANTS[index % VARIANTS.length];
  const { transform, filter, opacity } = transitionStyle(variant, frame, totalFrames, crossfade, isFirst, isLast);

  if (!src) {
    return (
      <div style={{
        position: 'absolute', inset: 0, opacity,
        backgroundColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      }} />
    );
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      overflow: 'hidden',
      opacity,
      transform,
      filter,
      transformOrigin: 'center center',
    }}>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        playbackRate={1}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};
