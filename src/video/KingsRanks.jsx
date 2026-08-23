import {
  AbsoluteFill, Img, OffthreadVideo, staticFile, Loop, Audio,
  useVideoConfig, useCurrentFrame, interpolate, spring, Sequence,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();
const GOLD = '#FFC83D';
const CROSSFADE = 12;
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

// Per-item on-screen window layout. In NARRATED mode the windows follow the
// narrator's beats (each clip stays up exactly while its line is spoken); in
// SILENT mode they're equal slices. Both produce {introFrames, starts[], ends[],
// outroStart} so every overlay reads timing the same way.
const computeLayout = (beats, n, fps, durationInFrames) => {
  if (beats && beats.length >= n) {
    // NARRATED: beats = [line_0 … line_{n-1}, (outro)]. No hook, no title card —
    // the first clip starts at frame 0 and the narration begins immediately.
    const hasOutro = beats.length >= n + 1;
    const starts = beats.slice(0, n).map(b => Math.round((b.startTime || 0) * fps));
    const outroStart = hasOutro
      ? Math.round((beats[n].startTime || durationInFrames / fps) * fps)
      : durationInFrames - Math.round(1.9 * fps);
    const ends = starts.map((s, i) => (i < n - 1 ? starts[i + 1] : outroStart));
    return { introFrames: 0, starts, ends, outroStart, narrated: true };
  }
  const introFrames = Math.round(1.8 * fps);
  const W = Math.floor((durationInFrames - introFrames) / Math.max(1, n));
  const starts = Array.from({ length: n }, (_, i) => introFrames + i * W);
  const ends = starts.map((s, i) => (i < n - 1 ? starts[i + 1] : durationInFrames));
  return { introFrames, starts, ends, outroStart: durationInFrames - Math.round(1.9 * fps), narrated: false };
};

const activeIndexFor = (frame, layout) => {
  if (frame < layout.introFrames) return -1;
  for (let i = 0; i < layout.starts.length; i++) {
    if (frame < layout.ends[i]) return i;
  }
  return layout.starts.length - 1;   // during the outro, keep #1 highlighted
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

// Fills its parent, LOOPING video so short clips never freeze (OffthreadVideo has
// no loop prop in Remotion 4.x). clip = { path, duration }. When clipVolume > 0
// the clip's OWN audio plays (the funny sounds) instead of being muted.
// `loop=false` plays the clip once and then HOLDS its last frame — used for the
// #1 clip so it freezes (never visibly replays) under the SUBSCRIBE outro.
const LoopedClip = ({ clip, fps, clipVolume = 0, loop = true }) => {
  if (!clip || !clip.path) return <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0a0a12' }} />;
  if (IMAGE_RE.test(clip.path)) return <KenBurnsImage path={clip.path} />;
  const video = (
    <OffthreadVideo src={staticFile(clip.path)} muted={clipVolume <= 0} volume={clipVolume} playbackRate={1}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
  );
  if (!loop) return video;   // play once, then Remotion holds the final frame
  const secs = Math.min(Math.max(clip.duration || 4, 1.5), 30);
  const loopFrames = Math.max(1, Math.floor(secs * fps) - 2);
  return <Loop durationInFrames={loopFrames}>{video}</Loop>;
};

// Small creator credit (bottom-right) — required attribution for licensed /
// permitted clips so the source account is always visible on screen.
const Credit = ({ handle }) => {
  if (!handle) return null;
  return (
    <div style={{ position: 'absolute', bottom: 26, right: 22, pointerEvents: 'none', zIndex: 40 }}>
      <span style={{ fontFamily, fontWeight: 700, fontSize: 22, letterSpacing: 0.5, color: 'rgba(255,255,255,0.82)', textShadow: '0 2px 8px rgba(0,0,0,0.98)' }}>
        🎬 @{handle}
      </span>
    </div>
  );
};

// Full-screen background clip for one item. Light scrims only — just enough on
// the left for the slim leaderboard to read, and a soft bottom edge.
const ClipLayer = ({ clip, fps, clipVolume, credit, isFirst, loop = true }) => {
  const frame = useCurrentFrame();
  // The very first clip is at full opacity from frame 0 (no fade-from-black),
  // so the video opens straight on footage — never a black screen.
  const op = isFirst ? 1 : interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <LoopedClip clip={clip} fps={fps} clipVolume={clipVolume} loop={loop} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 32%, rgba(0,0,0,0) 52%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 14%, transparent 78%, rgba(0,0,0,0.62) 100%)', pointerEvents: 'none' }} />
      <Credit handle={credit} />
    </AbsoluteFill>
  );
};

