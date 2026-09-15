// iCloud Reminders helper for the Kings of Ranks weekly system (macOS-local).
// Reminders are created on the Mac and sync to the phone via iCloud, so they
// fire even when the Mac is off. Subcommands:
//   clips-needed          -> Sunday: reminder telling you how many clips to drop
//   schedule-daily <n>    -> create "turn on your Mac" reminders for the next n days
//   complete-today        -> mark today's "turn on your Mac" reminder done (no nag)
//   clear                 -> remove all incomplete reminders in the list
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const LIST = 'Kings of Ranks';
const THRESHOLD_HOUR = 17;            // 5pm: when the "turn on your Mac" reminder fires
const DAILY_COUNT = 3;                // shorts per day
const CLIPS_PER_SHORT = 5;
const TARGET_SHORTS = DAILY_COUNT * 7;
const CLIPS_DIR = join(homedir(), 'Desktop', 'yt clips');
const QUEUE = join(homedir(), 'Desktop', 'Remotion', 'upload-queue');

const osa = (script) => execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).trim();
const ensureList = () => osa(`tell application "Reminders" to if not (exists list "${LIST}") then make new list with properties {name:"${LIST}"}`);
const dayTag = (d) => d.toISOString().slice(0, 10);
const pretty = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function makeReminder(name, body, when /* Date or null */) {
  let dateSet = '';
  if (when) {
    dateSet = `set d to current date
      set year of d to ${when.getFullYear()}
      set month of d to ${when.getMonth() + 1}
      set day of d to ${when.getDate()}
      set hours of d to ${when.getHours()}
      set minutes of d to ${when.getMinutes()}
      set seconds of d to 0
      set remind me date of r to d`;
  }
  const nm = name.replace(/"/g, "'");
  const bd = (body || '').replace(/"/g, "'");
  osa(`tell application "Reminders"
    set r to make new reminder at end of list "${LIST}" with properties {name:"${nm}", body:"${bd}"}
    ${dateSet}
  end tell`);
}

function clear() {
  ensureList();
  const n = osa(`tell application "Reminders"
    set ms to (every reminder in list "${LIST}" whose completed is false)
    set c to count of ms
    repeat with r in ms
      delete r
    end repeat
    return c
  end tell`);
  console.log(`cleared ${n} incomplete reminder(s)`);
}

function upcomingSunday() {
  const d = new Date();
  const add = d.getDay() === 0 ? 0 : (7 - d.getDay()); // today if Sunday, else next Sunday
  d.setDate(d.getDate() + add);
  d.setHours(10, 0, 0, 0);
  return d;
}

function clipsNeeded() {
  ensureList();
  // idempotent: drop any prior incomplete "Drop clips" reminder first
  osa(`tell application "Reminders"
    set ms to (every reminder in list "${LIST}" whose completed is false and name starts with "🎬 Drop")
    repeat with r in ms
      delete r
    end repeat
  end tell`);
  const onHand = existsSync(CLIPS_DIR) ? readdirSync(CLIPS_DIR).filter(f => /\.(mp4|mov)$/i.test(f)).length : 0;
  const need = Math.max(0, TARGET_SHORTS * CLIPS_PER_SHORT - onHand);
  const when = upcomingSunday();
  const name = `🎬 Drop ~${need} clips for this week (target ${TARGET_SHORTS} shorts)`;
  const body = `You have ${onHand} clips. Goal: ${DAILY_COUNT}/day = ${TARGET_SHORTS} shorts this week (~${CLIPS_PER_SHORT} clips each). Drop them in ~/Desktop/yt clips, then tell me to build the week's batch.`;
  makeReminder(name, body, when);
  console.log(`clips-needed reminder set for ${when.toDateString()} 10:00 — need ~${need} (have ${onHand})`);
}

function scheduleDaily(days) {
  ensureList();
  // one "turn on your Mac" reminder per day, starting tomorrow, at the threshold hour
  for (let i = 1; i <= days; i++) {
    const d = new Date(); d.setDate(d.getDate() + i); d.setHours(THRESHOLD_HOUR, 0, 0, 0);
    const name = `🖥️ Turn on your Mac — ${dayTag(d)} (uploads pending)`;
    const body = `If you see this, your Mac was off today so the ${DAILY_COUNT} shorts did not post. Turn it on and it will catch up automatically.`;
    makeReminder(name, body, d);
  }
  console.log(`scheduled ${days} daily "turn on your Mac" reminder(s) at ${THRESHOLD_HOUR}:00`);
}

function completeToday() {
  ensureList();
  const tag = dayTag(new Date());
  const n = osa(`tell application "Reminders"
    set ms to (every reminder in list "${LIST}" whose completed is false and name contains "${tag}")
    set c to count of ms
    repeat with r in ms
      delete r
    end repeat
    return c
  end tell`);
  console.log(`completed today's (${tag}) reminder(s): ${n}`);
}

const cmd = process.argv[2];
if (cmd === 'clips-needed') clipsNeeded();
else if (cmd === 'schedule-daily') scheduleDaily(parseInt(process.argv[3] || '6', 10));
else if (cmd === 'complete-today') completeToday();
else if (cmd === 'clear') clear();
else { console.log('usage: reminders.mjs [clips-needed|schedule-daily <n>|complete-today|clear]'); process.exit(1); }
