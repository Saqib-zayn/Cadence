# SpeakSharp — Full Product Plan v2

> Gives you a random word and a context, makes you speak about it on the spot, then tells you exactly how you did — filler words, pacing, clarity — with a score that tracks over time.

---

## What's changed from v1

The original plan was solid. This version adds:
- **Social sharing** — shareable score cards to drive word-of-mouth
- **Retention hooks** — streaks, weekly challenge words, beat-your-last-score prompts
- **Difficulty gating** — beginners start on Easy, harder words unlock progressively
- **Score consistency** — filler word counting is deterministic, LLM only judges qualitative elements
- **Mic permission UX** — trust-building moment before the browser prompt fires
- **Loading state design** — no plain spinner; progress cues that make analysis feel active

---

## Core user flow

The user opens the app and sees a clean, focused screen. One button: **"Start Round."** They tap it. The app generates a random word from their current difficulty tier and calls the LLM to generate a short context prompt. Something like:

> **Word: "Leverage"** — *You're in a job interview and the interviewer asks how you'd approach a project with limited resources. Use this word naturally in your response.*

The user gets 5 seconds to read and think (visible countdown — the "think before you speak" training). Then the mic activates and a recording indicator appears. The user speaks. They hit **"Done"** when finished, or there's a 60-second max.

The audio goes to Groq Whisper, which returns a word-level timestamped transcript. A **staged loading screen** (see below) plays while analysis runs. That transcript plus the original context go to Groq Llama, which returns structured feedback. The app renders the results screen: transcript with filler words highlighted in red, unusual mid-sentence pauses in amber, good pauses (between sentences) in green, a fluency score out of 100, and 2–3 specific feedback points.

At the bottom of results: a **Share Card** button and a **"Beat This Score"** prompt if the score is lower than their personal best.

Session data saves to localStorage. The **Progress tab** shows score trend, most common filler words, streak, and an all-rounder summary.

---

## Screens

### 1. Home / Pre-round screen
- App name + tagline
- Difficulty badge (Easy / Medium / Hard) — tappable to change
- Current streak (🔥 N days) if streak > 0
- Weekly Challenge banner if active (see Retention section)
- **"Start Round"** CTA — prominent, single action

### 2. Mic Permission screen *(new — shown on first use only)*
Before the browser fires its permission prompt, show a full-screen interstitial:
- Headline: **"Your voice stays on your device"**
- Two lines of copy: audio is sent to Groq for transcription and immediately discarded. Nothing is stored on a server. No account needed.
- Button: **"Got it — allow mic"** → triggers the browser prompt
- This runs once and is flagged in localStorage so it never repeats.

### 3. Round screen

**Word refresh rule — critical:** Every single time the user hits "Start Round" or "Go again", a new word must be drawn. The word is never reused from the previous round within a session. This must be enforced at the state level — the word is generated fresh on each record trigger, never cached from the previous round. This is a known bug vector: if the word is stored in component state and the component doesn't fully remount between rounds, the same word silently persists. The fix is to key the word draw to the record action itself, not to component mount — increment a `roundKey` integer on every new round and pass it as the React `key` prop to the RoundScreen component, forcing a full remount and a clean state each time.

**Standard mode (default):**
- Word (large, centre) + difficulty tag
- Context paragraph below
- 5-second think countdown with visual fill animation
- Mic activates automatically when countdown hits zero
- Waveform-style recording indicator (real volume from Web Audio API)
- "Done" button + 60s max timer in corner
- Round number in session (e.g. "Round 3")

**Challenge mode (opt-in via Settings):**
- User sees only: *"Hit record when you're ready"* — no word, no context shown yet
- User taps record
- Word and context appear simultaneously the moment recording starts — no delay, no countdown
- User must begin speaking immediately; a 3-second silence at the start triggers a subtle *"start speaking..."* nudge (not a penalty, just a prompt)
- Everything else is identical to standard mode
- This mode is harder and more realistic — it simulates being caught off guard mid-conversation

**Settings toggle:** *"Challenge mode — word appears after you hit record"* — off by default, stored in localStorage.

