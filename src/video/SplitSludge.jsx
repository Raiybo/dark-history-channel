import { Audio, Img, Video, OffthreadVideo, staticFile, useVideoConfig, useCurrentFrame, Sequence, interpolate } from 'remotion';
import { HookScene, HOOK_FRAMES } from './components/HookScene.jsx';
import { SlideshowSubtitles } from './components/SlideshowSubtitles.jsx';
import { CtaCard } from './components/CtaCard.jsx';
import { BrandSting, STING_FRAMES } from './components/BrandSting.jsx';
import { RevealStinger, STINGER_FRAMES } from './components/RevealStinger.jsx';

// SPLIT-SCREEN "SLUDGE" composition — the #1 growth format per 2026 research.
//
// Layout:
//   Top 60% of frame  = your narrative content (real UI recording, screenshot,
//                        b-roll, or motion graphics — whatever the genre feeds).
//   Bottom 40% of frame = MUTED "satisfying" loop (pressure washing, mowing,
//                          soap cutting, etc.) — pre-fetched by the pipeline
//                          into public/sludge/ or public/videos/.
//
// The gameplay/satisfying loop traps involuntary attention while the narrated
// content on top delivers the payload. It's why sub-2M-view Reddit-story and
// educational channels routinely pull 70%+ retention on otherwise dry topics.

const CROSSFADE = 12;

const GRADE = {
  overlay:      'rgba(8, 6, 24, 0.24)',
  vignette:     'radial-gradient(ellipse at center, transparent 40%, rgba(4,2,16,0.72) 100%)',
  watermark:    '#FFC83D',
  watermarkTop: 60,
};

// Compute per-clip start frame + duration on the TOP tier — same word-timed
// approach the didyouknow composition uses, so the top clip changes exactly
// when the narrator moves to a new idea.
function buildTopTimings(count, durationInFrames, wordTimings, fps) {
  if (count <= 0) return [];
  const even = () => Array.from({ length: count }, (_, i) => {
    const from = Math.round((i / count) * durationInFrames);
    const next = Math.round(((i + 1) / count) * durationInFrames);
    return { from, frames: Math.max(1, next - from) };
  });
  if (!wordTimings || wordTimings.length < count) return even();
  const n = wordTimings.length;
  const starts = [0];
  for (let i = 1; i < count; i++) {
    const t = wordTimings[Math.floor((i / count) * n)]?.start;
    const frame = Number.isFinite(t) ? Math.round(t * fps) : Math.round((i / count) * durationInFrames);
    starts.push(Math.min(frame, durationInFrames - 1));
  }
  starts.push(durationInFrames);
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] <= starts[i - 1]) starts[i] = Math.min(starts[i - 1] + 1, durationInFrames);
  }
  return Array.from({ length: count }, (_, i) => ({
    from: starts[i],
    frames: Math.max(1, starts[i + 1] - starts[i]),
  }));
}

// Detect .jpg vs .mp4 and pick the right Remotion element. Screenshots come
// in as .jpg from src/screenshots.js; screencasts + Pexels clips come as .mp4.
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const TopMedia = ({ src, opacity }) => {
  if (!src) return <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0a0a0f', opacity }} />;
  const isImage = IMAGE_RE.test(src);
  const commonStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity };
  if (isImage) return <Img src={staticFile(src)} style={commonStyle} />;
  return <OffthreadVideo src={staticFile(src)} muted playbackRate={1} style={commonStyle} />;
};

