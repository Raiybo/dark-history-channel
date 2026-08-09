import {
  AbsoluteFill, Img, OffthreadVideo, staticFile, Loop, Audio,
  useVideoConfig, useCurrentFrame, interpolate, spring, Sequence,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont();
const GOLD = '#FFC83D';
const BLUE = '#37B6FF';
const RED = '#FF6A4D';
const CROSSFADE = 12;
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

const KenBurnsImage = ({ path }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = 1.06 + Math.min(frame / (8 * fps), 1) * 0.14;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(path)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }} />
    </AbsoluteFill>
  );
};

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

const Scrims = () => (
  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 20%, transparent 52%, rgba(0,0,0,0.88) 100%)', pointerEvents: 'none' }} />
);

// Opening hook: "HAVE YOU EVER THOUGHT..." + the interesting question.
const HookCard = ({ hook, question }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 200, mass: 0.6 } });
  const out = interpolate(frame, [fps * 2.3, fps * 2.9], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: 'rgba(4,3,10,0.86)', justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ transform: `scale(${0.75 + pop * 0.25})`, textAlign: 'center', padding: '0 70px' }}>
        <div style={{ fontSize: 70, marginBottom: 10 }}>🤔</div>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 34, letterSpacing: 4, color: GOLD, marginBottom: 22 }}>
          {(hook || 'HAVE YOU EVER THOUGHT…').toUpperCase()}
        </div>
        <div style={{ fontFamily, fontWeight: 900, fontSize: 76, lineHeight: 1.06, color: '#fff', textTransform: 'uppercase', letterSpacing: -1, textShadow: '0 6px 30px rgba(0,0,0,0.95)' }}>
          {question}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// One contender: full-screen clip + a big side badge + name + one key fact.
const ContenderScene = ({ clip, side, accent, name, fact, fps }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: 'clamp' });
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 210, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <LoopedClip clip={clip} fps={fps} />
      <Scrims />
      {/* side badge */}
      <div style={{ position: 'absolute', top: 210, left: 44, transform: `scale(${0.6 + pop * 0.4})`, transformOrigin: 'left center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 96, height: 96, borderRadius: 22, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 30px ${accent}88`, border: '4px solid #fff' }}>
            <span style={{ fontFamily, fontWeight: 900, fontSize: 62, color: '#0a0a12' }}>{side}</span>
          </div>
          <span style={{ fontFamily, fontWeight: 900, fontSize: 34, letterSpacing: 4, color: '#fff', textShadow: '0 3px 14px rgba(0,0,0,1)' }}>OPTION {side}</span>
        </div>
      </div>
      {/* name + key fact */}
      <div style={{ position: 'absolute', bottom: 340, left: 44, right: 44 }}>
        <div style={{ fontFamily, fontWeight: 900, fontSize: 86, lineHeight: 1.0, textTransform: 'uppercase', letterSpacing: -2, color: accent, textShadow: '0 5px 24px rgba(0,0,0,1)' }}>{name}</div>
        {fact ? (
          <div style={{ fontFamily, fontWeight: 700, fontSize: 44, lineHeight: 1.12, color: '#fff', marginTop: 12, textShadow: '0 4px 18px rgba(0,0,0,1)' }}>{fact}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Winner reveal: the winner's clip + "WINNER" + name + the interesting answer.
const RevealScene = ({ clip, winnerName, answer, fps }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: 'clamp' });
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 210, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <LoopedClip clip={clip} fps={fps} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 34%, rgba(0,0,0,0.2) 54%, rgba(0,0,0,0.9) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 250, left: 0, right: 0, textAlign: 'center', transform: `scale(${0.6 + pop * 0.4})` }}>
        <div style={{ fontSize: 74, marginBottom: -6 }}>👑</div>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 40, letterSpacing: 8, color: GOLD, textShadow: '0 3px 14px rgba(0,0,0,1)' }}>WINNER</div>
        <div style={{ fontFamily, fontWeight: 900, fontSize: 96, lineHeight: 1.0, textTransform: 'uppercase', letterSpacing: -2, color: '#fff', textShadow: `0 6px 30px rgba(0,0,0,1), 0 0 40px ${GOLD}66`, marginTop: 4, padding: '0 40px' }}>{winnerName}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 330, left: 44, right: 44, textAlign: 'center' }}>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 46, lineHeight: 1.14, color: GOLD, textShadow: '0 4px 18px rgba(0,0,0,1)' }}>{answer}</div>
      </div>
    </AbsoluteFill>
  );
};

// End-card CTA that pops in over the winner reveal — drives the subscribe.
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

// "Have you ever thought that…" — a silent head-to-head comparison that poses an
// interesting question, shows two contenders (A vs B) over stock video, then
// reveals the winner and the interesting answer. Music + captions, no voiceover.
export const VersusVideo = ({
  question = '', hook = '', a = {}, b = {}, winner = 'a', answer = '',
  clips = [], channelName = 'Kings of Ranks', logo = null, hasMusic = false,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const hookF = Math.round(3 * fps);
  const segA = Math.round(8 * fps);
  const segB = Math.round(8 * fps);
  const revealFrom = hookF + segA + segB;
  const winnerClip = clips[winner === 'b' ? 1 : 0];

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Sequence from={hookF} durationInFrames={segA + CROSSFADE}>
        <ContenderScene clip={clips[0]} side="A" accent={BLUE} name={a.name} fact={a.fact} fps={fps} />
      </Sequence>
      <Sequence from={hookF + segA} durationInFrames={segB + CROSSFADE}>
        <ContenderScene clip={clips[1]} side="B" accent={RED} name={b.name} fact={b.fact} fps={fps} />
      </Sequence>
      <Sequence from={revealFrom} durationInFrames={durationInFrames - revealFrom}>
        <RevealScene clip={winnerClip} winnerName={winner === 'b' ? b.name : a.name} answer={answer} fps={fps} />
      </Sequence>

      {hasMusic && <Audio src={staticFile('music/background.mp3')} volume={0.6} loop />}

      {/* crown watermark */}
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, pointerEvents: 'none', zIndex: 30 }}>
        {logo ? <Img src={staticFile(logo)} style={{ width: 50, height: 50, objectFit: 'contain', opacity: 0.9 }} /> : null}
        <span style={{ fontFamily, fontWeight: 900, fontSize: 22, letterSpacing: 5, textTransform: 'uppercase', color: GOLD, opacity: 0.85, textShadow: '0 0 18px rgba(0,0,0,0.95)' }}>{channelName}</span>
      </div>

      <Sequence from={0} durationInFrames={hookF + 10}>
        <HookCard hook={hook} question={question} />
      </Sequence>

      <Sequence from={durationInFrames - Math.round(1.9 * fps)}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
