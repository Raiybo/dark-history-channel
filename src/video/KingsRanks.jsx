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

// A still photo with a slow Ken-Burns zoom so real subject photos feel like
// footage rather than a frozen frame.
const KenBurnsImage = ({ path }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = 1.06 + Math.min(frame / (6.5 * fps), 1) * 0.14;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(path)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }} />
    </AbsoluteFill>
  );
};

// Fills its parent, LOOPING video so short stock clips never freeze
// (OffthreadVideo has no loop prop in Remotion 4.x). clip = { path, duration }.
const LoopedClip = ({ clip, fps }) => {
  if (!clip || !clip.path) return <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0a0a12' }} />;
  if (IMAGE_RE.test(clip.path)) return <KenBurnsImage path={clip.path} />;
  const secs = Math.min(Math.max(clip.duration || 4, 1.5), 30);
  const loopFrames = Math.max(1, Math.floor(secs * fps) - 2);
  return (
    <Loop durationInFrames={loopFrames}>
      <OffthreadVideo src={staticFile(clip.path)} muted playbackRate={1}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    </Loop>
  );
};

// Full-screen background clip for one item. Light scrims only — just enough on
// the left for the slim leaderboard to read, and a soft bottom edge. The clip
// stays the star of the frame.
const ClipLayer = ({ clip, fps }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <LoopedClip clip={clip} fps={fps} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 32%, rgba(0,0,0,0) 52%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 14%, transparent 86%, rgba(0,0,0,0.5) 100%)', pointerEvents: 'none' }} />
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
          WAIT FOR #1 😂
        </div>
      </div>
    </AbsoluteFill>
  );
};

// One row of the near-invisible left leaderboard. NO boxes/backgrounds — just
// text with heavy shadow so the clip shows through everywhere. Only the active
// row (gold, larger) and its caption stand out; locked rows are barely there.
const Row = ({ item, state, pop }) => {
  const active = state === 'active';
  const revealed = state !== 'locked';
  const isWinner = item.rank === 1;
  const scale = 1 + (active ? pop * 0.06 : 0);
  const shadow = '0 2px 10px rgba(0,0,0,0.95), 0 0 5px rgba(0,0,0,0.9)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, transform: `scale(${scale})`, transformOrigin: 'left center', opacity: revealed ? 1 : 0.42 }}>
      <div style={{ minWidth: 44, textAlign: 'center' }}>
        {isWinner && active && <div style={{ fontSize: 26, lineHeight: 1, marginBottom: -6, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.95))' }}>👑</div>}
        <span style={{ fontFamily, fontWeight: 900, fontSize: active ? 52 : 34, letterSpacing: -2, color: GOLD, textShadow: shadow, opacity: active ? 1 : 0.85 }}>{item.rank}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily, fontWeight: 800, fontSize: active ? 36 : 25, lineHeight: 1.04, textTransform: 'uppercase', color: active ? GOLD : '#fff', textShadow: shadow, whiteSpace: active ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: active ? 'clip' : 'ellipsis' }}>
          {revealed ? item.label : '• • •'}
        </div>
        {active && (item.caption || item.verdict) ? (
          <div style={{ fontFamily, fontWeight: 700, fontSize: 24, lineHeight: 1.1, color: '#fff', textShadow: shadow, marginTop: 3 }}>{item.caption || item.verdict}</div>
        ) : null}
      </div>
    </div>
  );
};

// Slim persistent leaderboard — ranks 1 (top) to 5 (bottom), kept on the left.
// Compact and semi-transparent so the clip stays visible; numbers show the whole
// time, each name hides ("• • •") until the countdown reaches it.
const Leaderboard = ({ items }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const n = Math.max(1, items.length);
  const { intro, W, activeIndex } = timing(frame, fps, durationInFrames, n);
  const rows = [...items].sort((a, b) => a.rank - b.rank); // #1 top ... #5 bottom
  return (
    <div style={{ position: 'absolute', left: 30, top: 240, bottom: 240, width: 540, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, zIndex: 20 }}>
      {rows.map((item) => {
        const order = n - item.rank; // rank 5 revealed first (order 0) ... rank 1 last
        const state = activeIndex === order ? 'active' : (activeIndex >= order ? 'done' : 'locked');
        const pop = state === 'active' ? spring({ frame: frame - (intro + order * W), fps, config: { damping: 14, stiffness: 200, mass: 0.6 } }) : 0;
        return <Row key={item.rank} item={item} state={state} pop={pop} />;
      })}
    </div>
  );
};

// End-card CTA that pops in over the #1 reveal — drives the follow that grows
// a fresh channel. Sits bottom-centre so it never covers the left leaderboard.
const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  return (
    <div style={{ position: 'absolute', bottom: 150, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ transform: `scale(${0.7 + pop * 0.3})`, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.55)', border: `3px solid ${GOLD}`, borderRadius: 50, padding: '13px 30px' }}>
        <span style={{ fontSize: 38, lineHeight: 1 }}>👑</span>
        <span style={{ fontFamily, fontWeight: 900, fontSize: 40, letterSpacing: 2, color: GOLD, textShadow: '0 2px 10px rgba(0,0,0,1)' }}>FOLLOW FOR MORE</span>
      </div>
    </div>
  );
};

// Kings of Ranks — SILENT ranking, no voiceover: upbeat music + a slim, persistent
// left leaderboard (ranks 1-5) over real photos of the actual subjects (Wikimedia /
// public domain) with generic stock as fallback. items are in countdown display
// order (#5 -> #1) and aligned by index with clips.
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

      {/* slim persistent left leaderboard */}
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

      <Sequence from={durationInFrames - Math.round(1.9 * fps)}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
