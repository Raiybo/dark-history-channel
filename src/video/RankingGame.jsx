import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Loop, staticFile, Sequence,
  useVideoConfig, useCurrentFrame, interpolate, spring,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';
import { SlideshowSubtitles } from './components/SlideshowSubtitles.jsx';

const { fontFamily } = loadFont();

const GOLD  = '#FFC83D';
const RED   = '#FF3355';
const GREEN = '#38E080';
const CROSSFADE = 12;

// LoopedClip — plays a Pexels stock .mp4, loops if scene outlasts the clip
// (Remotion's OffthreadVideo has no loop prop in 4.x, so we wrap in <Loop>).
// clip = { path, duration }
const LoopedClip = ({ clip, fps }) => {
  if (!clip || !clip.path) return <AbsoluteFill style={{ backgroundColor: '#0a0a12' }} />;
  const secs = Math.min(Math.max(clip.duration || 4, 1.5), 30);
  const loopFrames = Math.max(1, Math.floor(secs * fps) - 2);
  return (
    <Loop durationInFrames={loopFrames}>
      <OffthreadVideo src={staticFile(clip.path)} muted playbackRate={1}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    </Loop>
  );
};

// Rank badge — huge "#5" number in top-left that pops in on scene start.
// Color shifts as rank climbs: green → gold → red (higher rank = more $$$).
const RankBadge = ({ rank }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const scale = 0.6 + pop * 0.4;
  const color = rank === 1 ? RED : (rank <= 2 ? '#FF7733' : (rank === 3 ? GOLD : GREEN));
  return (
    <div style={{
      position: 'absolute', top: 130, left: 40,
      transform: `scale(${scale})`,
      display: 'flex', alignItems: 'baseline', gap: 6,
      pointerEvents: 'none',
    }}>
      <span style={{
        fontFamily, fontWeight: 900, fontSize: 44,
        color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,0.95)',
      }}>#</span>
      <span style={{
        fontFamily, fontWeight: 900, fontSize: 220, lineHeight: 0.85,
        color, letterSpacing: -8,
        textShadow: `0 6px 30px rgba(0,0,0,0.95), 0 0 40px ${color}66`,
      }}>{rank}</span>
    </div>
  );
};

// Text overlay banner (bottom-third) — the "reveal" of the cost/score.
// Slams in from below with a spring, holds, then a slight glow pulse.
const TextOverlay = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 24, fps, config: { damping: 14, stiffness: 220, mass: 0.6 } });
  const y = interpolate(pop, [0, 1], [80, 0]);
  const opacity = interpolate(frame, [24, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow = 0.6 + Math.sin(frame / 12) * 0.4;
  return (
    <div style={{
      position: 'absolute', bottom: 380, left: 0, right: 0,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      transform: `translateY(${y}px)`, opacity,
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${RED} 0%, #FF7733 100%)`,
        padding: '18px 40px', borderRadius: 14,
        boxShadow: `0 8px 30px rgba(0,0,0,0.7), 0 0 ${30 * glow}px ${RED}88`,
        transform: 'skewX(-6deg)',
        border: '3px solid rgba(255,255,255,0.9)',
      }}>
        <span style={{
          fontFamily, fontWeight: 900, fontSize: 62, letterSpacing: 1,
          color: '#fff', textShadow: '0 3px 10px rgba(0,0,0,0.7)',
          display: 'block', transform: 'skewX(6deg)',
        }}>{text}</span>
      </div>
    </div>
  );
};

// Stock attribution — small honest label so viewers know the source is Pexels
// stock, not stolen creator content. Bottom-right corner, tiny.
const Attribution = ({ text = 'Stock: Pexels' }) => (
  <div style={{
    position: 'absolute', bottom: 20, right: 24,
    pointerEvents: 'none', zIndex: 40,
  }}>
    <span style={{
      fontFamily, fontWeight: 600, fontSize: 18, letterSpacing: 1,
      color: 'rgba(255,255,255,0.72)',
      textShadow: '0 2px 6px rgba(0,0,0,0.95)',
    }}>{text}</span>
  </div>
);

// Opening hook card — big centered text + "GUESS THE ORDER" tease during
// the first ~3s while the narrator asks the audience to predict the ranking.
const HookCard = ({ hookText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 200, mass: 0.6 } });
  const fadeOut = interpolate(frame, [fps * 2.2, fps * 3.0], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const words = (hookText || '').split(' ').filter(Boolean);
  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at 50% 40%, rgba(20,10,40,0.9) 0%, rgba(4,3,10,0.95) 70%)',
      justifyContent: 'center', alignItems: 'center', opacity: fadeOut,
    }}>
      <div style={{ transform: `scale(${0.75 + pop * 0.25})`, textAlign: 'center', padding: '0 50px' }}>
        <div style={{ fontSize: 68, marginBottom: 8 }}>💸</div>
        <span style={{
          fontFamily, fontWeight: 900, fontSize: 86, lineHeight: 1.05, letterSpacing: -2,
          color: '#fff', textTransform: 'uppercase',
          textShadow: `0 6px 30px rgba(0,0,0,0.95), 0 0 60px ${GOLD}44`,
        }}>
          {words.map((w, i) => <span key={i} style={{ display: 'inline-block', marginRight: 14, color: i % 3 === 1 ? GOLD : '#fff' }}>{w}</span>)}
        </span>
        <div style={{
          fontFamily, fontWeight: 900, fontSize: 40, letterSpacing: 6,
          color: RED, marginTop: 30, textShadow: `0 0 20px ${RED}88`,
        }}>
          GUESS THE RANK 👇
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Outro CTA — last ~5s, "Which rank shocked you? Comment below" over a dim
// background. Follows the winning clip so viewers can react.
const OutroCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  return (
    <AbsoluteFill style={{
      backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center',
    }}>
      <div style={{ transform: `scale(${0.7 + pop * 0.3})`, textAlign: 'center', padding: '0 50px' }}>
        <div style={{ fontSize: 74, marginBottom: 12 }}>🤯</div>
        <div style={{
          fontFamily, fontWeight: 900, fontSize: 70, lineHeight: 1.05, letterSpacing: -1,
          color: '#fff', textTransform: 'uppercase',
          textShadow: '0 4px 20px rgba(0,0,0,0.95)',
        }}>Which rank shocked <span style={{ color: GOLD }}>YOU</span>?</div>
        <div style={{
          fontFamily, fontWeight: 800, fontSize: 42, letterSpacing: 3,
          color: GOLD, marginTop: 30,
        }}>Comment below 👇</div>
        <div style={{
          fontFamily, fontWeight: 900, fontSize: 34, letterSpacing: 4,
          color: RED, marginTop: 24,
          background: 'rgba(0,0,0,0.4)', padding: '10px 24px', display: 'inline-block',
          border: `3px solid ${GOLD}`, borderRadius: 8,
        }}>FOLLOW FOR MORE 🎯</div>
      </div>
    </AbsoluteFill>
  );
};

