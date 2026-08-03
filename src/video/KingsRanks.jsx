import {
  AbsoluteFill, Img, OffthreadVideo, staticFile, Loop, Audio,
  useVideoConfig, useCurrentFrame, interpolate, spring, Sequence,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();
const GOLD = '#FFC83D';
const CROSSFADE = 12;
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const RUBRIC = 'OVERKILL INDEX'; // the channel's signature owned scale

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

// Opening title card (first ~1.8s) — the promise + the signature rubric.
const TitleCard = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 200, mass: 0.6 } });
  const out = interpolate(frame, [fps * 1.3, fps * 1.7], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const words = (text || '').split(' ');
  return (
    <AbsoluteFill style={{ backgroundColor: 'rgba(4,3,10,0.74)', justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ transform: `scale(${0.7 + pop * 0.3})`, textAlign: 'center', padding: '0 60px' }}>
        <div style={{ fontSize: 64, marginBottom: 6 }}>👑</div>
        <span style={{ fontFamily, fontWeight: 900, fontSize: 92, lineHeight: 1.02, letterSpacing: -2, color: '#fff', textTransform: 'uppercase', textShadow: `0 6px 30px rgba(0,0,0,0.95), 0 0 50px ${GOLD}55` }}>
          {words.map((w, i) => <span key={i} style={{ display: 'inline-block', marginRight: 14, color: i % 3 === 1 ? GOLD : '#fff' }}>{w}</span>)}
        </span>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 30, letterSpacing: 6, color: GOLD, marginTop: 26, opacity: 0.95 }}>
          RANKED ON THE {RUBRIC}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// The signature ranking graphic: the Overkill Index score counts up on reveal
// and a bar fills to the score. This is the recurring brand element on every item.
const ScoreMeter = ({ score, isWinner }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - 4, fps, config: { damping: 200, stiffness: 90, mass: 1 } });
  const shown = Math.round((score || 0) * t);
  const pct = Math.max(0, Math.min(100, score || 0)) * t;
  return (
    <div style={{ width: 560, maxWidth: '82%', textAlign: 'center' }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 30, letterSpacing: 8, color: GOLD, textShadow: '0 2px 12px rgba(0,0,0,1)' }}>{RUBRIC}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 2 }}>
        <span style={{ fontFamily, fontWeight: 900, fontSize: isWinner ? 168 : 140, lineHeight: 1, color: '#fff', letterSpacing: -4, WebkitTextStroke: `4px ${GOLD}`, paintOrder: 'stroke fill', textShadow: '0 8px 30px rgba(0,0,0,0.95)' }}>{shown}</span>
        <span style={{ fontFamily, fontWeight: 900, fontSize: 54, color: GOLD, textShadow: '0 4px 16px rgba(0,0,0,1)' }}>/100</span>
      </div>
      <div style={{ marginTop: 10, height: 16, borderRadius: 10, background: 'rgba(255,255,255,0.18)', overflow: 'hidden', border: '2px solid rgba(0,0,0,0.5)' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 10, background: `linear-gradient(90deg, ${GOLD}, #ff8a1e)`, boxShadow: `0 0 18px ${GOLD}` }} />
      </div>
    </div>
  );
};

// One ranked item: looped clip + rank badge + Overkill Index score + label +
// original verdict. Captions ARE the info (no voiceover), so they're big & legible.
const ItemScene = ({ item, clip, fps }) => {
  const frame = useCurrentFrame();
  const inOp = interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: 'clamp' });
  const rank = item?.rank;
  const isWinner = rank === 1;
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const badgeScale = 0.6 + pop * 0.4;
  return (
    <AbsoluteFill style={{ opacity: inOp }}>
      <LoopedClip clip={clip} fps={fps} />
      {/* legibility scrims top + bottom */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 24%, transparent 50%, rgba(0,0,0,0.88) 100%)', pointerEvents: 'none' }} />

      {/* rank badge — inside top safe zone (>180px) */}
      <div style={{ position: 'absolute', top: 196, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `scale(${badgeScale})` }}>
        <div style={{ textAlign: 'center' }}>
          {isWinner && <div style={{ fontSize: 70, lineHeight: 1, marginBottom: -14, filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.9))' }}>👑</div>}
          <div style={{ fontFamily, fontWeight: 900, letterSpacing: -6, fontSize: isWinner ? 132 : 104, color: isWinner ? GOLD : '#fff', WebkitTextStroke: `5px ${isWinner ? '#3a2c00' : GOLD}`, paintOrder: 'stroke fill', textShadow: '0 8px 34px rgba(0,0,0,0.95)' }}>#{rank}</div>
        </div>
      </div>

      {/* Overkill Index score graphic — visual centre of the frame */}
      <div style={{ position: 'absolute', top: 720, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <ScoreMeter score={item?.score} isWinner={isWinner} />
      </div>

      {/* label + original verdict — above bottom safe zone (320px) */}
      <div style={{ position: 'absolute', bottom: 344, left: 40, right: 40, textAlign: 'center' }}>
        <div style={{ fontFamily, fontWeight: 900, fontSize: 74, color: '#fff', textTransform: 'uppercase', letterSpacing: -1, lineHeight: 1.02, textShadow: '0 4px 22px rgba(0,0,0,1)' }}>{item?.label || ''}</div>
        {item?.verdict ? (
          <div style={{ fontFamily, fontWeight: 700, fontSize: 40, color: GOLD, marginTop: 14, lineHeight: 1.1, textShadow: '0 3px 16px rgba(0,0,0,1)' }}>{item.verdict}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Kings of Ranks — SILENT ranking: no voiceover, music + captions + the signature
// Overkill Index over legal stock/CC clips. items ordered #5 -> #1, aligned by
// index with clips.
export const KingsRanks = ({
  items = [], clips = [], titleCard = '', channelName = 'Kings of Ranks', logo = null, hasMusic = false,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const intro = Math.round(1.8 * fps);
  const n = Math.max(1, items.length);
  const W = Math.floor((durationInFrames - intro) / n);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {items.map((item, i) => {
        const from = intro + i * W;
        const isLast = i === n - 1;
        const dur = isLast ? durationInFrames - from : W + CROSSFADE;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <ItemScene item={item} clip={clips[i]} fps={fps} />
          </Sequence>
        );
      })}

      <Sequence from={0} durationInFrames={intro + 15}>
        <TitleCard text={titleCard} />
      </Sequence>

      {hasMusic && <Audio src={staticFile('music/background.mp3')} volume={0.62} loop />}

      {/* persistent crown watermark — inside the top safe zone */}
      <div style={{ position: 'absolute', top: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, pointerEvents: 'none', zIndex: 30 }}>
        {logo ? <Img src={staticFile(logo)} style={{ width: 54, height: 54, objectFit: 'contain', opacity: 0.9 }} /> : null}
        <span style={{ fontFamily, fontWeight: 900, fontSize: 22, letterSpacing: 5, textTransform: 'uppercase', color: GOLD, opacity: 0.85, textShadow: '0 0 18px rgba(0,0,0,0.95)' }}>{channelName}</span>
      </div>
    </AbsoluteFill>
  );
};
