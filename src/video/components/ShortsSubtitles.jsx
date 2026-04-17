import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const NEON_COLORS = ['#FFE600', '#FF006E', '#00F5FF', '#39FF14', '#FF6B00', '#BF5FFF'];
const SLANG = ['rizz', 'sigma', 'ohio', 'skibidi', 'gyatt', 'npc', 'mewing', 'based', 'delulu', 'cooked', 'slay', 'bussin', 'glazing', 'cap', 'aura', 'lowkey', 'highkey', 'bestie', 'fr', 'mid', 'era', 'ratio', 'on god'];

function getGroups(text, size = 3) {
  const words = text.split(' ');
  const groups = [];
  for (let i = 0; i < words.length; i += size) {
    groups.push(words.slice(i, i + size));
  }
  return groups;
}

function isSlangWord(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  return SLANG.some(s => clean.includes(s));
}

export const ShortsSubtitles = ({ narration, audioDuration }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const groups = getGroups(narration, 3);
  const totalFrames = durationInFrames - 15;
  const framesPerGroup = Math.max(1, Math.floor(totalFrames / groups.length));

  const currentGroupIndex = Math.min(Math.floor(frame / framesPerGroup), groups.length - 1);
  const currentGroup = groups[currentGroupIndex] || [];
  const groupFrame = frame % framesPerGroup;

  const colorIndex = currentGroupIndex % NEON_COLORS.length;
  const accentColor = NEON_COLORS[colorIndex];

  const popScale = spring({ frame: groupFrame, fps, config: { damping: 10, stiffness: 350 } });
  const opacity = interpolate(groupFrame, [0, 3], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 60px'
    }}>
      <div style={{
        textAlign: 'center',
        transform: `scale(${0.6 + popScale * 0.4})`,
        opacity
      }}>
        {currentGroup.map((word, i) => (
          <span
            key={`${currentGroupIndex}-${i}`}
            style={{
              display: 'inline-block',
              marginRight: 12,
              fontFamily: '"Arial Black", "Arial Bold", Impact, sans-serif',
              fontSize: 110,
              fontWeight: 900,
              textTransform: 'uppercase',
              lineHeight: 1.05,
              color: isSlangWord(word) ? accentColor : '#FFFFFF',
              textShadow: isSlangWord(word)
                ? `0 0 40px ${accentColor}99, -5px -5px 0 #000, 5px -5px 0 #000, -5px 5px 0 #000, 5px 5px 0 #000`
                : `-5px -5px 0 #000, 5px -5px 0 #000, -5px 5px 0 #000, 5px 5px 0 #000`,
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
};