### 4. Staged loading screen *(replaces plain spinner)*
A looping drum animation plays centre-screen — a Lottie file of drumsticks tapping a rhythm (source from LottieFiles, free tier, no animation skills required). The drum ties directly back to the app name: cadence, rhythm, drumming. It's on-brand without being literal.

Below the animation, a rotating phrase swaps every 1.5 seconds. 8–10 phrases in the pool, picked randomly each load so returning users see different ones:
- *"Counting your ums..."*
- *"Checking your rhythm..."*
- *"Was that a pause or a think?"*
- *"Measuring your cadence..."*
- *"Analysing your pacing..."*
- *"How many 'basically's was that?"*
- *"Almost there..."*
- *"Finding your filler words..."*
- *"That pause was interesting..."*
- *"Reading between the words..."*

A thin progress bar sits at the bottom of the screen, filling across four internal stages (transcribe → read → count → score). If the API responds faster than the animation cycle, the screen holds at the final phrase until the bar completes — avoids a jarring instant jump and makes the analysis feel deliberate rather than rushed.

**Build note (Phase 8):** Use the `lottie-react` package to drop in the animation. Find a suitable drum/rhythm/metronome Lottie file at lottiefiles.com — search "drum", "rhythm", or "metronome". Pick one that loops cleanly and isn't too busy.

### 5. Results screen
- **Fluency score** — large, prominent, colour-coded (red < 50, amber 50–74, green 75+)
- Score delta vs. personal best (e.g. "+7 from your best" or "📈 New personal best!")
- **Annotated transcript**: filler words in red with count badge, mid-sentence pauses in amber, sentence-end pauses in green
- **Score breakdown bar**: five components visualised (see Scoring section)
- **Feedback points**: 2–3 specific, actionable notes from the LLM
- **Share Card button** (see Social section)
- **"Go again"** button — starts next round immediately
- **"Beat This Score"** nudge if score < personal best

### 6. Progress screen
- Line chart of last 20 scores (Recharts)
- Rolling average (last 10) + all-time average
- Streak counter + longest streak
- Top 5 filler words (bar chart)
- All-rounder summary card (rule-based, see below)
- Total rounds completed

### 7. Settings screen
- Context preference: Interview / Casual / Presentation / Random / Custom
- Difficulty: Easy / Medium / Hard / Mixed
- **Challenge mode toggle** — *"Word appears after you hit record"* (off by default)
- **Groq API key** — optional text input. Label: *"Your Groq API key (optional) — removes the daily limit."* Stored in localStorage, sent as override header on all API calls. Link to groq.com/keys beside the field.
- Clear history button (with confirm dialog)

---

## Social sharing *(new)*

### Share Card
After every completed round, the results screen has a **"Share my score"** button. This generates a static image (via `html2canvas` on a hidden DOM element) and triggers the native share sheet on mobile or a download on desktop.

**Card design:**
```
┌─────────────────────────────────┐
│  🎙 SpeakSharp                  │
│                                 │
│  Word: LEVERAGE                 │
│  Score: 84 / 100   ████████░░  │
│                                 │
│  ✓ Only 1 filler word           │
│  ✓ Strong pacing                │
│  ✗ Trailed off at the end       │
│                                 │
│  speaksharp.vercel.app          │
└─────────────────────────────────┘
```

- Card is 1080×1080px (Instagram-square safe)
- Colour scheme matches the score (red / amber / green accent)
- The word they spoke on is always shown — creates curiosity ("wait, what did they say about *leverage*?")
- URL at the bottom is the only CTA — no sign-up required, just open and play

### Share copy (pre-filled)
For Twitter/X and WhatsApp:
> *Scored 84/100 on "Leverage" 🎙 — only 1 filler word. Try beat it: speaksharp.vercel.app*

This is pre-filled in the share sheet. Short, has a score, has a challenge. Copy is generated dynamically based on score tier:
- 90+: *"Just hit [score] on SpeakSharp 🔥 — can you?"*
- 75–89: *"Scored [score] on '[word]' — pretty happy with that one"*
- 50–74: *"Humbling myself on SpeakSharp ([score]/100)... filler words everywhere 😅"*
- Under 50: *"Starting from the bottom on SpeakSharp ([score]/100) — watch this space"*

