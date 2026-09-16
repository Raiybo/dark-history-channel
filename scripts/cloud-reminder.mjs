// The Sunday "drop this week's clips" nudge, sent from the cloud.
//
// The old version built an iCloud reminder with AppleScript, which meant the Mac
// had to be awake on a Sunday for the reminder to exist at all. This runs on the
// GitHub Actions cron instead and reaches the phone two ways, both free:
//
//   * A GitHub issue. GitHub emails the repo owner and pushes to the GitHub
//     mobile app, so this works with zero extra setup or accounts.
//   * An ntfy.sh push, if NTFY_TOPIC is set. Free, anonymous, installable on
//     iOS/Android — nicer than email if the creator wants a real notification.
//
// It counts what's actually in Drive (minus everything already published), so
// the number it asks for is the real shortfall, not a fixed figure.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDropFolder, isVideo, driveConfigured } from '../src/drive.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = join(ROOT, 'config', 'used-clips.json');

const DAILY_COUNT = Number(process.env.DAILY_COUNT || 3);
const CLIPS_PER_SHORT = 5;
const TARGET_SHORTS = DAILY_COUNT * 7;
const TARGET_CLIPS = TARGET_SHORTS * CLIPS_PER_SHORT;

const log = (m) => console.log(`[reminder] ${m}`);

function usedIds() {
  try { const j = JSON.parse(readFileSync(LEDGER, 'utf8')); return new Set((Array.isArray(j) ? j : []).map(e => e.id)); }
  catch { return new Set(); }
}

if (!driveConfigured()) {
  console.error('[reminder] Drive is not configured; cannot count clips.');
  process.exit(1);
}

const used = usedIds();
let onHand = 0;
try {
  onHand = (await listDropFolder()).filter(f => isVideo(f) && !used.has(f.id)).length;
} catch (err) {
  console.error(`[reminder] Could not read the Drive folder: ${err.message}`);
  process.exit(1);
}

const shortsCovered = Math.floor(onHand / CLIPS_PER_SHORT);
const need = Math.max(0, TARGET_CLIPS - onHand);
const daysCovered = Math.floor(shortsCovered / DAILY_COUNT);

const title = need > 0
  ? `Drop ~${need} clips for this week`
  : `Clips are covered for this week (${shortsCovered} shorts ready)`;

const body = [
  need > 0
    ? `**Drop about ${need} more clips** into the Drive folder to cover this week.`
    : `Nothing to do — you already have enough clips queued for the week.`,
  '',
  `| | |`,
  `|---|---|`,
  `| Unused clips in Drive | **${onHand}** |`,
  `| Shorts that covers | **${shortsCovered}** (~${daysCovered} day${daysCovered === 1 ? '' : 's'}) |`,
  `| Target for a full week | ${TARGET_CLIPS} clips = ${TARGET_SHORTS} shorts at ${DAILY_COUNT}/day |`,
  '',
  'Drop them straight into the Drive folder from your phone — share sheet → Drive.',
  'Everything after that is automatic: the cron renders and posts ' + DAILY_COUNT + ' shorts a day.',
  'Nothing of yours needs to be switched on.',
].join('\n');

log(`${onHand} unused clips on hand → ${shortsCovered} shorts (~${daysCovered} days); asking for ${need}`);

// ---- ntfy push (optional, free, no account) ----
if (process.env.NTFY_TOPIC) {
  const server = process.env.NTFY_SERVER || 'https://ntfy.sh';
  try {
    const res = await fetch(`${server.replace(/\/$/, '')}/${process.env.NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        Title: title,
        Priority: need > 0 ? 'high' : 'default',
        Tags: need > 0 ? 'clapper' : 'white_check_mark',
      },
      body: need > 0
        ? `${need} more clips needed. You have ${onHand} (covers ~${daysCovered} days).`
        : `${onHand} clips on hand — ${shortsCovered} shorts ready. Nothing to do.`,
    });
    log(res.ok ? 'ntfy push sent' : `ntfy push failed (${res.status})`);
  } catch (err) {
    log(`ntfy push failed: ${err.message}`);
  }
}

// ---- GitHub issue (always, when running in Actions) ----
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!token || !repo) {
  log('no GITHUB_TOKEN/GITHUB_REPOSITORY — skipping the issue (this is fine outside CI)');
  process.exit(0);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
};

const LABEL = 'weekly-clips';

try {
  // Close last week's nudge first so the issue list stays a to-do, not a log.
  const open = await api(`/issues?state=open&labels=${LABEL}&per_page=100`);
  for (const issue of open) {
    await api(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
    log(`closed previous reminder #${issue.number}`);
  }
} catch (err) {
  log(`could not close previous reminders: ${err.message}`);
}

try {
  // The label may not exist yet on a fresh repo; create it, ignore a 422 clash.
  await api('/labels', {
    method: 'POST',
    body: JSON.stringify({ name: LABEL, color: 'FBCA04', description: 'Weekly clip drop reminder' }),
  }).catch(() => {});

  const issue = await api('/issues', {
    method: 'POST',
    body: JSON.stringify({
      title: `🎬 ${title}`,
      body,
      labels: [LABEL],
      assignees: [process.env.GITHUB_REPOSITORY_OWNER].filter(Boolean),
    }),
  });
  log(`opened reminder issue #${issue.number} — ${issue.html_url}`);
} catch (err) {
  console.error(`[reminder] failed to open the issue: ${err.message}`);
  process.exit(1);
}