// Opening title card — states the goal in plain words. Fades out at the end of
// the intro window (so it covers the whole spoken hook, no black gap before #5).
const TitleCard = ({ text, introFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 200, mass: 0.6 } });
  const fadeStart = Math.max(6, introFrames - 12);
  const out = interpolate(frame, [fadeStart, introFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
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

// Kinetic spoken-word captions (bottom center) — the current narrated sentence,
// with the word being spoken highlighted gold. Helps the huge share of viewers
// who watch muted. Sits low + centered, clear of the left leaderboard.
const Captions = ({ wordTimings = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!wordTimings.length) return null;
  const t = frame / fps;

  // Group words by sentence index and show the sentence currently being spoken.
  const segs = new Map();
  for (const w of wordTimings) {
    if (!segs.has(w.seg)) segs.set(w.seg, []);
    segs.get(w.seg).push(w);
  }
  const segIds = [...segs.keys()].sort((a, b) => a - b);
  let activeSeg = -1;
  for (const s of segIds) { if (t >= (segs.get(s)[0].start || 0)) activeSeg = s; }
  if (activeSeg < 0) return null;
  const group = segs.get(activeSeg);
  const segEnd = group[group.length - 1].end || 0;
  if (t > segEnd + 0.35) return null;   // clear during the breath before the next line

  return (
    <div style={{ position: 'absolute', bottom: 300, left: 70, right: 70, display: 'flex', justifyContent: 'center', zIndex: 25, pointerEvents: 'none' }}>
      <div style={{ maxWidth: 920, textAlign: 'center' }}>
        {group.map((w, i) => {
          const active = t >= w.start && t < w.end;
          return (
            <span key={i} style={{ fontFamily, fontWeight: 900, fontSize: 46, lineHeight: 1.18, letterSpacing: -0.5, textTransform: 'uppercase', color: active ? GOLD : '#fff', textShadow: '0 3px 14px rgba(0,0,0,0.98), 0 0 6px rgba(0,0,0,0.92)', marginRight: 13, display: 'inline-block' }}>
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// One row of the near-invisible left leaderboard. NO boxes — just text with a
// heavy shadow so the clip shows through. Only the active row (gold, larger)
// stands out; locked rows are barely there. In narrated mode the small caption
// line is hidden (the narrator + spoken captions carry the joke).
const Row = ({ item, state, pop, narrated }) => {
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
        {!narrated && active && (item.caption || item.verdict) ? (
          <div style={{ fontFamily, fontWeight: 700, fontSize: 24, lineHeight: 1.1, color: '#fff', textShadow: shadow, marginTop: 3 }}>{item.caption || item.verdict}</div>
        ) : null}
      </div>
    </div>
  );
};

// Slim persistent leaderboard — ranks 1 (top) to 5 (bottom), kept on the left.
// Numbers show the whole time; each name hides ("• • •") until the countdown
// reaches it. Timing comes from the shared layout.
const Leaderboard = ({ items, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(1, items.length);
  const activeIndex = activeIndexFor(frame, layout);
  const rows = [...items].sort((a, b) => a.rank - b.rank); // #1 top ... #5 bottom
  return (
    <div style={{ position: 'absolute', left: 30, top: 240, bottom: 240, width: 540, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, zIndex: 20 }}>
      {rows.map((item) => {
        const order = n - item.rank; // rank 5 revealed first (order 0) ... rank 1 last
        const state = activeIndex === order ? 'active' : (activeIndex >= order ? 'done' : 'locked');
        const pop = state === 'active' ? spring({ frame: frame - layout.starts[order], fps, config: { damping: 14, stiffness: 200, mass: 0.6 } }) : 0;
        return <Row key={item.rank} item={item} state={state} pop={pop} narrated={layout.narrated} />;
      })}
    </div>
  );
};

// End-card CTA that pops in over the #1 reveal — drives the follow that grows a
// fresh channel. Bottom-centre so it never covers the left leaderboard.
const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  return (
    <div style={{ position: 'absolute', bottom: 150, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ transform: `scale(${0.7 + pop * 0.3})`, display: 'flex', alignItems: 'center', gap: 11, background: 'rgba(0,0,0,0.6)', border: `3px solid ${GOLD}`, borderRadius: 50, padding: '13px 26px' }}>
        <span style={{ fontSize: 34, lineHeight: 1 }}>👑</span>
        <span style={{ fontFamily, fontWeight: 900, fontSize: 31, letterSpacing: 1, color: GOLD, textShadow: '0 2px 10px rgba(0,0,0,1)' }}>SUBSCRIBE FOR DAILY RANKS</span>
      </div>
    </div>
  );
};

// Kings of Ranks ranking. SILENT mode = music + captions only (stock formats).
// NARRATED mode (clip ranks) = each clip's own audio + one quiet music bed + a
// narrator reacting to every clip + kinetic spoken captions + creator credits.
// items are in countdown display order (#5 -> #1), aligned by index with clips.
export const KingsRanks = ({
  items = [], clips = [], credits = [], titleCard = '', channelName = 'Kings of Ranks',
  logo = null, hasMusic = false,
  narration = '', audioDuration = 0, wordTimings = [], beats = [],
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const n = Math.max(1, items.length);
  const layout = computeLayout(beats, n, fps, durationInFrames);
  const narrated = layout.narrated;
  const clipVolume = narrated ? 0.55 : 0;                 // clip's own audio, ducked a touch so the narrator cuts through
  const narratorVolume = 1.15;                            // narrator sits clearly on top of the mix
  const musicVolume = narrated ? 0.06 : 0.62;             // one faint bed under narrated; full under silent

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* background clip per item */}
      {items.map((item, i) => {
        const from = layout.starts[i];
        const isLast = i === n - 1;
        const dur = isLast ? (durationInFrames - from) : (layout.ends[i] - from + CROSSFADE);
        return (
          <Sequence key={i} from={from} durationInFrames={Math.max(1, dur)}>
            {/* The #1 clip's window runs a few seconds past its length (the outro
                CTA holds over it) — freeze its last frame instead of looping so
                it never visibly replays. Earlier clips still loop as a safety net. */}
            <ClipLayer clip={clips[i]} fps={fps} clipVolume={clipVolume} credit={credits[i]} isFirst={i === 0 && narrated} loop={!(isLast && narrated)} />
          </Sequence>
        );
      })}

      {/* slim persistent left leaderboard */}
      <Leaderboard items={items} layout={layout} />

      {/* narrator beats — one Audio per beat, timed by beat.startTime */}
      {narrated && beats.map((b, i) => (
        <Sequence key={`beat-${i}`} from={Math.round((b.startTime || 0) * fps)} durationInFrames={Math.round((b.duration || 0) * fps) + 6}>
          <Audio src={staticFile(`audio/${b.file}`)} volume={narratorVolume} />
        </Sequence>
      ))}

      {/* spoken-word captions */}
      {narrated && <Captions wordTimings={wordTimings} />}

      {hasMusic && <Audio src={staticFile('music/background.mp3')} volume={musicVolume} loop />}

      {/* crown watermark — top safe zone */}
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, pointerEvents: 'none', zIndex: 30 }}>
        {logo ? <Img src={staticFile(logo)} style={{ width: 50, height: 50, objectFit: 'contain', opacity: 0.9 }} /> : null}
        <span style={{ fontFamily, fontWeight: 900, fontSize: 22, letterSpacing: 5, textTransform: 'uppercase', color: GOLD, opacity: 0.85, textShadow: '0 0 18px rgba(0,0,0,0.95)' }}>{channelName}</span>
      </div>

      {/* title card only in SILENT mode; narrated opens straight on the clip */}
      {!narrated && (
        <Sequence from={0} durationInFrames={layout.introFrames + 6}>
          <TitleCard text={titleCard} introFrames={layout.introFrames} />
        </Sequence>
      )}

      <Sequence from={layout.outroStart}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
