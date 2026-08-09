import { execSync } from 'child_process';

// Normalize a clip the user OWNS or has LICENSED (their own Flow/Veo output, or
// clips licensed from ViralHog/Jukin/creator permission) into our 9:16 format:
// scale + center-crop to 1080x1920, trim to the core action, drop the source
// audio (the composition plays royalty-free music instead). This ONLY ever runs
// on clips the user legally provides — never on scraped/reposted content.
export function processViralClip(inputPath, outputPath, startTime = 0, duration = 7) {
  const command = `ffmpeg -y -ss ${startTime} -i "${inputPath}" -t ${duration} ` +
    `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1" ` +
    `-c:v libx264 -crf 18 -preset fast -an "${outputPath}"`;
  execSync(command, { stdio: 'inherit' });
  return true;
}

// Real duration (seconds) of a processed clip, so the composition loops it to
// the right length instead of freezing on a short clip's last frame.
export function probeDuration(filePath) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8' }
    ).trim();
    const d = parseFloat(out);
    return Number.isFinite(d) && d > 0 ? d : 7;
  } catch {
    return 7;
  }
}
