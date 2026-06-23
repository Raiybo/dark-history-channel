import { useCurrentFrame, interpolate } from 'remotion';

// The "payoff" moment — fires once when the hook finishes and captions take
// over. Quick white flash + accent-bar wipe + slight zoom punch that sells the
// reveal. Sits over the footage so the viewer feels the visual change land.
export const STINGER_FRAMES = 14;

export const RevealStinger = ({ accent = '#FFC83D' }) => {
  const frame = useCurrentFrame();

  // White flash: hard up, slow out — gives the punch without burning eyes.
  const flash = interpolate(frame, [0, 2, STINGER_FRAMES], [0, 0.55, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Accent bar wipes across center, then fades.
  const wipe = interpolate(frame, [0, 7], [0, 110], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const wipeOpacity = interpolate(frame, [0, 3, 8, STINGER_FRAMES], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none',
      zIndex: 40,
    }}>
      {/* White flash */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: '#FFFFFF',
        opacity: flash,
      }} />

      {/* Accent bar wipe across the middle */}
      <div style={{
        position: 'absolute',
        top: '46%',
        left: 0, right: 0,
        height: 14,
        opacity: wipeOpacity,
        transform: `scaleX(${wipe / 100})`,
        transformOrigin: 'left center',
        backgroundColor: accent,
        boxShadow: `0 0 40px ${accent}, 0 0 90px ${accent}aa`,
      }} />
    </div>
  );
};
