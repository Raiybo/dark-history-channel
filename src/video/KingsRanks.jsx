import {
  AbsoluteFill, Img, OffthreadVideo, staticFile, Loop, Audio,
  useVideoConfig, useCurrentFrame, interpolate, spring, Sequence,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();
const GOLD = '#FFC83D';
const CROSSFADE = 12;
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

// Shared timing: title card, then n equal item windows. Every overlay computes
// the same active index from the absolute frame so the left leaderboard, the
// background clip and the reveal all stay in lock-step.
const timing = (frame, fps, durationInFrames, n) => {
  const intro = Math.round(1.8 * fps);
  const W = Math.floor((durationInFrames - intro) / Math.max(1, n));
  const activeIndex = frame < intro ? -1 : Math.min(n - 1, Math.floor((frame - intro) / W));
  return { intro, W, activeIndex };
};

// Fills its parent, LOOPING the source so short stock clips never freeze
// (OffthreadVideo has no loop prop in Remotion 4.x). clip = { path, duration }.
const LoopedClip = ({ clip, fps }) => {
  if (!clip || !clip.path) return <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0a0a12' }} />;
  if (IMAGE_RE.test(clip.path)) {
    return <Img src={staticFile(clip.path)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  const secs = Math.min(Math.max(clip.duration || 4, 1.5), 30);
  const loopFrames = Math.max(1, Math.floor(secs * fps) - 2);
  return (
    <Loop durationInFrames={loopFrames}>
      <OffthreadVideo src={staticFile(clip.path)} muted playbackRate={1}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    </Loop>
  );
};

// Full-screen background clip for one item + scrims for legibility (darker on
// the left so the leaderboard always reads, and along the bottom).
const ClipLayer = ({ clip, fps }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <LoopedClip clip={clip} fps={fps} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 42%, rgba(0,0,0,0.05) 78%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 18%, transparent 78%, rgba(0,0,0,0.7) 100%)', pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

// Opening title card (first ~1.8s) — states the goal in plain words.
const TitleCard = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 200, mass: 0.6 } });
  const out = interpolate(frame, [fps * 1.3, fps * 1.7], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const words = (text || '').split(' ');
  return (
    <AbsoluteFill style={{ backgroundColor: 'rgba(4,3,10,0.82)', justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ transform: `scale(${0.7 + pop * 0.3})`, textAlign: 'center', padding: '0 60px' }}>
        <div style={{ fontSize: 64, marginBottom: 6 }}>👑</div>
        <span style={{ fontFamily, fontWeight: 900, fontSize: 92, lineHeight: 1.02, letterSpacing: -2, color: '#fff', textTransform: 'uppercase', textShadow: `0 6px 30px rgba(0,0,0,0.95), 0 0 50px ${GOLD}55` }}>
          {words.map((w, i) => <span key={i} style={{ display: 'inline-block', marginRight: 14, color: i % 3 === 1 ? GOLD : '#fff' }}>{w}</span>)}
        </span>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 34, letterSpacing: 5, color: GOLD, marginTop: 26 }}>
          COUNTING DOWN TO #1
        </div>
      </div>
    </AbsoluteFill>
  );
};

