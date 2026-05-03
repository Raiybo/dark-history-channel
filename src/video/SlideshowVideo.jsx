import { Audio, staticFile, useVideoConfig, Sequence } from 'remotion';
import { Slide } from './components/Slide.jsx';
import { HookScene, HOOK_FRAMES } from './components/HookScene.jsx';
import { SlideshowSubtitles } from './components/SlideshowSubtitles.jsx';

const CROSSFADE = 12;

const GENRE_GRADE = {
  stoic: {
    overlay: 'rgba(0, 0, 0, 0.30)',
    tint: 'rgba(20, 10, 0, 0.12)',
    vignette: 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.82) 100%)',
    letterbox: true,
  },
  future: {
    overlay: 'rgba(0, 0, 0, 0.28)',
    tint: 'rgba(0, 5, 15, 0.15)',
    vignette: 'radial-gradient(ellipse at center, transparent 28%, rgba(0,0,0,0.80) 100%)',
    letterbox: true,
  },
  optimize: {
    overlay: 'rgba(0, 0, 0, 0.25)',
    tint: 'rgba(0, 0, 0, 0.10)',
    vignette: 'radial-gradient(ellipse at center, transparent 28%, rgba(0,0,0,0.78) 100%)',
    letterbox: true,
  },
};

const WATERMARK_COLOR = {
  stoic: '#C8932A',
  future: '#00E5FF',
  optimize: '#4AFF91',
};

function buildSlideTimings(scenes, fps, durationInFrames) {
  const paths = scenes || [];
  if (paths.length === 0) return [];

  // Use scene durations from script; scale to fit actual audio length
  const totalSceneSeconds = paths.reduce((s, sc) => s + (sc.duration || 4), 0);
  const scale = durationInFrames / (totalSceneSeconds * fps);

  const timings = [];
  let cursor = 0;
  for (let i = 0; i < paths.length; i++) {
    const rawFrames = Math.round((paths[i].duration || 4) * fps * scale);
    timings.push({ from: cursor, frames: rawFrames });
    cursor += rawFrames;
  }
  return timings;
}

export const SlideshowVideo = ({
  title,
  narration,
  audioDuration,
  wordTimings,
  channelName,
  genre,
  hookText,
  imagePaths,
  scenes,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const grade = GENRE_GRADE[genre] || GENRE_GRADE.future;
  const watermarkColor = WATERMARK_COLOR[genre] || '#FFFFFF';

  const validPaths = imagePaths || [];
  const timings = buildSlideTimings(scenes || [], fps, durationInFrames);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#060606' }}>

      {/* Slides with Ken Burns + crossfade, timed per scene duration */}
      {validPaths.map((path, i) => {
        const t = timings[i];
        if (!t) return null;
        return (
          <Sequence key={i} from={t.from} durationInFrames={t.frames + CROSSFADE}>
            <Slide
              src={path}
              index={i}
              totalFrames={t.frames}
              crossfade={CROSSFADE}
              isFirst={i === 0}
              isLast={i === validPaths.length - 1}
            />
          </Sequence>
        );
      })}

      {/* Color tint */}
      <div style={{ position: 'absolute', inset: 0, background: grade.tint, pointerEvents: 'none' }} />

      {/* Dark overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: grade.overlay, pointerEvents: 'none' }} />

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, background: grade.vignette, pointerEvents: 'none' }} />

      {/* Letterbox bars (Stoic only) */}
      {grade.letterbox && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110, backgroundColor: '#000' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, backgroundColor: '#000' }} />
        </>
      )}

      {/* Audio */}
      <Audio src={staticFile('audio/narration.mp3')} />

      {/* Hook scene — first 5 seconds */}
      <Sequence from={0} durationInFrames={HOOK_FRAMES + 25}>
        <HookScene hookText={hookText || ''} genre={genre} />
      </Sequence>

      {/* Subtitles — appear after hook fades */}
      <SlideshowSubtitles narration={narration} audioDuration={audioDuration} wordTimings={wordTimings} genre={genre} />

      {/* Channel watermark */}
      <div style={{
        position: 'absolute',
        top: grade.letterbox ? 125 : 70,
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: '"Arial Black", Impact, sans-serif',
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: 6,
          textTransform: 'uppercase',
          color: watermarkColor,
          opacity: 0.85,
          textShadow: '0 0 20px rgba(0,0,0,0.8)',
        }}>
          {channelName}
        </div>
      </div>
    </div>
  );
};
