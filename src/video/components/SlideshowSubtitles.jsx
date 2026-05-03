import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';
import { HOOK_FRAMES } from './HookScene.jsx';

const { fontFamily } = loadFont();

const GROUP_SIZE = 3;

export const SlideshowSubtitles = ({ narration, audioDuration, wordTimings, genre }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [HOOK_FRAMES, HOOK_FRAMES + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentTime = frame / fps;

  let timings = wordTimings && wordTimings.length > 0 ? wordTimings : null;
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

  const groupStartTime = timings[groupStart]?.start ?? 0;
  const groupStartFrame = Math.round(groupStartTime * fps);
  const frameInGroup = Math.max(0, frame - groupStartFrame);
  const popScale = spring({ frame: frameInGroup, fps, config: { damping: 18, stiffness: 320 } });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingBottom: 175,
      paddingLeft: 40,
      paddingRight: 40,
      opacity: fadeIn,
      pointerEvents: 'none',
    }}>
      <div style={{
        textAlign: 'center',
        transform: `scale(${0.92 + popScale * 0.08})`,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0 12px',
      }}>
        {currentGroup.map(({ word }, i) => {
          const isActive = groupStart + i === currentWordIndex;
          return (
            <span
              key={`${currentGroupIndex}-${i}`}
              style={{
                display: 'inline-block',
                fontFamily,
                fontSize: 64,
                fontWeight: 900,
                letterSpacing: -0.5,
                textTransform: 'uppercase',
                lineHeight: 1.25,
                ...(isActive ? {
                  backgroundColor: '#FFD600',
                  color: '#000000',
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 2,
                  paddingBottom: 2,
                } : {
                  color: '#FFFFFF',
                  textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 12px rgba(0,0,0,0.9)',
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
