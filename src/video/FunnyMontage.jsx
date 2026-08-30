import {
  AbsoluteFill, OffthreadVideo, Img, staticFile, Sequence,
  useVideoConfig, useCurrentFrame, interpolate,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();
const GOLD = '#FFC83D';
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const XFADE = 4;

// A minimal, NO-NARRATION, NO-CAPTION montage: the clips play back-to-back at
// normal speed with THEIR OWN audio (the raw sound from each clip — no laugh
// track, no music). The vibe is a fast cutaway reel — simple, real, and funny.
// Only a tiny channel wordmark + the optional creator credit stay on screen.
const ClipBg = ({ clip, volume = 1 }) => {
  if (!clip || !clip.path) return <div style={{ position: 'absolute', inset: 0, background: '#0a0a12' }} />;
  if (IMAGE_RE.test(clip.path)) {
    return <Img src={staticFile(clip.path)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  // Play the clip ONCE at normal speed with its own audio. No <Loop> — looping
  // would restart the audio mid-clip; the ~4-frame crossfade tail past the media
  // end is covered by the next clip fading in, so a frozen last frame is fine.
  return (
    <OffthreadVideo src={staticFile(clip.path)} volume={volume} playbackRate={1}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
  );
};

const Credit = ({ handle }) => {
  if (!handle) return null;
  return (
    <div style={{ position: 'absolute', bottom: 26, right: 22, pointerEvents: 'none', zIndex: 40 }}>
      <span style={{ fontFamily, fontWeight: 700, fontSize: 22, letterSpacing: 0.5, color: 'rgba(255,255,255,0.82)', textShadow: '0 2px 8px rgba(0,0,0,0.98)' }}>
        🎬 @{handle}
      </span>
    </div>
  );
};

const ClipCard = ({ clip, credit, isFirst, volume }) => {
  const frame = useCurrentFrame();
  const op = isFirst ? 1 : interpolate(frame, [0, XFADE], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <ClipBg clip={clip} volume={volume} />
      <Credit handle={credit} />
    </AbsoluteFill>
  );
};

export const FunnyMontage = ({
  clips = [], credits = [], channelName = 'Kings of Ranks', clipVolume = 1,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  // Clips play back-to-back; each start = cumulative sum of prior clip durations.
  let acc = 0;
  const starts = clips.map((c) => { const s = Math.round(acc * fps); acc += Math.max(0.5, c.duration || 4); return s; });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {clips.map((clip, i) => {
        const from = starts[i];
        const isLast = i === clips.length - 1;
        const dur = isLast ? (durationInFrames - from) : (starts[i + 1] - from + XFADE);
        return (
          <Sequence key={i} from={from} durationInFrames={Math.max(1, dur)}>
            <ClipCard clip={clip} credit={credits[i]} isFirst={i === 0} volume={clip.volume != null ? clip.volume : clipVolume} />
          </Sequence>
        );
      })}

      {/* small channel wordmark, top safe zone (branding only — no captions) */}
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none', zIndex: 30 }}>
        <span style={{ fontFamily, fontWeight: 900, fontSize: 22, letterSpacing: 5, textTransform: 'uppercase', color: GOLD, opacity: 0.85, textShadow: '0 0 18px rgba(0,0,0,0.95)' }}>{channelName}</span>
      </div>
    </AbsoluteFill>
  );
};