// One ranked scene: full-screen clip + rank badge + text overlay + attribution.
// Ken-Burns-adjacent subtle zoom keeps even a static clip feeling alive.
const RankedScene = ({ clip, rank, textOverlay, attribution }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: 'clamp' });
  const zoom = 1.02 + Math.min(frame / (7 * fps), 1) * 0.06;
  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
        <LoopedClip clip={clip} fps={fps} />
      </div>
      {/* Scrim so overlays read — subtle radial darkening at corners */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
        pointerEvents: 'none',
      }} />
      <RankBadge rank={rank} />
      <TextOverlay text={textOverlay} />
      <Attribution text={attribution} />
    </AbsoluteFill>
  );
};

// Ranking Game composition. 50s at 30fps = 1500 frames.
// Layout:
//   Hook       0-90    (3s)
//   Rank 5   90-330    (8s)
//   Rank 4  330-570    (8s)
//   Rank 3  570-810    (8s)
//   Rank 2  810-1050   (8s)
//   Rank 1 1050-1290   (8s — the winner)
//   Outro  1290-1500   (7s CTA)
export const RankingGame = ({
  narration = '',
  audioDuration = 50,
  wordTimings = [],
  beats = [],
  hookText = '',
  clips = [],           // [{path, duration, rank, text_overlay}] ordered 5,4,3,2,1
  attribution = 'Stock: Pexels',
  channelName = 'Kings of Ranks',
  logo = null,
  hasMusic = false,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const hookFrames = Math.round(3 * fps);
  const outroFrames = Math.round(5 * fps);
  const rankTotalFrames = durationInFrames - hookFrames - outroFrames;
  const perRankFrames = Math.floor(rankTotalFrames / Math.max(1, clips.length));

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Ranked clip sequences */}
      {clips.map((c, i) => {
        const from = hookFrames + i * perRankFrames;
        const isLast = i === clips.length - 1;
        const dur = isLast ? (durationInFrames - outroFrames - from) : (perRankFrames + CROSSFADE);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <RankedScene clip={c} rank={c.rank} textOverlay={c.text_overlay || ''} attribution={attribution} />
          </Sequence>
        );
      })}

      {/* Kinetic subtitles pinned above the text overlay so they don't collide */}
      <SlideshowSubtitles
        narration={narration}
        audioDuration={audioDuration}
        wordTimings={wordTimings}
        genre="rankinggame"
        startFrame={hookFrames}
      />

      {/* Audio beats — one Audio per beat, timed by beat.startTime */}
      {(beats && beats.length > 0
        ? beats
        : [{ file: 'narration.mp3', startTime: 0, duration: audioDuration }]
      ).map((b, i) => (
        <Sequence
          key={`beat-${i}`}
          from={Math.round((b.startTime || 0) * fps)}
          durationInFrames={Math.round((b.duration || 0) * fps) + 6}
        >
          <Audio src={staticFile(`audio/${b.file}`)} />
        </Sequence>
      ))}

      {hasMusic && (
        <Audio src={staticFile('music/background.mp3')} volume={0.14} loop />
      )}

      {/* Opening hook card */}
      <Sequence from={0} durationInFrames={hookFrames + 12}>
        <HookCard hookText={hookText} />
      </Sequence>

      {/* Outro CTA */}
      <Sequence from={durationInFrames - outroFrames} durationInFrames={outroFrames}>
        <OutroCard />
      </Sequence>

      {/* Persistent brand watermark, top center — appears after hook clears */}
      <Sequence from={hookFrames + 6}>
        <div style={{
          position: 'absolute', top: 54, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
          pointerEvents: 'none', zIndex: 30,
        }}>
          {logo ? <Img src={staticFile(logo)} style={{ width: 46, height: 46, objectFit: 'contain', opacity: 0.9 }} /> : null}
          <span style={{
            fontFamily, fontWeight: 900, fontSize: 20, letterSpacing: 5,
            textTransform: 'uppercase', color: GOLD, opacity: 0.82,
            textShadow: '0 0 18px rgba(0,0,0,0.95)',
          }}>{channelName}</span>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