export const SplitSludge = ({
  title,
  narration,
  audioDuration,
  wordTimings,
  channelName,
  hookText,
  clips,            // top-half media (screenshots or screencast .mp4s)
  sludgeClip,       // bottom-half satisfying loop (single .mp4, loops)
  beats,
  hasMusic,
  logo,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const timings = buildTopTimings((clips || []).length, durationInFrames, wordTimings, fps);

  // Hook overlays the TOP half only — end when the narrator finishes the hook.
  const hookWordCount = (hookText || '').trim().split(/\s+/).filter(Boolean).length;
  const hookEndFrame = (wordTimings && wordTimings.length >= hookWordCount && hookWordCount > 0)
    ? Math.max(45, Math.min(Math.round(wordTimings[hookWordCount - 1].end * fps), durationInFrames - 1))
    : HOOK_FRAMES;

  // The split lives at 60% of the height. Top box is 0..0.6H, bottom is 0.6..1H.
  // For a 1080x1920 frame that's 1152px top, 768px bottom — plenty of room for
  // both a legible narration frame AND a recognizable satisfying loop.
  const TOP_PCT = 0.6;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#000' }}>

      {/* TOP HALF — content clips, timed to narration */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${TOP_PCT * 100}%`, overflow: 'hidden' }}>
        {(clips || []).map((clipPath, i) => {
          const t = timings[i];
          if (!t) return null;
          const isLast = i === (clips || []).length - 1;
          const seqDuration = isLast ? durationInFrames - t.from : t.frames + CROSSFADE;
          return (
            <Sequence key={i} from={t.from} durationInFrames={seqDuration}>
              <TopClip src={clipPath} totalFrames={t.frames} crossfade={CROSSFADE} isFirst={i === 0} isLast={isLast} />
            </Sequence>
          );
        })}

        {/* Genre tint + vignette confined to the top half */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: GRADE.overlay, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: GRADE.vignette, pointerEvents: 'none' }} />

        {/* Hook headline */}
        <Sequence from={0} durationInFrames={hookEndFrame + 20}>
          <HookScene hookText={hookText || ''} genre="consumer" endFrame={hookEndFrame} />
        </Sequence>

        {/* Reveal stinger when the hook hands off to captions */}
        <Sequence from={Math.max(0, hookEndFrame - 4)} durationInFrames={STINGER_FRAMES}>
          <RevealStinger accent={GRADE.watermark} />
        </Sequence>
      </div>

      {/* HARD SPLIT LINE — thin accent bar so the split is instantly readable */}
      <div style={{
        position: 'absolute',
        top: `${TOP_PCT * 100}%`,
        left: 0, right: 0,
        height: 4,
        backgroundColor: GRADE.watermark,
        boxShadow: `0 0 12px ${GRADE.watermark}`,
        zIndex: 20,
      }} />

      {/* BOTTOM HALF — muted satisfying loop */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(1 - TOP_PCT) * 100}%`, overflow: 'hidden' }}>
        {sludgeClip ? (
          <OffthreadVideo
            src={staticFile(sludgeClip)}
            muted
            loop
            playbackRate={1.15}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0a1420' }} />
        )}
      </div>

      {/* Audio beats — plays over both halves */}
      {(beats && beats.length > 0
        ? beats
        : [{ file: 'narration.mp3', startTime: 0, duration: audioDuration }]
      ).map((b, i) => (
        <Sequence
          key={`beat-${i}`}
          from={Math.round((b.startTime || 0) * fps)}
          durationInFrames={Math.round((b.duration || 0) * fps) + 6}
        >
          <Audio src={staticFile(`audio/${b.file}`)} />
        </Sequence>
      ))}

      {hasMusic && (
        <Audio src={staticFile('music/background.mp3')} volume={0.09} loop />
      )}

      {/* Subtitles — pinned to the SPLIT LINE (just above the sludge half) so
          captions never fight the hook or the sludge visual */}
      <SlideshowSubtitles
        narration={narration}
        audioDuration={audioDuration}
        wordTimings={wordTimings}
        genre="consumer"
        startFrame={hookEndFrame}
      />

      {/* CTA card in the last 3s — covers the split for a clean sign-off */}
      <Sequence from={durationInFrames - 90} durationInFrames={90}>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <CtaCard accent={GRADE.watermark} logo={logo} />
        </div>
      </Sequence>

      {/* Persistent brand watermark, top-middle of top-half */}
      <TopWatermark grade={GRADE} channelName={channelName} logo={logo} />

      {/* Branded opener — flash then settle */}
      <Sequence from={0} durationInFrames={STING_FRAMES + 2}>
        <BrandSting accent={GRADE.watermark} logo={logo} channelName={channelName} />
      </Sequence>
    </div>
  );
};

// Extracted so we can reuse the fade-in / fade-out pattern without pulling in
// the full VideoClip component (VideoClip covers image-vs-video branching for
// the DYK layout, but here we know the shape of each source per prop).
const TopClip = ({ src, totalFrames, crossfade, isFirst, isLast }) => {
  const frame = useCurrentFrame();
  const fadeIn  = isFirst ? 1 : interpolate(frame, [0, crossfade], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = isLast  ? 1 : interpolate(frame, [totalFrames, totalFrames + crossfade], [1, 0], { extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);
  return <TopMedia src={src} opacity={opacity} />;
};

const TopWatermark = ({ grade, channelName, logo }) => {
  const frame = useCurrentFrame();
  if (frame < STING_FRAMES - 2) return null;
  return (
    <div style={{
      position: 'absolute',
      top: grade.watermarkTop,
      left: 0, right: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      pointerEvents: 'none',
      zIndex: 30,
    }}>
      {logo ? (
        <Img src={staticFile(logo)} style={{ width: 120, height: 120, objectFit: 'contain', opacity: 0.5 }} />
      ) : (
        <span style={{
          fontFamily: '"Arial Black", Impact, sans-serif',
          fontSize: 18, fontWeight: 900, letterSpacing: 8,
          textTransform: 'uppercase',
          color: grade.watermark, opacity: 0.55,
          textShadow: '0 0 24px rgba(0,0,0,0.9)',
        }}>{channelName}</span>
      )}
    </div>
  );
};