// One row of the persistent left-side leaderboard.
const Row = ({ item, state, pop }) => {
  const active = state === 'active';
  const revealed = state !== 'locked';
  const isWinner = item.rank === 1;
  const scale = 1 + (active ? pop * 0.05 : 0);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      transform: `scale(${scale})`, transformOrigin: 'left center',
      background: active ? `linear-gradient(90deg, #ffd35a 0%, ${GOLD} 100%)` : 'rgba(0,0,0,0.5)',
      border: active ? `3px solid #fff` : '2px solid rgba(255,255,255,0.14)',
      borderRadius: 18, padding: '14px 16px',
      boxShadow: active ? '0 10px 30px rgba(0,0,0,0.55)' : 'none',
    }}>
      <div style={{ minWidth: 70, textAlign: 'center' }}>
        {isWinner && active && <div style={{ fontSize: 32, lineHeight: 1, marginBottom: -8 }}>👑</div>}
        <span style={{ fontFamily, fontWeight: 900, fontSize: 64, letterSpacing: -3, color: active ? '#1a1200' : GOLD, textShadow: active ? 'none' : '0 3px 10px rgba(0,0,0,0.9)' }}>{item.rank}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily, fontWeight: 800, fontSize: active ? 44 : 40, lineHeight: 1.02, textTransform: 'uppercase', color: active ? '#1a1200' : (revealed ? '#fff' : 'rgba(255,255,255,0.45)'), textShadow: active ? 'none' : '0 2px 10px rgba(0,0,0,1)' }}>
          {revealed ? item.label : '• • •'}
        </div>
        {active && item.verdict ? (
          <div style={{ fontFamily, fontWeight: 700, fontSize: 29, lineHeight: 1.08, color: '#3a2c00', marginTop: 4 }}>{item.verdict}</div>
        ) : null}
      </div>
      {active ? (
        <div style={{ width: 86, flexShrink: 0, textAlign: 'center', borderLeft: '2px solid rgba(58,44,0,0.35)', paddingLeft: 8 }}>
          <div style={{ fontFamily, fontWeight: 900, fontSize: 44, color: '#1a1200', lineHeight: 1 }}>{item.score}</div>
          <div style={{ fontFamily, fontWeight: 800, fontSize: 13, letterSpacing: 1, color: '#3a2c00' }}>/100</div>
        </div>
      ) : null}
    </div>
  );
};

// The persistent leaderboard — ranks 1 (top) to 5 (bottom), always on the left.
// Numbers show the whole time; each name is hidden ("• • •") until the countdown
// reaches it, so the board visibly fills up toward the #1 reveal.
const Leaderboard = ({ items }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const n = Math.max(1, items.length);
  const { intro, W, activeIndex } = timing(frame, fps, durationInFrames, n);
  const rows = [...items].sort((a, b) => a.rank - b.rank); // #1 at top ... #5 at bottom
  return (
    <div style={{ position: 'absolute', left: 32, top: 150, bottom: 150, width: 660, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, zIndex: 20 }}>
      {rows.map((item) => {
        const order = n - item.rank; // rank 5 revealed first (order 0) ... rank 1 last
        const state = activeIndex === order ? 'active' : (activeIndex >= order ? 'done' : 'locked');
        const pop = state === 'active' ? spring({ frame: frame - (intro + order * W), fps, config: { damping: 14, stiffness: 200, mass: 0.6 } }) : 0;
        return <Row key={item.rank} item={item} state={state} pop={pop} />;
      })}
    </div>
  );
};

// Kings of Ranks — SILENT ranking, no voiceover: upbeat music + a persistent
// left leaderboard (ranks 1-5) over legal stock/CC clips. items are in countdown
// display order (#5 -> #1) and aligned by index with clips.
export const KingsRanks = ({
  items = [], clips = [], titleCard = '', channelName = 'Kings of Ranks', logo = null, hasMusic = false,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const n = Math.max(1, items.length);
  const intro = Math.round(1.8 * fps);
  const W = Math.floor((durationInFrames - intro) / n);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* background clip per item */}
      {items.map((item, i) => {
        const from = intro + i * W;
        const isLast = i === n - 1;
        const dur = isLast ? durationInFrames - from : W + CROSSFADE;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <ClipLayer clip={clips[i]} fps={fps} />
          </Sequence>
        );
      })}

      {/* persistent left leaderboard */}
      <Leaderboard items={items} />

      {hasMusic && <Audio src={staticFile('music/background.mp3')} volume={0.62} loop />}

      {/* crown watermark — top safe zone */}
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, pointerEvents: 'none', zIndex: 30 }}>
        {logo ? <Img src={staticFile(logo)} style={{ width: 50, height: 50, objectFit: 'contain', opacity: 0.9 }} /> : null}
        <span style={{ fontFamily, fontWeight: 900, fontSize: 22, letterSpacing: 5, textTransform: 'uppercase', color: GOLD, opacity: 0.85, textShadow: '0 0 18px rgba(0,0,0,0.95)' }}>{channelName}</span>
      </div>

      {/* title card on top during the intro */}
      <Sequence from={0} durationInFrames={intro + 15}>
        <TitleCard text={titleCard} />
      </Sequence>
    </AbsoluteFill>
  );
};
