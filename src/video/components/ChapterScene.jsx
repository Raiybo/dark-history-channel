import { useCurrentFrame, interpolate, Audio, staticFile } from 'remotion';

export const ChapterScene = ({ chapter, chapterIndex, totalChapters, audioSrc }) => {
  const frame = useCurrentFrame();

  const headingOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const headingY = interpolate(frame, [0, 20], [-16, 0], { extrapolateRight: 'clamp' });

  const lineWidth = interpolate(frame, [15, 45], [0, 280], { extrapolateRight: 'clamp' });

  const textOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [30, 55], [12, 0], { extrapolateRight: 'clamp' });

  const chapterNumOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '80px 160px'
    }}>
      {/* Audio for this chapter */}
      <Audio src={staticFile(audioSrc)} />

      {/* Chapter number */}
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 14,
        letterSpacing: 6,
        color: '#5a3a28',
        textTransform: 'uppercase',
        opacity: chapterNumOpacity,
        marginBottom: 20
      }}>
        Chapter {chapterIndex + 1} of {totalChapters}
      </div>

      {/* Chapter heading */}
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 46,
        fontWeight: 'bold',
        color: '#c9a84c',
        opacity: headingOpacity,
        transform: `translateY(${headingY}px)`,
        textShadow: '0 0 30px rgba(201,168,76,0.3)',
        lineHeight: 1.2,
        marginBottom: 24
      }}>
        {chapter.heading}
      </div>

      {/* Decorative line */}
      <div style={{
        width: lineWidth,
        height: 1,
        backgroundColor: '#8b1a1a',
        marginBottom: 36,
        opacity: 0.7
      }} />

      {/* Narration text */}
      <div style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 28,
        lineHeight: 1.8,
        color: '#d4c4a8',
        opacity: textOpacity,
        transform: `translateY(${textY}px)`,
        maxWidth: 1200,
        textShadow: '0 1px 4px rgba(0,0,0,0.6)'
      }}>
        {chapter.narration}
      </div>
    </div>
  );
};
