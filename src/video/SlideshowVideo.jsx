import { Audio, Img, staticFile, useVideoConfig, useCurrentFrame, Sequence } from 'remotion';
import { VideoClip } from './components/VideoClip.jsx';
import { HookScene, HOOK_FRAMES } from './components/HookScene.jsx';
import { SlideshowSubtitles } from './components/SlideshowSubtitles.jsx';
import { CtaCard } from './components/CtaCard.jsx';
import { BrandSting, STING_FRAMES } from './components/BrandSting.jsx';
import { SceneCallouts } from './components/SceneCallout.jsx';
import { RevealStinger, STINGER_FRAMES } from './components/RevealStinger.jsx';
import { ColorGrade } from './components/ColorGrade.jsx';

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

// Footage is timed to the SPOKEN narration, not an even clock. Clip i covers its
// 1/count slice of the actually-spoken words, so the visual on screen matches
// what the narrator is saying at that moment — when the voice reaches "the crab
// never ages", the crab clip is what's showing. The script writer assigns the 8
// scenes in narration order, so word-slice i lines up with scene i's subject.
// Falls back to an even split only if word timings are unavailable.
function buildTimings(count, durationInFrames, wordTimings, fps) {
  if (count <= 0) return [];

  const evenSplit = () => Array.from({ length: count }, (_, i) => {
    const from = Math.round((i / count) * durationInFrames);
    const next = Math.round(((i + 1) / count) * durationInFrames);
    return { from, frames: Math.max(1, next - from) };
  });

  if (!wordTimings || wordTimings.length < count) return evenSplit();

  const n = wordTimings.length;
  const starts = [0];
  for (let i = 1; i < count; i++) {
    const t = wordTimings[Math.floor((i / count) * n)]?.start;
    const frame = Number.isFinite(t) ? Math.round(t * fps) : Math.round((i / count) * durationInFrames);
    starts.push(Math.min(frame, durationInFrames - 1));
  }
  starts.push(durationInFrames);
  // Keep boundaries strictly increasing so no clip has a zero/negative span.
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] <= starts[i - 1]) starts[i] = Math.min(starts[i - 1] + 1, durationInFrames);
  }
  return Array.from({ length: count }, (_, i) => ({
    from: starts[i],
    frames: Math.max(1, starts[i + 1] - starts[i]),
  }));
}

// Persistent top watermark — suppressed during the sting so the BrandSting
// can own the watermark area as it animates into place.
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
    }}>
      {logo ? (
        <Img
          src={staticFile(logo)}
          style={{ width: 150, height: 150, objectFit: 'contain', opacity: 0.5, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}
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
  );
};

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
  const timings = buildTimings((clips || []).length, durationInFrames, wordTimings, fps);

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

      {/* Brand color grade — warm shadows, cool blacks, edge vignette */}
      <ColorGrade accent={grade.watermark} />

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

      {/* Reveal stinger — fires the instant the hook hands off to captions */}
      <Sequence from={Math.max(0, hookEndFrame - 4)} durationInFrames={STINGER_FRAMES}>
        <RevealStinger accent={grade.watermark} />
      </Sequence>

      {/* Subtitles */}
      <SlideshowSubtitles
        narration={narration}
        audioDuration={audioDuration}
        wordTimings={wordTimings}
        genre={genre}
        startFrame={hookEndFrame}
      />

      {/* Per-scene lower-third callouts (skips scene 1, owned by the hook) */}
      <SceneCallouts scenes={scenes} timings={timings} accent={grade.watermark} />

      {/* CTA card — last 3 seconds */}
      <Sequence from={durationInFrames - 90} durationInFrames={90}>
        <CtaCard accent={grade.watermark} logo={logo} />
      </Sequence>

      {/* Persistent brand watermark, top-middle (anti-theft). Suppressed for
          the first ~30 frames while BrandSting animates into the same spot. */}
      <TopWatermark grade={grade} channelName={channelName} logo={logo} />

      {/* Branded opener — runs frame 0 to STING_FRAMES, then disappears */}
      <Sequence from={0} durationInFrames={STING_FRAMES + 2}>
        <BrandSting accent={grade.watermark} logo={logo} channelName={channelName} />
      </Sequence>
    </div>
  );
};
