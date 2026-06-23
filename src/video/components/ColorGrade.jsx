// Brand color treatment, applied as a thin overlay layer above the footage.
// CSS filters on a transparent sibling don't grade what's below — we instead
// boost the underlying clips with a multiply+screen blend pair so every reel
// gets the same warmer, slightly desaturated-blacks cinematic feel.
export const ColorGrade = ({ accent = '#FFC83D' }) => {
  return (
    <>
      {/* Lift the shadows toward the accent (very subtle warm tint). */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(255, 200, 61, 0.04) 0%, rgba(0,0,0,0) 50%, rgba(140, 90, 0, 0.06) 100%)',
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }} />
      {/* Deepen blacks with a touch of cool — cinematic teal-and-orange feel. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,10,30,0) 30%, rgba(0,10,30,0.22) 100%)',
        mixBlendMode: 'multiply',
        pointerEvents: 'none',
      }} />
      {/* Very faint accent edge glow — frames the portrait subtly. */}
      <div style={{
        position: 'absolute', inset: 0,
        boxShadow: `inset 0 0 120px rgba(0,0,0,0.4)`,
        pointerEvents: 'none',
      }} />
    </>
  );
};
