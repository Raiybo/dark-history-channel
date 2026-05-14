import { Audio, staticFile, useVideoConfig, Sequence } from 'remotion';
import { VideoClip } from './components/VideoClip.jsx';
import { HookScene, HOOK_FRAMES } from './components/HookScene.jsx';
import { SlideshowSubtitles } from './components/SlideshowSubtitles.jsx';

const CROSSFADE = 15;

const GENRE_GRADE = {
  money: {
    overlay:      'rgba(0, 10, 2, 0.38)',
    vignette:     'radial-gradient(ellipse at center, transparent 18%, rgba(0,0,0,0.90) 100%)',
    letterbox:    false,
    watermark:    '#00D97E',
    watermarkTop: 72,
  },
};

function buildTimings(scenes, fps, durationInFrames) {
  const sc = scenes || [];
  if (sc.length === 0) return [];
  const totalSecs = sc.reduce((s, item) => s + (item.duration || 4), 0);
  const scale = durationInFrames / (totalSecs * fps);
  let cursor = 0;
  return sc.map((item, i) => {
    const isLast = i === sc.length - 1;
    const rawFrames = Math.round((item.duration || 4) * fps * scale);
    const frames = isLast ? Math.max(rawFrames, durationInFrames - cursor) : rawFrames;
    const timing = { from: cursor, frames };
    cursor += rawFrames;
    return timing;
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
  hasMusic,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const grade = GENRE_GRADE[genre] || GENRE_GRADE.future;
  const timings = buildTimings(scenes || [], fps, durationInFrames);

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

      {/* Narration audio */}
      <Audio src={staticFile('audio/narration.mp3')} />

      {/* Background music */}
      {hasMusic && (
        <Audio src={staticFile('music/background.mp3')} volume={0.11} loop />
      )}

      {/* Hook — first 5 seconds */}
      <Sequence from={0} durationInFrames={HOOK_FRAMES + 20}>
        <HookScene hookText={hookText || ''} genre={genre} />
      </Sequence>

      {/* Subtitles */}
      <SlideshowSubtitles
        narration={narration}
        audioDuration={audioDuration}
        wordTimings={wordTimings}
        genre={genre}
      />

      {/* Channel wordmark */}
      <div style={{
        position: 'absolute',
        top: grade.watermarkTop,
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: '"Arial Black", Impact, sans-serif',
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: 9,
          textTransform: 'uppercase',
          color: grade.watermark,
          opacity: 0.70,
          textShadow: '0 0 30px rgba(0,0,0,0.95)',
        }}>
          {channelName}
        </span>
      </div>
    </div>
  );
};
