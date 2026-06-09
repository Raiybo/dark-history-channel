/**
 * Channel analytics report. Run: npm run analytics  (or: node scripts/analytics.mjs)
 *
 * Pulls the last 30 days, splits performance before vs. after the 2026-06-04
 * Groq switch, and lists the best/weakest videos. Requires a refresh token with
 * the yt-analytics.readonly scope — if it errors, run `npm run get-token` (the
 * getter now requests that scope) and try again.
 */
import 'dotenv/config';
import { google } from 'googleapis';

const GROQ_SWITCH = '2026-06-04'; // the day topic+script generation moved off Gemini

function ymd(d) { return d.toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; }

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'http://localhost:8723'
);
oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

const yta = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });
const yt = google.youtube({ version: 'v3', auth: oauth2Client });

async function summary(startDate, endDate) {
  const r = await yta.reports.query({
    ids: 'channel==MINE', startDate, endDate,
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,shares',
  });
  const row = ((r.data.rows && r.data.rows[0]) || []).map(v => v ?? 0);
  const [views, mins, avgDur, avgPct, subs, likes, comments, shares] = row;
  const days = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
  return { startDate, endDate, days, views, viewsPerDay: +(views / days).toFixed(1),
    watchHours: +(mins / 60).toFixed(1), avgViewSec: avgDur, avgViewPct: avgPct,
    subscribersGained: subs, likes, comments, shares };
}

async function videosBy(startDate, endDate, sort, n = 5) {
  const r = await yta.reports.query({
    ids: 'channel==MINE', startDate, endDate,
    metrics: 'views,averageViewPercentage', dimensions: 'video', sort, maxResults: n,
  });
  const rows = r.data.rows || [];
  const ids = rows.map(x => x[0]);
  const titles = {};
  if (ids.length) {
    const v = await yt.videos.list({ part: ['snippet'], id: ids });
    for (const it of v.data.items || []) titles[it.id] = it.snippet.title;
  }
  return rows.map(([id, views, pct]) => ({ id, title: titles[id] || '(unknown)', views, avgViewPct: pct }));
}

function printSummary(label, s) {
  console.log(`\n${label}  (${s.startDate} → ${s.endDate}, ${s.days}d)`);
  console.log(`  views ........ ${s.views}  (${s.viewsPerDay}/day)`);
  console.log(`  watch time ... ${s.watchHours} h`);
  console.log(`  avg view ..... ${Math.round(s.avgViewSec)}s  (${(+s.avgViewPct).toFixed(1)}% of each video)`);
  console.log(`  subs gained .. ${s.subscribersGained}`);
  console.log(`  engagement ... ${s.likes} likes · ${s.comments} comments · ${s.shares} shares`);
}

function printList(label, vids) {
  console.log(`\n${label}`);
  if (!vids.length) { console.log('  (no data)'); return; }
  for (const v of vids) {
    console.log(`  ${String(v.views).padStart(7)} views · ${(+v.avgViewPct).toFixed(1).padStart(5)}% retention · ${v.title}`);
  }
}

try {
  const today = ymd(new Date());
  const start30 = ymd(daysAgo(30));

  console.log('\n════════════════ CHANNEL ANALYTICS ════════════════');
  printSummary('LAST 30 DAYS', await summary(start30, today));

  // The key comparison: traffic before vs. after the Groq switch. viewsPerDay
  // normalizes the unequal window lengths so the trend is directly comparable.
  printSummary('PRE-Groq  (Gemini era)', await summary(ymd(daysAgo(34)), '2026-06-03'));
  printSummary('POST-Groq (Llama era)',  await summary(GROQ_SWITCH, today));

  // One supported query (sort must be descending for the video dimension), then
  // derive both lists in JS. "Lowest retention of your most-viewed" is the most
  // actionable cut — videos people clicked but swiped away from early.
  const top = await videosBy(start30, today, '-views', 50);
  printList('TOP 5 VIDEOS (last 30d, by views):', top.slice(0, 5));
  const byRetention = [...top].sort((a, b) => a.avgViewPct - b.avgViewPct);
  printList('LOWEST RETENTION (of your 50 most-viewed — biggest opportunities):', byRetention.slice(0, 5));
  console.log('\nTip: avg view % is the retention signal that drives reach — anything under ~50% is getting swiped early.\n');
} catch (err) {
  const msg = err.message || String(err);
  console.error('\nAnalytics pull failed:', msg);
  if (/invalid_grant/i.test(msg)) {
    console.error('→ Your refresh token is dead/expired. Run:  npm run get-token   then retry.');
  } else if (/insufficient|scope|forbidden|403/i.test(msg)) {
    console.error('→ Token lacks the analytics scope. Run:  npm run get-token   (it now requests it) then retry.');
  }
  process.exit(1);
}
