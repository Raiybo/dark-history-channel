# Cloud auto-posting — setup & how it works

The channel posts on its own from GitHub's servers. **No machine of yours needs
to be on.** Clips go from your phone into a Google Drive folder; a cron picks
them up, renders a Short, and publishes it.

Everything here is free: the repo is public (unlimited Actions minutes), Drive's
free tier holds the clips, and the YouTube Data API costs nothing at this volume.

---

## Setup, the short way

```bash
node scripts/setup-drive.js
```

Prints a URL; click Allow once. It enables the Drive API, creates the drop
folder, shares it with the service account, and writes `DRIVE_FOLDER_ID` into
`.env`. Then set the secret:

```bash
gh secret set DRIVE_FOLDER_ID --body "<the id it printed>"
```

If Google refuses those scopes (it can, on an unverified app), do the three
steps below by hand instead — they achieve exactly the same thing.

---

## One-time setup (3 steps, all from a browser or phone)

**1. Turn on the Drive API**

<https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=793329199432>

Click **Enable**. This is the same Google Cloud project the channel already uses
for YouTube uploads.

**2. Make the drop folder and share it with the robot**

Create a folder in Google Drive (call it anything — `yt clips` is fine). Share it
with this address, as **Editor**:

```
tts-bot@youtube-remotion-493308.iam.gserviceaccount.com
```

Editor (not Viewer) so spent clips can be moved to the trash automatically and
your 15GB doesn't fill up. Viewer still works; it just won't tidy up.

**3. Tell the repo which folder it is**

Open the folder in a browser. The URL ends with the folder ID:

```
https://drive.google.com/drive/folders/1AbCdEf...   <- this part
```

Then:

```bash
gh secret set DRIVE_FOLDER_ID --body "1AbCdEf..."
```

**Check it worked:**

```bash
gh workflow run "Cloud daily upload" -f check_only=true
```

That prints exactly what's missing, or confirms the folder is readable.

---

## Day to day

Drop clips into the Drive folder from your phone — share sheet → Drive. That's
the whole job.

On a PC you can instead drag them into the desktop **Drop Box** folder (see
below), which uploads them for you.

- **3 Shorts a day**, 5 clips each → **105 clips covers a full week**.
- A still photo in the folder becomes the bonus frame at the end of a reel.
- Every Sunday you get a reminder telling you the real shortfall (see below).
- Out of clips? Nothing breaks. The cron skips quietly until you drop more.

## How the cron decides

`.github/workflows/cloud-daily.yml` ticks **every 2 hours**. Almost every tick
exits in seconds — [`scripts/cloud-gate.mjs`](scripts/cloud-gate.mjs) checks
three things before anything gets installed:

1. Has today's quota (3) already been met? → stop.
2. Has this post's time slot opened yet? Slots are `13,17,21` UTC (~9am / 1pm /
   5pm US Eastern). → stop if too early.
3. Are there 5 unused clips in Drive? → stop if not.

It ticks often rather than firing three exact crons because GitHub delays and
sometimes drops scheduled runs. A missed slot is picked up by the next tick, so
"3 a day" actually holds.

## What stops a clip posting twice

[`config/used-clips.json`](config/used-clips.json) — a committed ledger of every
published clip's Drive file ID. It's the source of truth, not the state of the
Drive folder, because a run can die at any point and Drive isn't transactional.

The pipeline deletes a source clip from its scratch dir only *after* that reel
uploads, so "the file is gone" reliably means "it reached YouTube". That's what
gets written down. A run that crashes mid-render records nothing and its clips
are simply retried.

## The Sunday reminder

`.github/workflows/weekly-reminder.yml`, Sundays 07:00 UTC (10:00 Beirut). It
counts what's actually in Drive minus what's been published, and reaches you:

- **A GitHub issue** — GitHub emails you and pushes to the GitHub mobile app.
  Works with no extra setup.
- **An ntfy.sh push**, if you want a proper notification. Install the ntfy app,
  pick any unguessable topic name, subscribe to it, then:
  ```bash
  gh secret set NTFY_TOPIC --body "some-unguessable-name"
  ```

## The desktop Drop Box (optional, per machine)

A real folder at `~/Desktop/Drop Box` that uploads whatever you drag into it,
so you can add clips from a PC without opening Drive.

```bash
node scripts/dropbox-auth.js     # one Allow click -> DRIVE_USER_REFRESH_TOKEN
node scripts/dropbox-sync.mjs    # uploads once; run it on a schedule
```

Uploaded files move to `Drop Box/_uploaded`, which *is* the bookkeeping — if a
file is still in `Drop Box` it hasn't gone up yet. No state file to drift.

It authenticates as **you**, not as the service account, because service
accounts have no Drive storage quota and uploads from one fail with "Service
Accounts do not have storage quota". Scope is `drive.file`, so it can only touch
the folder this app created.

Scheduled on Windows with (no admin needed — `Register-ScheduledTask` wants
elevation, `schtasks` doesn't):

```powershell
schtasks /create /tn "KingsOfRanks DropBox Sync" /tr "wscript.exe \"<repo>\.dropbox-sync.vbs\"" /sc minute /mo 5 /f
```

The `.vbs` shim just launches node with a hidden window; pointing the task at
`node.exe` directly flashes a console every 5 minutes.

## Knobs

Set in the workflow's `env:` block:

| | |
|---|---|
| `DAILY_COUNT` | Shorts per day (default 3). YouTube's quota allows ~6 max. |
| `UPLOAD_SLOTS_UTC` | Earliest hour for each post (default `13,17,21`). |

## Manual controls

```bash
gh workflow run "Cloud daily upload" -f check_only=true   # verify setup
gh workflow run "Cloud daily upload" -f force=true        # post one right now
gh workflow run "Weekly clip reminder"                    # send the nudge now
gh run list --workflow="Cloud daily upload" --limit 10    # recent runs
```

## Superseded by this

The Mac-local system is no longer the engine. If those launchd agents are still
loaded on the Mac, unload them so nothing double-posts:

```bash
launchctl bootout gui/$(id -u)/com.kingsofranks.autoupload 2>/dev/null
rm -f ~/Library/LaunchAgents/com.kingsofranks.*.plist
```

`scripts/daily-upload.mjs`, `scripts/queue-upload.mjs` and `scripts/reminders.mjs`
are kept for reference but nothing schedules them any more.
