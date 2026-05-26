import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';
import { HOOK_FRAMES } from './HookScene.jsx';

const { fontFamily } = loadFont();

const GROUP_SIZE = 3;

// Show the highlight slightly ahead of the audio so captions land on the beat
// instead of trailing the voice. Reel captions normally lead by ~0.1-0.2s.
const LEAD_SECONDS = 0.15;

const GENRE_ACCENT = {
  didyouknow: '#FFC83D',
};

// Chunk words into display groups of <= GROUP_SIZE, never crossing a sentence
// boundary (segStart), so the words on screen belong to the line being spoken.
function buildGroups(timings) {
  const groups = [];
  let cur = [];
  timings.forEach((t, i) => {
    if ((t.segStart && cur.length) || cur.length === GROUP_SIZE) {
      groups.push(cur);
      cur = [];
    }
    cur.push(i);
  });
  if (cur.length) groups.push(cur);
  return groups;
}

export const SlideshowSubtitles = ({ narration, audioDuration, wordTimings, genre, startFrame = HOOK_FRAMES }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const accent = GENRE_ACCENT[genre] || GENRE_ACCENT.didyouknow;

  const fadeIn = interpolate(frame, [startFrame, startFrame + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentTime = frame / fps + LEAD_SECONDS;

  let timings = wordTimings?.length > 0 ? wordTimings : null;
  if (!timings && narration) {
    const words = narration.trim().split(/\s+/);
    const totalSeconds = audioDuration || durationInFrames / fps;
    timings = words.map((word, i) => ({
      word,
      start: (i / words.length) * totalSeconds,
      end: ((i + 1) / words.length) * totalSeconds,
      segStart: false,
    }));
  }
  if (!timings) return null;

  // Active word = last word whose (lead-adjusted) start time has passed.
  let currentWordIndex = 0;
  for (let i = 0; i < timings.length; i++) {
    if (timings[i].start <= currentTime) currentWordIndex = i;
    else break;
  }

  const groups = buildGroups(timings);
  const currentGroup = groups.find((g) => g.includes(currentWordIndex)) || groups[0] || [];

  const groupStartFrame = Math.round((timings[currentGroup[0]]?.start ?? 0) * fps);
  const frameInGroup = Math.max(0, frame - groupStartFrame);
  const popScale = spring({ frame: frameInGroup, fps, config: { damping: 18, stiffness: 320 } });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingBottom: 185,
      paddingLeft: 32,
      paddingRight: 32,
      opacity: fadeIn,
      pointerEvents: 'none',
    }}>
      <div style={{
        textAlign: 'center',
        transform: `scale(${0.94 + popScale * 0.06})`,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '4px 8px',
      }}>
        {currentGroup.map((wi) => {
          const isActive = wi === currentWordIndex;
          return (
            <span
              key={wi}
              style={{
                display: 'inline-block',
                fontFamily,
                fontSize: 78,
                fontWeight: 900,
                letterSpacing: -1,
                textTransform: 'uppercase',
                lineHeight: 1.2,
                ...(isActive ? {
                  backgroundColor: accent,
                  color: '#000',
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 2,
                  paddingBottom: 4,
                } : {
                  color: '#FFFFFF',
                  textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.98)',
                }),
              }}
            >
              {timings[wi].word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
