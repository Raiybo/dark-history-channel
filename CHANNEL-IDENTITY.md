# Channel Identity — Consumer Awareness Rebuild

Copy-paste ready. Update in YouTube Studio → Customization.

---

## Channel name — pick ONE

The name signals the niche in the first frame of any thumbnail/handle appearance. Options ranked by 2026 discoverability:

1. **The Fine Print** (recommended)
   - Direct, memorable, exactly names the niche (hidden fees, ToS, small-text disclosures)
   - Handle: `@TheFinePrint` (check availability)
2. **Rights Hacks**
   - "Hacks" is a proven high-search prefix; "rights" narrows to the ethical daily-life angle
   - Handle: `@RightsHacks`
3. **You Should Know**
   - Broader, works if you want room to expand into gov benefits + tech scams later
   - Handle: `@YouShouldKnow` (very likely taken — check `@youshouldknowdaily`)
4. **The Refund Rule**
   - Narrower angle if you want to lock in on money-back / consumer-protection content
   - Handle: `@TheRefundRule`

Whichever you pick, the on-screen watermark rendered by the pipeline needs the same name — update `CHANNEL_NAME` in the repo's `.env` and in the GitHub secret of the same name so it flows through automatically.

---

## Handle format

Whatever you land on, keep it identical to the display name (no random numbers). Google's 2026 handle-matching algorithm prefers exact word matches.

---

## Channel description (copy verbatim into Studio → Customization → Basic Info)

```
Every video shows you ONE thing companies, dealers, or the government don't
want you to notice — a hidden fee, a scam trick, a refund you're entitled to,
a benefit you're missing. Every claim links back to a real FTC, IRS, .gov, or
official source in the pinned comment. If you spend money in America, this
channel saves you some.

New Short every morning + evening. Subscribe so you don't miss the one that
saves you $500.
```

Under 500 chars, keyword-loaded ("FTC", "refund", "scam", "hidden fee",
"benefit"), sets the daily cadence expectation, and gives a specific value
promise ($500) to justify the subscribe.

---

## Banner (1546 × 423)

Text only — no faces needed. Keep it under 15 words. High-contrast: black
background, yellow accent (matches the watermark color already in the
pipeline: `#FFC83D`).

Suggested copy on the banner:

```
THE FINE PRINT SAVES YOU MONEY
FTC · IRS · CPSC · CISA — CITED IN EVERY VIDEO
```

If you don't have a designer, generate it free at canva.com with a "YouTube
banner" template — takes 5 minutes, no login required.

---

## Profile picture (800 × 800)

Options:

1. **Reading-glasses icon over a stack of paper.** On-brand for "fine print",
   works as a small circle.
2. **Yellow highlight-marker cursor.** Reads clearly at 32px.
3. **Just a big yellow question mark on black.** Simplest, always readable.

If the pipeline's `public/logo.png` doesn't match the new identity, drop a
new one in and it flows through automatically — no code change needed.

---

## Handle vs "About" keywords

Studio → Customization → About → Details. Add these business-inquiry-style
labels (they help YouTube's classifier place the channel in the right
cluster):

- Country: **United States**
- Links: 1 link, to a Beacons.ai / Linktree page listing the sources — this
  is where you can also collect emails long-term.
- Contact email: business inquiries welcome.
- Tags in the description: `#ConsumerAwareness #ScamAlert #FTC #Rights`

---

## Once picked

1. Update Studio (name, handle, description, banner, PFP).
2. Update `CHANNEL_NAME` in this repo's `.env` file.
3. Update the `CHANNEL_NAME` GitHub Actions secret:
   ```powershell
   gh secret set CHANNEL_NAME --body "The Fine Print"
   ```
4. Reply here with the name you picked so I can regenerate the LAUNCH.md
   examples with the real name in place.
