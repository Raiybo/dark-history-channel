import { Audio, Img, staticFile, useVideoConfig, Sequence } from 'remotion';
import { VideoClip } from './components/VideoClip.jsx';
import { HookScene, HOOK_FRAMES } from './components/HookScene.jsx';
import { SlideshowSubtitles } from './components/SlideshowSubtitles.jsx';
import { CtaCard } from './components/CtaCard.jsx';

const CROSSFADE = 15;

const GENRE_GRADE = {
  didyouknow: {
    overlay:      'rgba(8, 6, 24, 0.30)',
    vignette:     'radial-gradient(ellipse at center, transparent 32%, rgba(4,2,16,0.82) 100%)',
    letterbox:    false,
    watermark:    '#FFC83D',
    watermarkTop: 72,
  },
};

// Even cadence: every clip gets an equal slice of the video, so the footage
// changes on one steady, predictable beat from start to finish. Captions stay
// word-synced to the voice separately — the two layers no longer fight.
function buildTimings(count, durationInFrames) {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const from = Math.round((i / count) * durationInFrames);
    const next = Math.round(((i + 1) / count) * durationInFrames);
    return { from, frames: Math.max(1, next - from) };
  });
}

export const SlideshowVideo = ({
  title,
  narration,
  audioDuration,
  wordTimings,
  channelName,
  genre,
  hookText,
  clips,
  scenes,
  beats,
  hasMusic,
  logo,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const grade = GENRE_GRADE[genre] || GENRE_GRADE.didyouknow;
  const timings = buildTimings((clips || []).length, durationInFrames);

  // End the hook overlay when the narrator actually finishes the spoken hook
  // line, so captions take over immediately (no silent dead-zone at the start).
  const hookWordCount = (hookText || '').trim().split(/\s+/).filter(Boolean).length;
  const hookEndFrame = (wordTimings && wordTimings.length >= hookWordCount && hookWordCount > 0)
    ? Math.max(45, Math.min(Math.round(wordTimings[hookWordCount - 1].end * fps), durationInFrames - 1))
    : HOOK_FRAMES;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#040404' }}>

      {/* Stock footage — story backdrop */}
      {(clips || []).map((clipPath, i) => {
        const t = timings[i];
        if (!t) return null;
        const isLast = i === (clips || []).length - 1;
        const seqDuration = isLast ? durationInFrames - t.from : t.frames + CROSSFADE;
        return (
          <Sequence key={i} from={t.from} durationInFrames={seqDuration}>
            <VideoClip
              src={clipPath}
              index={i}
              totalFrames={t.frames}
              crossfade={CROSSFADE}
              isFirst={i === 0}
              isLast={isLast}
            />
          </Sequence>
        );
      })}

      {/* Genre colour tint */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: grade.overlay, pointerEvents: 'none' }} />

      {/* Deep vignette */}
      <div style={{ position: 'absolute', inset: 0, background: grade.vignette, pointerEvents: 'none' }} />

      {/* Narration — each idea beat is its own track, with a real silent gap
          between them so the narrator audibly breathes when the idea shifts. */}
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

      {/* Background music */}
      {hasMusic && (
        <Audio src={staticFile('music/background.mp3')} volume={0.11} loop />
      )}

      {/* Hook — until the spoken hook line ends */}
      <Sequence from={0} durationInFrames={hookEndFrame + 20}>
        <HookScene hookText={hookText || ''} genre={genre} endFrame={hookEndFrame} />
      </Sequence>

      {/* Subtitles */}
      <SlideshowSubtitles
        narration={narration}
        audioDuration={audioDuration}
        wordTimings={wordTimings}
        genre={genre}
        startFrame={hookEndFrame}
      />

      {/* CTA card — last 3 seconds */}
      <Sequence from={durationInFrames - 90} durationInFrames={90}>
        <CtaCard accent={grade.watermark} logo={logo} />
      </Sequence>

      {/* Persistent brand watermark, top-middle (anti-theft). Shows the faint
          logo when provided, otherwise the channel wordmark. */}
      <div style={{
        position: 'absolute',
        top: grade.watermarkTop,
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
      }}>
        {logo ? (
          <Img
            src={staticFile(logo)}
            style={{ width: 90, height: 90, objectFit: 'contain', opacity: 0.3, borderRadius: 14 }}
          />
        ) : (
          <span style={{
            fontFamily: '"Arial Black", Impact, sans-serif',
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: 9,
            textTransform: 'uppercase',
            color: grade.watermark,
            opacity: 0.55,
            textShadow: '0 0 30px rgba(0,0,0,0.95)',
          }}>
            {channelName}
          </span>
        )}
      </div>
    </div>
  );
};