The under-50 copy is intentionally self-deprecating and shareable. People love sharing their bad scores almost as much as their good ones.

---

## Retention hooks *(new)*

### Daily streak
- A streak increments when the user completes at least one round in a calendar day
- Shown on the home screen and the progress tab
- Breaks if a day is missed — no "streak freeze" mechanic in v1 (keep it honest)
- At milestone streaks (3, 7, 14, 30 days) a subtle celebration animation fires on the home screen

### Weekly Challenge Word
- Every Monday, a new "Challenge Word" is set — same word for all users, hardcoded in a static weekly schedule (no backend needed)
- Shown as a banner on the home screen: **"This week: JUXTAPOSITION — 847 rounds played"**
- "Round count" is stored in localStorage per-device and summed client-side — it's a fake global count seeded at a plausible number (e.g. starts at 1,200), incremented by each local session. Not real, but socially motivating.
- Using the challenge word gets a small badge on the results card ("Weekly Challenge ⚡")

### Beat your last score prompt
- If a round score is lower than personal best, the results screen shows: *"Your best is [X]. One more round?"*
- Button label: **"Beat it →"** — pre-loads same context category, same difficulty, new word

### Post-session summary (after 3+ rounds in one session)
- After the third round in a sitting, the results screen shows a mini-summary banner at the top: *"3 rounds today — avg score 71. Your filler word count is trending down 📉"*
- One insight, one number, one trend direction. Not a modal — just a card above the normal results.

---

## Difficulty gating *(updated)*

Word bank has three tiers: **Easy**, **Medium**, **Hard**.

New users always start on **Easy**. The app does not ask — it just starts easy.

**Unlock progression:**
- Medium unlocks after completing 5 rounds with an average score ≥ 60
- Hard unlocks after completing 5 Medium rounds with an average score ≥ 70
- A small unlock toast fires: *"Medium words unlocked 🔓"*

Users can manually override difficulty in Settings at any time — the gating is a default path, not a lock.

The **difficulty tag** on the Round screen is always visible so users know what they're being tested on. If a user gets a hard word and scores low, they can see "Hard" and contextualise the result fairly.

---

## Scoring system *(updated for consistency)*

The fluency score is a **hybrid**: deterministic counting for what can be counted, LLM judgement only for what genuinely requires it.

### Deterministic layer (60 points possible)
These are computed from the Whisper transcript and Web Audio data on the frontend — no LLM involved:

| Component | Weight | How it's measured |
|---|---|---|
| Filler word count | 30 pts | Word-match against a hardcoded filler list: "um", "uh", "like", "you know", "so", "basically", "literally", "right", "kind of", "sort of". Count is exact. |
| Pause quality | 20 pts | Web Audio + Whisper timestamps. Mid-sentence silences > 1.5s lose points. Sentence-end pauses of 0.3–1s score well. |
| Sentence completion | 10 pts | Whisper transcript ends mid-clause? Detected by grammar heuristic (no terminal punctuation, incomplete clause). |

### LLM layer (40 points possible)
The LLM only judges what it's genuinely good at — qualitative assessment:

| Component | Weight | What the LLM assesses |
|---|---|---|
| Natural word usage | 20 pts | Did they use the target word naturally, or was it clearly forced/shoehorned? |
| Clarity of thought | 20 pts | Did the response make sense in the given context? Was the argument coherent? |

**Why this matters:** If filler counting is deterministic, the score is reproducible. The same transcript always produces the same base score. The LLM variation only affects 40 points, and across multiple runs the variance tends to compress. The user experience is that their score feels fair and consistent.

The LLM returns a JSON response with: `naturalWordScore` (0–20), `clarityScore` (0–20), `fillerWordsFound` (array with positions), `pauseAnalysis` (good/bad annotations), `feedbackPoints` (array of 2–3 strings), and optional `notes` (mispronunciations, grammar, vocabulary — not scored).

---

## Technical architecture

