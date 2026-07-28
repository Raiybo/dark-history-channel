# 30-Day Launch Playbook — Consumer Awareness Rebuild

Everything in this file is anchored to the 2026 research (Colin & Samir,
vidIQ, OutlierKit, Miraflow, YouTube blog). Every recommendation has a
reason attached. Deviate consciously.

---

## The 5 things that matter most (in priority order)

1. **Post 2/day, not 6/day, for month 1.** Above 3/day gains flatten;
   above 5-10/day risks spam suppression. The pipeline is capable of 6,
   but the algorithm needs 15-30 videos of consistent shape to classify
   the channel — that's month 1's real job, not raw volume.
2. **Pick ONE micro-niche and hammer it.** The Feb 2026 algorithm change
   ("micro-niche clustering") actively punishes topic-hoppers. Consumer
   awareness IS the niche — don't dilute it with health hacks or general
   money tips in the first 30 days.
3. **Optimize Watch-Through Rate, not views.** The single most important
   2026 Shorts signal. Target 65% retention on sub-30s Shorts, 50% on
   30-60s. A 700-view Short at 70% retention beats a 4,000-view one at
   30% — the algorithm pushes the former, buries the latter.
4. **The first 3 seconds decide 50-60% of drop-off.** Lead with the
   dollar figure / agency name / specific action. Never with context.
5. **Treat the first 20-30 Shorts as learning data.** 200-400 views is
   NORMAL on a new-cluster channel. Don't panic-pivot on day 5.

---

## Day 1 — Channel warm-up (NO upload)

Before any Short goes live:

- [ ] Update channel identity per [CHANNEL-IDENTITY.md](CHANNEL-IDENTITY.md)
      (name, handle, description, banner, PFP)
- [ ] Verify phone number in Studio → Settings → Channel → Feature
      eligibility (this is a trust signal the algorithm checks)
