import { execSync } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

// Use the BUNDLED ffmpeg/ffprobe binaries — the system ffmpeg on this Mac has no
// ffprobe on PATH, and the bundled build is guaranteed to carry every filter we
// need (loudnorm, scale/crop). Absolute paths work the same in CI and locally.
const FFMPEG = ffmpegInstaller.path;
const FFPROBE = ffprobeInstaller.path;

// Normalize a clip the user OWNS or has LICENSED (their own footage / Flow-Veo
// output, or clips licensed / permitted from the source creator) into our 9:16
// format: scale + center-crop to 1080x1920, trim to the core action. We now KEEP
// the clip's own audio (the funny sounds are the point) and loudness-normalize
// it so five different sources sit at a consistent volume; a background music
// bed + narrator are mixed in at render time. This ONLY runs on clips the user
// legally provides — never on scraped/unlicensed content.
export function processViralClip(inputPath, outputPath, startTime = 0, duration = 7, keepAudio = true) {
  const hasAudio = keepAudio && probeHasAudio(inputPath);
  const audioArgs = hasAudio
    ? `-af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 160k`
    : `-an`;
  const command = `"${FFMPEG}" -y -ss ${startTime} -i "${inputPath}" -t ${duration} ` +
    `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1" ` +
    `-c:v libx264 -crf 18 -preset fast ${audioArgs} "${outputPath}"`;
  execSync(command, { stdio: 'inherit' });
  return true;
}

// Grab one representative still frame (JPEG) from a clip so a vision model can
// describe what actually happens in it — the narrator commentary is written from
// that, not from the (opaque) filename. Sampled near the middle of the action.
export function extractFrame(inputPath, outputPath, atSeconds = null) {
  const t = atSeconds != null ? atSeconds : Math.max(0.5, Math.min(2.5, probeDuration(inputPath) * 0.45));
  const command = `"${FFMPEG}" -y -ss ${t.toFixed(2)} -i "${inputPath}" -frames:v 1 -q:v 3 ` +
    `-vf "scale=720:-1" "${outputPath}"`;
  execSync(command, { stdio: 'ignore' });
  return outputPath;
}

// True if the file has at least one audio stream.
export function probeHasAudio(filePath) {
  try {
    const out = execSync(
      `"${FFPROBE}" -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "${filePath}"`,
      { encoding: 'utf8' }
    ).trim();
    return out.includes('audio');
  } catch {
    return false;
  }
}

// Real duration (seconds) of a clip, so the composition loops/trims it to the
// right length instead of freezing on a short clip's last frame.
export function probeDuration(filePath) {
  try {
    const out = execSync(
      `"${FFPROBE}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8' }
    ).trim();
    const d = parseFloat(out);
    return Number.isFinite(d) && d > 0 ? d : 7;
  } catch {
    return 7;
  }
}
