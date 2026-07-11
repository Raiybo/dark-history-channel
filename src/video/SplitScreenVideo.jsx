import {
  AbsoluteFill, Audio, Img, OffthreadVideo, staticFile, Loop,
  useVideoConfig, useCurrentFrame, interpolate, Sequence,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();
const CROSSFADE = 12;
const ACCENT = '#FFC83D';
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

// A clip that fills its parent and LOOPS its source so it never freezes.
// Remotion 4.0.x OffthreadVideo has no `loop` prop, and its playback time ramps
// linearly, so once a short stock clip passes its length it freezes on the last
// frame. We wrap it in <Loop> sized to the clip's real (Pexels) duration — minus
// a 2-frame margin so we always restart BEFORE the source runs out. clip is
// { path, duration } (seconds); an AI-image fallback (.jpg) renders as a still.
const LoopedClip = ({ clip, fps }) => {
  if (!clip || !clip.path) {
    return <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0a0a12' }} />;
  }
  if (IMAGE_RE.test(clip.path)) {
    return <Img src={staticFile(clip.path)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  const secs = Math.min(Math.max(clip.duration || 4, 1.5), 30);
  const loopFrames = Math.max(1, Math.floor(secs * fps) - 2);
  return (
    <Loop durationInFrames={loopFrames}>
      <OffthreadVideo
        src={staticFile(clip.path)}
        muted
        playbackRate={1}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </Loop>
  );
};

const TopSlot = ({ clip, fps }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', inset: 0, opacity }}><LoopedClip clip={clip} fps={fps} /></div>;
};

function evenTimings(count, frames) {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const from = Math.round((i / count) * frames);
    const next = Math.round(((i + 1) / count) * frames);
    return { from, frames: Math.max(1, next - from) };
  });
}

// The bold "edit" headline + cycling hype captions.
const EditTitle = ({ hookText, captionLines, fps }) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 8], [0.7, 1], { extrapolateRight: 'clamp' });
  const words = (hookText || '').split(' ');
  const lines = captionLines || [];
  const beat = lines.length ? Math.floor(frame / (fps * 2.6)) % lines.length : -1;
  return (
    <>
      <div style={{ position: 'absolute', top: 34, left: 40, right: 40, textAlign: 'center', transform: `scale(${pop})`, transformOrigin: 'top center' }}>
        <span style={{ fontFamily, fontSize: 62, fontWeight: 900, lineHeight: 1.02, letterSpacing: -1, color: '#fff', textTransform: 'uppercase', textShadow: '0 4px 22px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.7)' }}>
          {words.map((w, i) => (
            <span key={i} style={{ display: 'inline-block', marginRight: 12, color: i % 4 === 2 ? ACCENT : '#fff' }}>{w}</span>
          ))}
        </span>
      </div>
      {beat >= 0 && (
        <div key={beat} style={{ position: 'absolute', bottom: 40, left: 40, right: 40, textAlign: 'center' }}>
          <span style={{ fontFamily, fontSize: 40, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '8px 18px', borderRadius: 10, textShadow: '0 2px 12px rgba(0,0,0,0.9)', lineHeight: 1.2 }}>{lines[beat]}</span>
        </div>
      )}
    </>
  );
};

// Split-screen "edit": trending-subject stock on top, royalty-free satisfying
// loop on bottom, royalty-free music. All footage is licensed/CC/stock. clips
// are { path, duration } objects.
export const SplitScreenVideo = ({
  topClips = [],
  satisfyingClips = [],
  hookText = '',
  captionLines = [],
  channelName = 'Distoir',
  logo = null,
  hasMusic = false,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const timings = evenTimings(topClips.length, durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* TOP HALF — trending-subject stock */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', overflow: 'hidden' }}>
        {topClips.map((clip, i) => {
          const t = timings[i];
          if (!t) return null;
          const isLast = i === topClips.length - 1;
          const dur = isLast ? durationInFrames - t.from : t.frames + CROSSFADE;
          return (
            <Sequence key={i} from={t.from} durationInFrames={dur}>
              <TopSlot clip={clip} fps={fps} />
            </Sequence>
          );
        })}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', pointerEvents: 'none' }} />
        <EditTitle hookText={hookText} captionLines={captionLines} fps={fps} />
      </div>

      {/* center seam */}
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, marginTop: -2, backgroundColor: ACCENT, boxShadow: '0 0 24px rgba(0,0,0,0.9)', zIndex: 5 }} />

      {/* BOTTOM HALF — royalty-free satisfying loop */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', overflow: 'hidden' }}>
        <LoopedClip clip={satisfyingClips[0]} fps={fps} />
      </div>

      {hasMusic && <Audio src={staticFile('music/background.mp3')} volume={0.6} loop />}

      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, marginTop: 14, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 6 }}>
        {logo ? (
          <Img src={staticFile(logo)} style={{ width: 96, height: 96, objectFit: 'contain', opacity: 0.55 }} />
        ) : (
          <span style={{ fontFamily, fontSize: 18, fontWeight: 900, letterSpacing: 8, textTransform: 'uppercase', color: ACCENT, opacity: 0.6, textShadow: '0 0 20px rgba(0,0,0,0.9)' }}>{channelName}</span>
        )}
      </div>
    </AbsoluteFill>
  );
};