### Stack
- **Frontend**: React + Vite, deployed on Vercel
- **Backend**: Three Vercel serverless functions (JS)
- **STT**: Groq Whisper (`whisper-large-v3`)
- **LLM**: Groq Llama 3.3 70B
- **Charts**: Recharts
- **Share card**: html2canvas
- **Rate limiting**: Upstash Redis (free tier)
- **Storage**: localStorage only — no database, no auth

### Frontend structure
```
speaksharp/
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── RoundScreen.jsx
│   │   ├── MicPermissionScreen.jsx      ← new
│   │   ├── LoadingScreen.jsx            ← new (staged loader)
│   │   ├── ResultsScreen.jsx
│   │   ├── ShareCard.jsx                ← new
│   │   ├── ProgressScreen.jsx
│   │   ├── Timer.jsx
│   │   ├── AudioRecorder.jsx
│   │   ├── TranscriptDisplay.jsx
│   │   ├── StreakBadge.jsx              ← new
│   │   └── WeeklyChallengeBanner.jsx    ← new
│   ├── hooks/
│   │   ├── useAudioRecorder.js
│   │   ├── useLocalStorage.js
│   │   └── useStreak.js                ← new
│   ├── utils/
│   │   ├── wordBank.json
│   │   ├── weeklyChallenge.js           ← new (static schedule)
│   │   ├── scoring.js                   ← deterministic layer
│   │   ├── fillerWords.js               ← new (hardcoded filler list)
│   │   ├── shareCard.js                 ← new (html2canvas wrapper)
│   │   ├── allRounder.js                ← rule-based summary logic
│   │   ├── deviceId.js                  ← new (generate + retrieve UUID)
│   │   └── api.js
│   └── styles/
├── api/
│   ├── transcribe.js
│   ├── analyse.js
│   ├── generate-context.js
│   └── _rateLimit.js                    ← new (shared Upstash rate limit helper)
├── package.json
└── vercel.json
```

### Serverless functions

**`/api/transcribe`**
Receives the audio blob, forwards to Groq Whisper with `response_format: "verbose_json"` and `timestamp_granularity: "word"`. Returns the full timestamped transcript.

**`/api/analyse`**
Receives: transcript (with timestamps), the target word, the context, and raw pause data from Web Audio. The LLM is only asked to score `naturalWordUsage` and `clarityOfThought` (0–20 each), identify filler word positions (for UI highlighting — the count is already computed), annotate pauses as good/bad, and return 2–3 feedback points. The prompt specifies that scores should reflect a strict rubric, not be inflated — the example anchor points are included in the prompt ("A score of 18–20 means the word felt completely natural; 10–13 means it was technically used but clearly forced").

**`/api/generate-context`**
Receives a word and optional context category. Returns a one-paragraph scenario prompt. Cached in sessionStorage on the frontend — if the same word + category is requested twice, the second call is skipped.

### Audio pipeline
MediaRecorder captures as webm/ogg blob → sent to `/api/transcribe`. Web Audio API runs in parallel during recording → captures volume envelope at 50ms intervals → used for pause detection and the recording visualiser waveform. The Web Audio data is passed to `/api/analyse` as a compact array: `[[timestamp_ms, volume_rms], ...]`.

---

## Rate limiting

No sign-up, no auth — but the Groq API calls need protection against abuse. The solution is an **anonymous device token** system backed by **Upstash Redis**, invisible to legitimate users.

### How it works

On first visit the frontend generates a `crypto.randomUUID()` and stores it in localStorage as `cadence_device_id`. Every API call to `/api/transcribe`, `/api/analyse`, and `/api/generate-context` sends this token in a request header (`x-device-id`).

Each serverless function checks the token against Upstash Redis before doing anything else:
```javascript
import { Redis } from '@upstash/redis'
const redis = new Redis({ url: process.env.UPSTASH_URL, token: process.env.UPSTASH_TOKEN })

const key = `cadence:${deviceId}:${today}` // e.g. "cadence:uuid:2024-01-15"
const count = await redis.incr(key)
if (count === 1) await redis.expire(key, 86400) // expires after 24 hours
if (count > DAILY_LIMIT) return res.status(429).json({ error: 'limit_reached' })
```

The key is scoped to `deviceId + date` so the limit resets automatically at midnight UTC every day without any cleanup job.