- [ ] Complete channel country = United States
- [ ] Follow 10-15 channels in the niche (Erika Kullberg,
      Benefits.gov, Deal Soldier, Naomi Brockwell TV, Techlore, The
      Points Guy, ConsumerReports, FTC's own YouTube)
- [ ] Signed in on Chrome: watch 20-30 min of consumer/scam/rights
      Shorts, comment on 3-5 (thoughtfully, not spam)
- [ ] Update `.env` with the new `CHANNEL_NAME`
- [ ] Update the GitHub `CHANNEL_NAME` secret to match

The point of Day 1 is to give the account a topical fingerprint BEFORE
the algorithm sees your first video. A bare channel gets flagged as
low-trust and suppressed regardless of Short quality.

---

## Week 1 (Days 2-7) — Foundation & cluster signaling

**Cadence:** 2 Shorts/day = **12 videos this week**.
**Timing:** 08:00 EDT (morning commute) + 19:30 EDT (prime time).
**Format:** Split-Sludge only. Zero exceptions.
**Topic:** Cycle through the 6 sub-categories, one per day:

| Day | Sub-category | Example topic |
|---|---|---|
| 2 | Hidden fees | Car dealer doc fees, hotel resort fees |
| 3 | Scam alert | FTC's latest phone-scam bulletin |
| 4 | Consumer right | FTC 3-day cooling-off rule for door-to-door sales |
| 5 | Gov benefit | Recovery Rebate / EITC / SNAP eligibility screener |
| 6 | Product recall | Latest CPSC recall with real dollar refund path |
| 7 | Dark pattern | Subscription auto-renew rules under FTC's "click-to-cancel" |

**End-of-week action:** open Studio → Content → Shorts → rank all 12 by
"Average percentage viewed" (NOT views). Screenshot the top 3. Note
their hook wording and first-frame composition — those are your
winning patterns.

---

## Week 2 (Days 8-14) — Iteration on working hooks

**Cadence:** hold at 2/day = **14 videos this week**.
**Format:** still Split-Sludge only.
**Rule for this week:** every new hook borrows structure from one of
Week 1's top-3 winners. New topics only, same hook architecture.

Introduce a series hook to build subscribes: pin a subscribe CTA on
every Short — *"New Fine Print Short every morning & night. Subscribe
before the FTC changes the rule."*

**End-of-week action:** identify the #1 hook formula from all 26 Shorts
so far. Kill any variant that consistently retains <50%. Log winners in
`config/winning-hooks.json` (I can wire the pipeline to bias toward
these later).

---

## Week 3 (Days 15-21) — Scale what works

**Cadence:** scale to 3/day = **~20 videos this week** ONLY IF Week 2's
top-quintile retention is >60%. Otherwise stay at 2/day and diagnose
hooks first.

**New slot:** add mid-day 12:30 EDT (lunch scroll) as the third daily
upload.

**Clustering push:** do 3-5 related Shorts around one sub-topic in a
row (e.g. 5 days of "car dealership tricks" or 5 days of "IRS refunds
you missed"). Sub-clustering signals to the algorithm which slice of
the niche is your strength, and the recommender starts pushing your
Shorts to people who watched the first one in the mini-series.

**End-of-week action:** in Studio, compare "traffic from Search" vs
"traffic from Shorts feed". Bias future titles toward the exact
keyword patterns that showed up in Search Terms.

---

## Week 4 (Days 22-30) — Compound & refine

**Cadence:** hold 3/day = **~24 videos this week**.
**Format:** introduce ONE second format only if the first is
producing at least one >50%-retention Short per day. Recommended
second: Real-UI walkthrough (the aitools pipeline's screencast +
callouts — I've already wired the composition path for it).

**Engagement rule:** reply to every comment within 6 hours of upload
in the first 24h post-publish. Early comment engagement is a top-3
2026 satisfaction signal.

**Day 30 audit:** total ~65-70 Shorts published. Identify top 20% by
retention. Month 2 = 3/day of the winning topic-sub-category and the
winning hook formula, and only those.

---

## Common failure modes (all confirmed by 2026 research)

| # | Symptom | Fix |
|---|---|---|
| 1 | Views vary 10× video-to-video | You're topic-hopping. Lock to ONE sub-category per week. |
| 2 | "Chose to view" %  is low in Studio | Weak 3-sec hook. Lead with dollar figure or agency name; kill any preamble. |
| 3 | Post 6, skip 3, post 4 | Bursty cadence. Trust the cron; consistency > volume. |
| 4 | Videos suppressed pre-view | Channel metadata incomplete. Finish banner/desc/pic BEFORE upload #1. |
| 5 | Avg % viewed <50% | Padded length. Aim 25-35s script, move payoff earlier. |
| 6 | Shorts die after feed burst, no search life | Vague titles. Front-load specific number: "The $1,600 Car Fee". |
| 7 | Replay rate <5% | No loop design. End frame flows back into opening frame. |
| 8 | Panic-pivot at video 15 | Premature quit. First 20-30 videos are the algorithm learning your cluster. |

---

## When videos flop early — hold vs change course

**Baseline reality:** on a 0-sub channel, 15-25 of your first 30 Shorts
will get <500 views. This is normal and NOT a signal to change niche.
Individual creator experiments (2025-2026) confirm early Shorts land
200-400 views regardless of quality — the algorithm is still learning
your cluster.

**Hold the line if:**
- Your top 20% of Shorts show retention >55%.
- View counts are low but avg % viewed is improving week-over-week.
- Studio's "Search Terms" shows any relevant keywords surfacing.
- You're inside your first 30 Shorts.

**Actually change course if:**
- You've shipped 30+ Shorts and no single one has >45% retention (hook
  problem — rewrite openers, not the niche).
- Retention is fine but views cap at exactly 1-2k on every Short
  (metadata/topic-language mismatch — see Studio's "How viewers found
  this video").
- "Shown in Feed" is near zero across all Shorts (channel-trust or
  spam-flag problem — check for community strikes).

**Never change:**
- The niche in the first 30 days.
- Publish cadence during a flop week (signals abandonment).
- The format mid-week; finish the week, then evaluate.

---

## Metrics to check weekly (in this order, in Studio)

1. **Shown in Feed** → was the algorithm testing you at all?
2. **Chose to view / impression CTR** → was the first frame + title
   compelling?
3. **Average percentage viewed** → the single most important 2026
   metric. 65% target for sub-30s, 50% for 30-60s.
4. **Search terms** → bias future titles toward the exact keywords
   that show up here.

If (1) is near zero, no downstream metric matters — fix trust signals
first (metadata, cadence, no strikes).

---

## Pipeline reality check

The pipeline is set up to do the mechanical work:

- Cron paused right now → will re-enable at 2/day after the first
  manual `workflow_dispatch` verification succeeds
- `GENRE_OVERRIDE=consumer` → runs the source-grounded, split-sludge
  pipeline
- Every video pulls from a real FTC / IRS / CISA / CPSC / USDA feed
- The primary source URL auto-posts as the top comment (needs YouTube
  Studio manual pin — 1 tap per video, or wire the hide-likes
  Puppeteer flow to also pin, if you want that automated)
- 90-day cooldown per source URL prevents topic repetition

The pipeline can't do:
- Reply to comments (that's you, first 24h post-upload)
- Post to social off-YouTube (that's you)
- Pick the sub-category cluster to hammer (that's the Studio audit each
  week)

---

## After Month 1

Once the algorithm has classified the channel (day ~30):

- Introduce the Real-UI walkthrough format (Tue slot)
- Add Tier List format (Thu slot — 1B+ views H1 2025 alone)
- Add Myth-Buster format (Sat slot)
- Keep Split-Sludge on the other 4 days
- This is the 6-format weekly rotation the format research recommended
  — but only AFTER cluster classification lands

If you're not seeing at least ONE Short with >5k views by day 30, don't
scale. Diagnose. The 5-6k-view mark is the "algorithm has decided
you're worth showing to non-subscribers" threshold. Everything before
that is throat-clearing.
