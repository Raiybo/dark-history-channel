import { useCurrentFrame, useVideoConfig, interpolate, spring, Audio, staticFile } from 'remotion';

const NEON_COLORS = ['#FFE600', '#FF006E', '#00F5FF', '#39FF14', '#FF6B00', '#BF5FFF'];

function getWordGroups(text, groupSize = 3) {
  const words = text.split(' ');
  const groups = [];
  for (let i = 0; i < words.length; i += groupSize) {
    groups.push(words.slice(i, i + groupSize).join(' '));
  }
  return groups;
}

export const ChapterScene = ({ chapter, chapterIndex, totalChapters, audioSrc }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const groups = getWordGroups(chapter.narration, 3);
  const framesPerGroup = Math.max(1, Math.floor((durationInFrames - 20) / groups.length));
  const currentGroupIndex = Math.min(Math.floor(Math.max(0, frame - 10) / framesPerGroup), groups.length - 1);
  const currentGroup = groups[currentGroupIndex] || '';
  const groupFrame = (frame - 10) % framesPerGroup;

  // Pop-in animation for each new word group
  const popScale = spring({ frame: groupFrame, fps, config: { damping: 12, stiffness: 300 } });
  const popOpacity = interpolate(groupFrame, [0, 4], [0, 1], { extrapolateRight: 'clamp' });

  // Accent color cycles per chapter
  const accentColor = NEON_COLORS[chapterIndex % NEON_COLORS.length];

  // Chapter label slide in
  const labelOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Background pulse
  const bgPulse = Math.sin(frame / fps * 2) * 0.03 + 0.97;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

      {/* Audio */}
      <Audio src={staticFile(audioSrc)} />

      {/* Pulsing background accent */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at center, ${accentColor}18 0%, transparent 65%)`,
        transform: `scale(${bgPulse})`
      }} />

      {/* Chapter label */}
      <div style={{
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: '"Arial Black", "Arial Bold", sans-serif',
        fontSize: 20,
        fontWeight: 900,
        letterSpacing: 6,
        textTransform: 'uppercase',
        color: accentColor,
        opacity: labelOpacity,
        textShadow: `0 0 20px ${accentColor}`,
      }}>
        {chapter.heading}
      </div>

      {/* Chapter progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#ffffff15' }}>
        <div style={{
          height: '100%',
          width: `${((chapterIndex + 1) / totalChapters) * 100}%`,
          backgroundColor: accentColor,
          transition: 'width 0.3s'
        }} />
      </div>

      {/* Main word group — brainrot subtitle style */}
      <div style={{
        textAlign: 'center',
        padding: '0 120px',
        transform: `scale(${0.7 + popScale * 0.3})`,
        opacity: popOpacity,
      }}>
        {currentGroup.split(' ').map((word, i) => {
          // Highlight slang words in accent color
          const slangWords = ['rizz', 'sigma', 'ohio', 'skibidi', 'gyatt', 'npc', 'mewing', 'based', 'delulu', 'cooked', 'slay', 'bussin', 'glazing', 'ratio', 'cap', 'aura', 'lowkey', 'highkey', 'bestie', 'fr', 'mid', 'era', 'w', 'l'];
          const isSlang = slangWords.some(s => word.toLowerCase().replace(/[^a-z]/g, '').includes(s));

          return (
            <span
              key={i}
              style={{
                fontFamily: '"Arial Black", "Arial Bold", Impact, sans-serif',
                fontSize: 96,
                fontWeight: 900,
                textTransform: 'uppercase',
                color: isSlang ? accentColor : '#FFFFFF',
                textShadow: isSlang
                  ? `0 0 30px ${accentColor}, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000`
                  : '-4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000',
                lineHeight: 1.1,
                display: 'inline-block',
                marginRight: 16
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Chapter counter bottom right */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        right: 60,
        fontFamily: '"Arial Black", sans-serif',
        fontSize: 18,
        fontWeight: 900,
        color: '#ffffff50',
        letterSpacing: 2
      }}>
        {chapterIndex + 1} / {totalChapters}
      </div>
    </div>
  );
};