### Limits
| Endpoint | Daily limit per device | Reasoning |
|---|---|---|
| `/api/generate-context` | 25 calls | One per round + retries |
| `/api/transcribe` | 20 calls | One per completed round |
| `/api/analyse` | 20 calls | One per completed round |

20 rounds per day is generous for a legitimate user. Groq's free tier is generous but not unlimited — this keeps costs predictable.

### What the user sees when they hit the limit
The frontend detects a `429` response and shows a friendly full-screen message instead of an error:

> *"You've hit your daily limit of 20 rounds — nice work today. Come back tomorrow, or grab a free Groq API key in Settings to go unlimited."*

- "Come back tomorrow" is the default CTA
- "Grab a free Groq API key" links to groq.com — users paste their own key into Settings, stored in localStorage, sent as an override header. The serverless function uses the user's key instead of the app's key, bypassing the rate limit entirely.

### Why not IP-based limiting
IP limiting was considered and rejected. Shared IPs (offices, university networks, mobile carriers using CGNAT) would cause legitimate users to hit each other's limits. Device tokens are more accurate and fairer. The downside — a determined abuser can clear localStorage and get a new token — is acceptable for v1. The goal is to prevent runaway costs from bots, not to stop every edge case.

### Upstash setup
- Free tier: 10,000 commands/day — more than sufficient for v1
- Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel environment variables
- Install: `npm install @upstash/redis`
- No Redis server to manage — fully serverless, pay-as-you-go

---

## Data storage (localStorage)

Each completed round saves:
```json
{
  "id": "uuid",
  "timestamp": 1720000000000,
  "word": "leverage",
  "difficulty": "medium",
  "contextCategory": "interview",
  "fillerCount": 2,
  "fillerWords": [{"word": "um", "position": 4}, {"word": "like", "position": 12}],
  "pauseCount": 1,
  "fluencyScore": 84,
  "scoreBreakdown": {
    "fillerWords": 24,
    "pauseQuality": 18,
    "sentenceCompletion": 10,
    "naturalWordUsage": 16,
    "clarityOfThought": 16
  },
  "transcript": "...",
  "feedbackPoints": ["...", "..."],
  "isWeeklyChallenge": false,
  "shareable": true
}
```

Progress aggregates: rolling average (last 10), all-time average, filler word frequency map, total rounds, current streak, longest streak, difficulty distribution.

---

## All-rounder summary (rule-based)

Generated client-side. Checks 5 patterns across the last 10 rounds:

| Pattern | Threshold | Output |
|---|---|---|
| Consistent filler-word low | fillerCount ≤ 1 in 8/10 rounds | "You rarely use filler words — strong habit." |
| Improving trend | Last 5 avg > First 5 avg by 5+ pts | "Your scores are trending upward — consistency is building." |
| Pause quality low | pauseQuality < 12 in 7/10 rounds | "You tend to pause mid-sentence — practise pausing between sentences instead." |
| Trailing off | sentenceCompletion < 8 in 6/10 rounds | "You often trail off before finishing your thought. Try slowing down in the final clause." |
| Hard word performance | difficulty = hard and score ≥ 75 | "You're holding up well on hard words — consider pushing complexity further." |

The summary card shows up to 2 strengths (green) and 2 weaknesses (amber). It doesn't show anything until 10 rounds are completed.

---

## Word bank

Static JSON of 250 words, tagged by difficulty and category:

**Easy** — everyday, short, familiar: *change, team, problem, idea, goal, plan, risk, trust, choice, focus*

**Medium** — professional, recognisable but requiring some thought: *leverage, nuance, delegate, initiative, friction, articulate, synthesise, iterate, empathy, momentum*

**Hard** — abstract, polysyllabic, or domain-specific: *juxtaposition, paradigm, ameliorate, sycophantic, epistemological, circumspect, predicated, antithetical, hegemony, perfunctory*

Weekly Challenge Words are drawn from a pre-planned schedule stored in `weeklyChallenge.js` — a plain array of `{ weekNumber, word, difficulty }` objects covering 52 weeks. Week number is derived from the current date.

---

## Build order

