# Hide-likes setup (one-time)

The post-upload Studio toggle needs your YouTube session cookies. Once stored as a GitHub secret, every future cron upload runs the headless flow automatically.

## Steps

1. **Install the "Cookie-Editor" extension** in Chrome (it's the standard one — published by `cookie-editor.com`, ~3M users).

2. **Open YouTube Studio in Chrome** (logged in to the channel you upload from): https://studio.youtube.com

3. **Click the Cookie-Editor extension icon** on the Studio page. You'll see a list of cookies.

4. **Click Export → JSON** (top-right of the popup, the "{ }" icon). It copies a JSON array to your clipboard.

5. **Add the GitHub secret:**
   ```powershell
   gh secret set YT_STUDIO_COOKIES --body (Get-Clipboard -Raw)
   ```
   Or via the web UI: GitHub repo → Settings → Secrets and variables → Actions → New repository secret. Name: `YT_STUDIO_COOKIES`. Value: paste the JSON.

6. **Done.** The next scheduled upload will hide its like count automatically.

## When it stops working

Google session cookies expire (typically months, but Google can invalidate sooner — especially if it sees the GitHub runner's US IP as suspicious). When that happens you'll see in the workflow logs:

```
hideLikes: cookies expired — redirected to login. Re-export YT_STUDIO_COOKIES.
```

Just repeat steps 1–5 with a fresh export. Takes ~30 seconds.

## Test locally

```powershell
$env:YT_STUDIO_COOKIES = Get-Clipboard -Raw
node scripts/hide-likes.js <videoId>
```

(`<videoId>` is the 11-char YouTube ID from the watch URL.)
