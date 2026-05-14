import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';
import { HOOK_FRAMES } from './HookScene.jsx';

const { fontFamily } = loadFont();

const GROUP_SIZE = 3;

const GENRE_ACCENT = {
  money:    '#00D97E',
  future:   '#00C8FF',
  optimize: '#F5A623',
};

export const SlideshowSubtitles = ({ narration, audioDuration, wordTimings, genre }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const accent = GENRE_ACCENT[genre] || GENRE_ACCENT.future;

  const fadeIn = interpolate(frame, [HOOK_FRAMES, HOOK_FRAMES + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentTime = frame / fps;

  let timings = wordTimings?.length > 0 ? wordTimings : null;
  if (!timings && narration) {
    const words = narration.trim().split(/\s+/);
    const totalSeconds = audioDuration || durationInFrames / fps;
    timings = words.map((word, i) => ({
      word,
      start: (i / words.length) * totalSeconds,
      end: ((i + 1) / words.length) * totalSeconds,
    }));
  }
  if (!timings) return null;

  let currentWordIndex = 0;
  for (let i = 0; i < timings.length; i++) {
    if (timings[i].start <= currentTime) currentWordIndex = i;
    else break;
  }

  const currentGroupIndex = Math.floor(currentWordIndex / GROUP_SIZE);
  const groupStart = currentGroupIndex * GROUP_SIZE;
  const currentGroup = timings.slice(groupStart, groupStart + GROUP_SIZE);

  const groupStartFrame = Math.round((timings[groupStart]?.start ?? 0) * fps);
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
        {currentGroup.map(({ word }, i) => {
          const isActive = groupStart + i === currentWordIndex;
          return (
            <span
              key={`${currentGroupIndex}-${i}`}
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
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