### Phase 1 — Audio spike
Get MediaRecorder working in the browser. Capture a blob, play it back. Confirm it works across Chrome, Safari, and Firefox. Note: Safari requires ogg fallback or aac. Confirm Web Audio volume capture works in parallel.

### Phase 2 — Whisper integration
Wire up `/api/transcribe`. Send recorded audio, get back a timestamped transcript. Display it raw on screen. This is the highest-risk technical dependency — validate it first.

### Phase 3 — Core round flow
Build the word bank, `/api/generate-context`, the MicPermissionScreen, the 5-second countdown, the staged loading screen, and the full record → transcribe → display loop. No scoring yet.

### Phase 3.5 — Rate limiting
Set up Upstash Redis. Build `_rateLimit.js` shared helper. Wire device token generation into `deviceId.js`. Add rate limit checks to all three API routes. Test the 429 response and the friendly limit-hit screen. Add the "bring your own Groq key" option to Settings. This phase is short but must happen before any public sharing.

### Phase 4 — Scoring and results
Build the deterministic scoring layer (filler count, pause analysis, sentence completion) in `scoring.js`. Build `/api/analyse` with the hybrid rubric prompt. Build the annotated transcript, score breakdown bar, and feedback points on ResultsScreen.

### Phase 5 — Social
Build the ShareCard component and html2canvas export. Wire up the native share sheet. Add dynamic share copy generation. Test on iOS and Android (share sheet behaviour differs).

### Phase 6 — Retention
Add streak tracking in `useStreak.js`. Build the Weekly Challenge banner and `weeklyChallenge.js` schedule. Add the "Beat This Score" prompt. Add unlock progression for difficulty tiers. Add post-session summary banner.

### Phase 7 — Progress screen
Add localStorage persistence across sessions. Build the progress screen: line chart (Recharts), filler word bar chart, streak display, all-rounder summary card.

### Phase 8 — Polish
UI design, responsive layout, loading states, error handling, edge cases (empty recordings, API failures, browser mic not available, very short responses < 3 seconds). Test on mobile — this is primarily a mobile-use app.

---

## Edge cases to handle explicitly

- **Rate limit hit (429 response)**: Show friendly full-screen message — "You've hit your daily limit of 20 rounds. Come back tomorrow, or add your own Groq API key in Settings to go unlimited." Never show a raw error.
- **Missing or malformed device ID**: Regenerate a fresh UUID on the frontend, store it, retry the request once automatically before surfacing any error.
- **Same word repeating between rounds**: The word draw must be keyed to the record action via a `roundKey` integer (see Round screen section). Additionally, keep a `recentWords` array in session state (last 10 words used) and exclude them from the draw pool — prevents the same word appearing twice in a short session even by chance.
- **Empty or near-silent recording** (< 3 seconds): Show "Too short — try again" without calling any API
- **Whisper returns no words**: Fallback message "We couldn't transcribe that clearly — check your mic and try again"
- **API timeout** (Groq > 8 seconds): Show a retry option, don't lose the round
- **Browser blocks mic permanently**: Detect `NotAllowedError` and show instructions for re-enabling per browser
- **Safari webm incompatibility**: Detect codec support and fall back to audio/mp4 or audio/ogg
- **LocalStorage full**: Gracefully trim oldest rounds (keep last 50) with a silent LRU eviction

---

## v2 ideas (not in scope now, but worth noting)

- **Past rounds drawer**: A history panel accessible from the side drawer showing every completed round — word, score, date, and a tap-to-expand view of the full transcript and feedback. The drawer item is already visible in v1 but grayed out with a "Soon" badge so users know it's coming. Build once localStorage data is proven stable.
- **Head-to-head mode**: Two people get the same word, compare scores — requires a tiny backend
- **Vocabulary builder**: If the LLM flags unfamiliar vocabulary in feedback, the word gets added to a personal "learn this" list
- **Voice coach personas**: Different feedback styles (tough / encouraging / neutral) as a settings option
- **Export to PDF**: Full progress report, useful for job-seekers preparing for interviews
- **PWA / offline mode**: Word bank and scoring are mostly local; could work offline with cached Whisper
