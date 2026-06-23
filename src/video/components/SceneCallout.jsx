import { useCurrentFrame, interpolate, spring, Sequence } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();

// One little badge per scene that slides in from the left when the visual cuts.
// Lives between the captions (bottom) and the watermark (top) — never collides.
// Uses the scene's `keyword` (the Pexels query), Title-Cased and trimmed.
function tidy(keyword) {
  return (keyword || '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 28);
}

const HOLD_FRAMES = 30; // ~1s on-screen before it slides back out

const Badge = ({ keyword, accent }) => {
  const frame = useCurrentFrame();
  const text = tidy(keyword);
  if (!text) return null;

  const slideIn = spring({ frame, fps: 30, config: { damping: 16, stiffness: 260, mass: 0.6 } });
  const translateX = interpolate(slideIn, [0, 1], [-220, 0]);
  const slideOut = interpolate(frame, [HOLD_FRAMES, HOLD_FRAMES + 8], [0, 220], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 4, HOLD_FRAMES, HOLD_FRAMES + 8], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'absolute',
      left: 28,
      bottom: 430,
      transform: `translateX(${translateX + slideOut}px)`,
      opacity,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 6,
        height: 36,
        backgroundColor: accent,
        boxShadow: `0 0 14px ${accent}`,
        borderRadius: 2,
      }} />
      <div style={{
        fontFamily,
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.55)',
        padding: '6px 14px',
        borderRadius: 4,
        textShadow: '0 2px 8px rgba(0,0,0,0.95)',
        backdropFilter: 'blur(4px)',
      }}>
        {text}
      </div>
    </div>
  );
};

// One Badge per scene boundary, gated to its scene window so each fires fresh.
export const SceneCallouts = ({ scenes, timings, accent }) => {
  if (!scenes || !timings || timings.length === 0) return null;
  return (
    <>
      {scenes.map((scene, i) => {
        const t = timings[i];
        if (!t) return null;
        // Skip the very first scene — the hook owns the opening real estate.
        if (i === 0) return null;
        const dur = Math.min(t.frames, HOLD_FRAMES + 14);
        return (
          <Sequence key={`callout-${i}`} from={t.from} durationInFrames={dur}>
            <Badge keyword={scene.keyword} accent={accent} />
          </Sequence>
        );
      })}
    </>
  );
};
