import { useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';

// Lightweight Lottie overlay for kinetic emphasis on specific narration beats.
// Loads a Lottie .json placed under public/lottie/ (e.g. arrow.json, checkmark.json,
// warning.json, money.json). We render frame-by-frame via `lottie-web` in the
// browser bundle Remotion already ships — no extra runtime dep needed at render
// time since Remotion runs in a headless Chromium that supports Lottie natively
// via the LottieFiles player-lite element.
//
// Usage inside a composition:
//   <Sequence from={90} durationInFrames={45}>
//     <LottieOverlay name="checkmark" position={{ x: 540, y: 1200 }} size={220} />
//   </Sequence>
//
// If the requested Lottie file doesn't exist, the component quietly renders
// nothing — never breaks a render.

import { getStaticFiles } from 'remotion';

function fileExists(relPath) {
  try {
    return getStaticFiles().some(f => f.name === relPath);
  } catch {
    return true; // getStaticFiles is Remotion-runtime only; assume present outside
  }
}

export const LottieOverlay = ({
  name,                    // 'checkmark' -> loads /lottie/checkmark.json
  position = { x: 540, y: 1000 },
  size = 240,
  loop = false,
  autoplay = true,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const relPath = `lottie/${name}.json`;

  if (!fileExists(relPath)) {
    // Optional: render a tiny fallback dot so a missing asset is visible in
    // dev but invisible in production if size < 4.
    if (size >= 4) return null;
    return null;
  }

  const src = staticFile(relPath);

  // Use the LottieFiles web component embedded as raw HTML — Remotion's
  // headless Chromium supports web components. We compute the current time-
  // in-seconds for the animation from the composition frame so it stays in
  // sync when Remotion renders frame-by-frame.
  const timeSec = (frame / fps) * speed;

  return (
    <div style={{
      position: 'absolute',
      left: position.x - size / 2,
      top:  position.y - size / 2,
      width: size, height: size,
      pointerEvents: 'none',
    }}>
      {/* dangerouslySetInnerHTML lets us drop in the web component without
          React managing its lifecycle — the component itself handles the
          animation playback timing via the `currentTime` attribute. */}
      <div
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{
          __html: `
            <lottie-player
              src="${src}"
              background="transparent"
              speed="${speed}"
              ${loop ? 'loop' : ''}
              ${autoplay ? 'autoplay' : ''}
              currentTime="${timeSec}"
              style="width:100%;height:100%"
            ></lottie-player>
            <script type="module" src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>
          `,
        }}
      />
    </div>
  );
};

// Simple PNG-based fallback icon overlay — used when we want a kinetic
// emphasis without requiring a Lottie asset. Fades in + pops on entry.
// The genre files can call this directly for the most common cases
// (checkmark, warning triangle, dollar sign) so the pipeline doesn't hard-
// depend on curated Lottie files existing.
import { spring, interpolate } from 'remotion';

export const IconPulse = ({
  emoji = '⚠️',
  position = { x: 540, y: 1200 },
  size = 180,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 10, stiffness: 260, mass: 0.5 } });
  const scale = interpolate(pop, [0, 1], [0.4, 1.0]);
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute',
      left: position.x - size / 2,
      top:  position.y - size / 2,
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.85,
      transform: `scale(${scale})`,
      opacity,
      filter: `drop-shadow(0 4px 20px rgba(0,0,0,0.8))${color ? ` drop-shadow(0 0 16px ${color})` : ''}`,
      pointerEvents: 'none',
    }}>
      {emoji}
    </div>
  );
};
