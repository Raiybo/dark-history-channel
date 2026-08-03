import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();
const GOLD = '#FFC83D';

// Kings of Ranks badge: shows the current rank (#5 -> #1) synced to the scene
// timeline, with a crown on the #1 payoff. timings = [{from, frames}] per scene
// (one per ranked item). Hidden until startFrame so it never clashes with the
// opening hook. Pops on each rank change.
export const RankBadge = ({ timings, startFrame = 0, accent = GOLD }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!timings || timings.length === 0 || frame < startFrame) return null;

  let idx = timings.findIndex((t, i) => {
    const next = timings[i + 1];
    return frame >= t.from && (!next || frame < next.from);
  });
  if (idx < 0) idx = timings.length - 1;

  const rank = timings.length - idx;      // scene 0 = highest number, last = #1
  const isWinner = rank === 1;
  const local = frame - timings[idx].from;
  const pop = spring({ frame: Math.max(0, local), fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const scale = 0.62 + pop * 0.38;

  return (
    <div style={{
      position: 'absolute', top: 128, left: 0, right: 0,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      pointerEvents: 'none', zIndex: 20,
    }}>
      <div style={{ transform: `scale(${scale})`, textAlign: 'center' }}>
        {isWinner && (
          <div style={{ fontSize: 78, lineHeight: 1, marginBottom: -10, filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.9))' }}>👑</div>
        )}
        <div style={{
          fontFamily, fontWeight: 900, letterSpacing: -6,
          fontSize: isWinner ? 168 : 128,
          color: isWinner ? accent : '#fff',
          WebkitTextStroke: `5px ${isWinner ? '#3a2c00' : accent}`,
          paintOrder: 'stroke fill',
          textShadow: '0 8px 34px rgba(0,0,0,0.95)',
        }}>
          #{rank}
        </div>
      </div>
    </div>
  );
};
