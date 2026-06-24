# Rhythm Racer — Design Brief

**A world-class browser rhythm-READING game for piano students.**
Concept: *Guitar Hero meets Subway Surfers* — standard rhythmic notation scrolls toward a hit zone; quarter = tap, half = hold, rests = don't tap; perfect/good/miss ratings; combo system; backing music synced to the rhythm.

Skill trained: reading rhythmic notation — quarter/half/whole notes, rests, eighth notes, dotted rhythms, syncopation; time signatures 4/4 → 3/4 → 6/8.

Stack: Vite + TypeScript + React (matches the flagship **Grand Staff Prix 3D**). Reuses that game's gamification layer (XP ranks Beginner→Maestro, gem currency, achievements, daily challenges, mastery-gated level unlock at sustained 90%+ accuracy).

Document status: blueprint for build. Last updated 2026-06-24.

---

## 0. Executive summary

The rhythm-trainer market splits cleanly into four non-overlapping camps, and there is a real gap to own:

- **Notation-reading + tapping**: Complete Rhythm Trainer (paid, polished), teoria.com (free, conservatory-grade but dated UI, no gamification).
- **Falling-notes, no notation**: Melodics (Guitar-Hero highway on MIDI; teaches no theory/notation).
- **Symbol-matching, no performance**: therhythmtrainer.com (multiple-choice, guessable).
- **No rhythm at all**: musictheory.net (zero interactive rhythm exercises).

**Rhythm Racer's unclaimed territory:** (1) counting-system support (1-e-&-a / Takadimi / Kodály) — absent from *every* education app surveyed; (2) a real Web-Audio latency-calibration wizard — nobody does this well on the web; (3) modern, kid/teen-friendly gamified polish over teoria's solid-but-dated reading mechanic; (4) a graded, encouraging feedback ladder (Perfect/Great/Good/Early/Late/Miss with directional color), avoiding Melodics' harsh binary scoring.

Three non-negotiable engineering truths drive the whole design:
1. **`AudioContext.currentTime` is the only trustworthy clock.** Schedule audio with a lookahead scheduler; drive both rendering and input judging off the audio clock — never `setTimeout`, `Date.now`, `performance.now`, or rAF frame time alone.
2. **Calibration is make-or-break, doubly so on the web.** Friday Night Funkin' and Melodics both stumbled on web/audio latency. Ship a real audio + visual/input offset wizard.
3. **Judge the attack onset, not the note duration** (teoria's explicit choice) — far fairer and simpler. (Exception: held notes get a separate release check.)

---

## 1. What makes great rhythm games (and trainers)

### 1.1 Action games — lessons to steal

**Friday Night Funkin'** (open source — the only game with published ms windows; *and* it is browser/web-audio, exactly our constraints).
- Modern windows from source `Scoring.hx`: Perfect 5 ms / Sick ±45 ms / Good ±90 ms / Bad ±135 ms / Shit ±160 ms / Miss >160 ms. Score is a sigmoid (max 500, miss −100), not flat buckets. https://deepwiki.com/FunkinCrew/Funkin/2.4-scoring-and-ratings
- **Health-bar tug-of-war**: hits pull the bar toward you, misses toward the opponent — reframes loss as momentum/rivalry, not attrition. Vocal stems mute on miss so good play "completes the song." https://fridaynightfunking.fandom.com/wiki/Mechanics
- Lesson on forgiveness: "ghost tapping will not be an option (always enabled) since it affects scoring" — **forgiveness must be deterministic and universal, never a player toggle**, or scoring becomes meaningless. https://github.com/FunkinCrew/Funkin/issues/2651
- Failure mode directly relevant to us: vanilla had **no calibration** on a latency-prone web stack — a major flaw later engines fixed. HTML5/web-audio lag spikes are a recurring complaint. https://playgama.com/blog/game-faqs/why-do-some-people-hate-friday-night-funkin/

**Guitar Hero / Rock Band / Clone Hero.**
- Real published numbers only exist for clones: Clone Hero "Precision" = dynamic 140 ms scaling to a 40 ms floor by note spacing (https://x.com/CloneHero/status/1351623992218701832); YARG default = 140 ms total, symmetric 70/70, with a 1.5 front-to-back ratio that reproduces the classic GH "feel." https://wiki.yarg.in/wiki/Hit_engine
- Multiplier 1×→2×→3×→4× advancing every 10 consecutive notes; any miss resets to 1×; Star Power doubles it. https://wiki.clonehero.net/books/clone-hero-manual/page/how-to-play
- Diegetic audio feedback: your instrument track plays on hit, **mutes + squeals on miss** — visceral and core to the feel. https://gamefaqs.gamespot.com/wii/944203-guitar-hero-world-tour/answers/27902
- The franchise's biggest UX failure is its **in-game calibration** ("completely useless"). https://www.neogaf.com/threads/audio-video-latency-in-rock-band-and-guitar-hero.356077/

**A Dance of Fire and Ice** — the elegant "the picture IS the music" case (most relevant to a notation game). Tile *angle* encodes time-to-next-tap: `ms = round(1000·angle/(3·bpm))`; players sight-read music as shape, with the whole chart visible ahead. https://adofai.fandom.com/wiki/Game_Mechanics — **Our standard notation can serve the same role.** Failure: one-mistake sudden-death feels punishing; no difficulty sliders.

**Rhythm Doctor** — the calibration & internal-clock gold standard. Its "7th beat" mechanic (listen to 6 beats, commit on the 7th) trains a true internal pulse — exactly what piano students need. https://wiki.rhythm.cafe/w/index.php?title=Classic_Beats . Its calibration is two-phase (A/V sync, then an input-latency tap test using the *actual gameplay verb*), with separate offsets, 10 ms coarse / 1 ms fine steps, and post-level early/late counts so players self-correct. It deliberately ships sensible defaults rather than full auto-cal, because the game can't distinguish a *miscalibrated* player from one *rushing* a fast level (both read "early"). https://ddrkirbyisq.medium.com/rhythm-quest-devlog-10-latency-calibration-fb6f1a56395c

**Rhythm Heaven & Rhythm Doctor & ADOFAI all independently converge** on a two-channel principle: **keep audio metronomically honest, let visuals carry spectacle/notation, and train the ear.** https://iwataasks.nintendo.com/interviews/ds/rhythm-heaven/0/0/

**Beat Saber** — gentler combo handling worth copying: a mistake **halves one multiplier tier (1/2/4/8×) rather than full reset**. https://steamcommunity.com/app/620980/discussions/0/3315110799622675297/

### 1.2 Education trainers — what to beat

- **teoria.com** is the closest existing model and gives us our core judging mechanic: notation shown → metronome plays the beat → student taps it back → it **checks only the attacks, not the duration**, with per-attack feedback (too early = left arrow, too late = right arrow, missed = X). https://www.teoria.com/en/help/exercises/rr.php . Weaknesses: dated UI, no gamification, not kid-friendly.
- **Complete Rhythm Trainer**: real standard notation, large tap interface, 252 progressive drills / 4 levels / 30 chapters, randomly generated (anti-memorization), 3 stars to pass / 5 perfect, tap-latency calibration. Top complaint: default tempos too slow and tempo control not discoverable. No counting-syllable system (a gap). https://completerhythmtrainer.com/
- **Melodics**: best-in-class practice tooling worth copying — Auto-BPM (speeds up as you succeed), Wait mode (won't advance until correct), 5-min daily goal, streaks. But notation-free, and its feedback is essentially binary (early=orange, late=purple, miss=red, perfect=green, **no graded middle tier**) — its #1 complaint is "too harsh." https://melodics.com/how-it-works , https://support.melodics.com/en/articles/6777096-melodics-app-settings
- **ReadRhythm / Rhythm Sight Reading Trainer**: best performance-tapping visual model — 2-measure rhythm + 1-measure count-in, per-note red/blue/green feedback, % score + beat deviation. https://meganspianolessons.com/2013/02/18/app-review-rhythm-sight-reading-trainer/

### 1.3 Cross-cutting design rules adopted by Rhythm Racer

1. Start generous (~±90–100 ms Good total) and **tighten by level** (osu!'s difficulty model is a clean template).
2. **Scale the timing window, not the chart**, for difficulty/accessibility (Rhythm Doctor Easy/Unmissable, ADOFAI Strict).
3. **Avoid sudden-death**; prefer a recoverable meter (FNF tug-of-war) and attempt-based scoring (ADOFAI's #1 complaint is one-mistake-fails).
4. **Directional, color-coded feedback** — early/late/on-time/missed — but with a **graded Great/Good tier** (fixing Melodics' harshness).
5. **Forgiveness deterministic & universal**, never a toggle.
6. Adopt Melodics' **Auto-BPM and Wait mode** for the practice path; star ratings (3-to-pass / 5-perfect) per Complete Rhythm Trainer.

---

## 2. The hard technical problem: audio/visual sync in the browser

The one architectural principle, repeated by every authoritative source: **`AudioContext.currentTime` (a sample-accurate, hardware-thread clock) is the source of truth.** `setTimeout`/`setInterval` drift can reach hundreds of ms; rAF/`Date.now`/`performance.now` skew with layout, GC, and jank.

### 2.1 The "A Tale of Two Clocks" lookahead scheduler (Chris Wilson)

Canonical article: https://web.dev/articles/audio-scheduling

- Schedule audio events into the precise Web Audio timeline ahead of time via `source.start(when)` against `currentTime`. Once scheduled, the audio thread plays them sample-accurately regardless of main-thread state.
- Run a periodic scheduler that wakes frequently and schedules every event within a short future window:

```js
while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
  scheduleNote(currentNote, nextNoteTime);
  advanceNote();
}
// invoked via setTimeout(scheduler, lookahead)
```

- **Recommended values (from the article): `lookahead` = 25 ms (the setTimeout interval), `scheduleAheadTime` = 0.1 s (100 ms).** The deliberate overlap (wake every 25 ms, schedule 100 ms ahead) absorbs main-thread stalls — the article survives a 50 ms setTimeout delay with no audible problem.
- Two clocks → two loops: the **setTimeout scheduler** queues *audio*; a **separate rAF draw loop** handles *visuals only*, by reading the audio clock each frame. https://catarak.github.io/blog/2014/12/02/web-audio-timing-tutorial/

### 2.2 Measuring input timing against the audio clock

In the input handler (`pointerdown`/`keydown`), the **very first line** reads `const tapTime = audioCtx.currentTime;`. Compute `error = (songTapTime − note.time) * 1000` (ms) where `songTapTime = tapTime − audioOffset − songStartTime`. Both operands live on the audio timeline, so there is no cross-clock drift. (DOM `event.timeStamp` is on the `performance.now()` timeline; for sub-frame precision you can correlate the two once via `getOutputTimestamp()` → `{contextTime, performanceTime}`, but reading `currentTime` synchronously in the handler is accurate enough for v1.)

Reference: O'Reilly *Web Audio API* (Smus), Ch.2 "Perfect Timing and Latency" — https://webaudioapi.com/book/Web_Audio_API_Boris_Smus_html/ch02.html

### 2.3 Latency calibration

The browser exposes partial knowledge — **a user calibration step is still required** (it can't see speaker air-gap, display latency, or input device latency):
- `AudioContext({ latencyHint: "interactive" })` — lowest non-glitching latency, the right hint for games.
- `AudioContext.outputLatency` (Baseline since Mar 2025; feature-detect) — fullest output number; fall back to `baseLatency` (~5–25 ms). https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency

**Two separate offsets** (every shipping game uses this split — Clone Hero, StepMania global offset, osu! offset wizard):
- **Audio offset** — shifts when notes are *expected* relative to the music (corrects audio output latency).
- **Visual/input offset** — shifts the visual hit line / hit window (corrects display + input latency).

**Calibration UX (model on Rhythm Doctor / Rhythm Quest):**
1. *Audio cal*: loop a steady click, user taps ~16–32 times, record `error = tapTime − nearestBeatTime`, discard outliers, store the **median** as `audioOffset`.
2. *Visual/input cal*: canvas flash on the hit line with no audio, user taps the flash, median = combined display+input offset.
3. Seed both from `outputLatency ?? baseLatency` so first run is close; persist in `localStorage`; expose manual ±ms fine sliders.
4. Show post-exercise **early vs late counts** so players self-correct.

### 2.4 Judging windows (concrete ms)

Reference real games:

| Game | Tightest | Mid | Loosest |
|---|---|---|---|
| osu! OD10 / OD5 / OD0 (Great) | ±18 / ±48 / ±78 | — | — |
| StepMania | Marvelous ±22.5 | Great ±90 | Way-Off ±180 |
| Friday Night Funkin' | Perfect 5 / Sick ±45 | Good ±90 | Miss >160 |
| Clone Hero / YARG | 40 ms floor | — | 140 ms total |

osu! window formulas (ms, ±error, scale with Overall Difficulty `OD`): Great `78−6·OD`, Ok `138−8·OD`, Meh `198−10·OD`. https://osu.ppy.sh/wiki/en/Beatmap/Overall_difficulty ; StepMania defaults: https://itgwiki.dominick.cc/en/software/stepmania-judgements

**Rhythm Racer windows (tunable; tighten by level via an OD-style scalar):**

| Rating | Beginner levels | Advanced levels | Color |
|---|---|---|---|
| **Perfect** | ±50 ms | ±25 ms | green |
| **Great** | ±90 ms | ±55 ms | light green |
| **Good** | ±130 ms | ±90 ms | yellow (with early=blue / late=orange tint arrow) |
| **Miss** | beyond Good | beyond Good | red |

Drop a note as a Miss once `songTime > note.time + goodWindow`. In **microphone clap mode, widen all windows ~1.5–2×** (Section 3).

### 2.5 Concrete architecture for the canvas/React game

Decouple three concerns onto the same audio clock:

| Concern | Driver | Clock read |
|---|---|---|
| Audio scheduling | `setTimeout(scheduler, 25)` | `currentTime` (schedule 100 ms ahead) |
| Visual rendering | `requestAnimationFrame` | `currentTime` (read fresh each frame) |
| Input judging | DOM event handler | `currentTime` (read synchronously, first line) |

Note positioning each frame is **computed from the clock, never incremented** (so a dropped frame is one jump, never cumulative drift):

```ts
function render() {
  const songTime = audioCtx.currentTime - songStartTime;
  for (const n of activeNotes) {
    const secsUntilHit = n.time - songTime;
    n.x = hitLineX + secsUntilHit * pixelsPerSecond; // notes approach the hit line
  }
  draw(); requestAnimationFrame(render);
}
```

React rules: keep the AudioContext, scheduler loop, and rAF loop **outside React render** (refs/singletons in a custom hook with `useEffect` setup/teardown). Never put per-frame state in React state. Create/`resume()` the context only after a user gesture (autoplay policy). React owns only menus, calibration sliders, and a throttled score/HUD.

---

## 3. Input methods

### 3.1 Default: tap (keyboard + touch) — the robust recommendation

For piano students (kids included), **the default is a single tap**: Space / large key on keyboard, and a large on-screen touch button. Lowest-latency, most deterministic, most calibratable, most accessible. (Optionally support Web MIDI so a digital piano key = a tap, which is latency-free for *detection* — a nice differentiator versus Melodics, which has no software audio-cal wizard.)

- Score on the event's own `Event.timeStamp` (same monotonic origin as `performance.now()`), not the time your handler runs — it removes event-loop jitter. https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming
- `keydown` for the hit; **ignore auto-repeat** (`if (e.repeat) return`). Prefer Pointer Events (`pointerdown`/`pointerup`) for unified mouse/touch/pen; on the play surface set CSS `touch-action: none` (don't `preventDefault` in a hot handler) and listeners `{ passive: true }`. Configure the viewport meta to kill the legacy 300 ms tap delay. https://nolanlawson.com/2019/08/11/high-performance-input-handling-on-the-web/

### 3.2 Hold detection (half notes, whole notes, dotted)

State machine keyed on `pointerdown.timeStamp` (note-on) and `pointerup.timeStamp` (note-off): judge **both** the start accuracy and the release/duration. Call `el.setPointerCapture(e.pointerId)` on down so the up event always returns. Handle `pointercancel`, window `blur`, and `visibilitychange` to clear stuck notes; for keyboard, suppress `e.repeat` and treat final `keyup` as note-off.

### 3.3 Microphone CLAP mode (opt-in "fun mode," never default)

Pipeline: `getUserMedia({audio})` → `createMediaStreamSource` → analysis. **AnalyserNode for MVP** (set `smoothingTimeConstant` low, ~0–0.2, so transients aren't blunted); **AudioWorklet for production** (128-sample ~3 ms quanta on the audio thread; `ScriptProcessorNode` is deprecated).

Onset detection: **energy/RMS rising-edge** is the cheap baseline; **spectral flux / HFC** is more robust (rejects sustained sounds). Recommended batteries-included lib: **aubiojs** (WASM build of aubio) with its `Onset` detector — defaults: method `hfc` (tuned for percussive onsets like claps), peak-pick threshold `-t 0.3`, silence gate `-s −90 dB`, `minioi 0.020 s` built-in debounce. https://github.com/qiuxiang/aubiojs , https://aubio.org/manpages/latest/aubioonset.1.html . Alternative: **Meyda** for `spectralFlux`/`rms`/`zcr` features and roll your own peak-picking. https://meyda.js.org/audio-features.html

Robustness: adaptive threshold vs ambient noise (rolling baseline + dB headroom; calibrate room for ~1 s on start); **~80–150 ms refractory window** so one clap isn't double-counted; reject low thumps via HFC/`zcr`.

**Mic latency caveats (why it can't be the default):** capture path adds ~20–40 ms before you see samples; **Bluetooth mic is catastrophic** (A2DP 150–200 ms); `baseLatency`/`outputLatency` *do not* include input/mic latency, so the mic offset is unknowable a priori and must be measured. Default `getUserMedia` processing fights you — **disable** `echoCancellation`, `noiseSuppression`, `autoGainControl` (they reshape transients and add delay; AEC needs seconds to adapt). https://blog.addpipe.com/getusermedia-audio-constraints/ . Therefore: clap mode pairs best with **headphones**, ships a **dedicated mic-offset calibration** ("clap on the beat"), and **widens timing windows**.

### 3.4 Accessibility fallbacks

- Full keyboard operability with single (non-chord) keys (Xbox Accessibility Guideline 107 / WCAG). https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107
- Single-switch / scanning support (highest-impact motor accessibility) — map "hit" to one switch input.
- Large, high-contrast touch targets sized for small hands; immediate audio+visual feedback per tap.
- Adjustable timing windows + slow-tempo assist; respect `prefers-reduced-motion`; never make color or audio the *only* cue (deaf/HoH + colorblind). Mic mode is inherently inaccessible to some users → always keep a tap fallback.

---

## 4. Rhythm-reading pedagogy

### 4.1 Counting systems

Three families differ on one axis that matters for a game: does the syllable name the **note value** or the **beat position**?

- **Traditional metric (1-e-&-a / 1-&-2-&)** — numbers mark downbeats, "&/e/a" mark subdivisions. Pro: encodes metric position explicitly, transfers directly to real sheet music. Con: clumsy at speed; same figure relabels each beat, obscuring pattern recognition; awkward in 6/8. https://makemomentsmatter.org/classroom-ideas/rhythm-syllable-systems-what-to-use-and-why/
- **Kodály (ta / ti-ti / ta-a)** — fixed syllable per note value. Pro: intuitive first contact, ideal for absolute beginners/kids (walk=ta, run=ti-ti). Con: provides no metric context → students lose the pulse; breaks in changing meters/syncopation.
- **Gordon (du / du-de / du-ta-de-ta; compound du-da-di)** and **Takadimi (ta-ka-di-mi; compound ta-ki-da)** — beat-position systems: identical audible rhythms always get identical syllables → best for **pattern recognition at speed**, never lose the pulse, handle syncopation + compound meter cleanly. Takadimi has no wind-articulation bias, so it suits piano. http://www.takadimi.net/basics.html

**Recommendation — hybrid, leveled, with a toggle:** Kodály (ta/ti-ti) for onboarding → **Takadimi** for core levels onward → keep **1-e-&-a as a selectable toggle** (what teachers/parents recognize, transfers to print). Render: print the chosen syllable under each notehead, color-coded by beat position; light it as the playhead crosses; speak syllables in the slow-tempo count-in. The repeating color+syllable+glyph triad becomes a learnable "chunk."

### 4.2 Progression ladder (method-book consensus: Faber/Alfred/Kodály/RCM-ABRSM)

Establish **steady pulse with long notes before subdivisions** (Faber delays eighths to Level 2A to avoid a "plodding, arhythmic" feel); introduce each **rest right after its note value** (Alfred); always introduce eighths/sixteenths **beamed**, never as flagged singles.

| Stage | Concept | Time sig |
|---|---|---|
| 1 | Quarter notes (steady pulse) | 4/4 |
| 2 | Half notes | 4/4 |
| 3 | Whole notes | 4/4 |
| 4 | Quarter rest | 4/4 |
| 5 | Half rest, whole rest | 4/4 |
| 6 | Dotted-half note | **3/4** (fills the bar — concrete) |
| 7 | Eighth notes (beamed) | 4/4 → 3/4 |
| 8 | Eighth rest | 4/4 |
| 9 | Dotted-quarter + eighth | 4/4 |
| 10 | Ties | 4/4 |
| 11 | Syncopation (built from ties) | 4/4 |
| 12 | Sixteenth notes | 4/4 |
| 13 | Dotted-eighth + sixteenth | 4/4 |
| 14 | Compound meter | **6/8** |

Time-signature order **4/4 → 3/4 → 6/8** matches RCM/ABRSM (6/8 ~Grade 5). https://www.pianotv.net/2018/10/all-about-grade-5-piano-rcm-abrsm/

### 4.3 Teaching the hard concepts

- **Rests = active silence.** Keep the beat indicator/metronome running through rests; require "holding the silence" (no input) for the rest's duration.
- **Dotted rhythms** — introduce dotted-half in 3/4 first (visible: fills the bar), then dotted-quarter+eighth in 4/4; teach as a felt long-short pattern; it bridges to the 6/8 beat.
- **Syncopation** — build from **ties**, then displaced accent. Keep a strong visual+audio downbeat pulse while the player taps off-beats (body-dissociation: feel the displacement against a fixed reference).
- **6/8 is hard** because the notation/feel mismatch: six eighths look like six beats, but it's **compound duple = two dotted-quarter beats, each split into three**. Teach it as **two beats, not six**: beam eighths in groups of three; show **two large beat pulses** (each nesting three sub-pulses), never six equal ones; at slow tempo count 1-2-3/4-5-6, collapsing to two felt beats as tempo rises; switch syllables to the compound set (Takadimi ta-ki-da). https://viva.pressbooks.pub/openmusictheory/chapter/compound-meters-and-time-signatures/

### 4.4 Assessing mastery

Rubrics converge on two independent dimensions: **accuracy** (correct onsets/durations) and **pulse stability / fluency** (steady beat, no hesitation). Classroom thresholds: mastery = no errors; developing = 3–4; beginning = 5+. RCM literally requires tapping a rhythm **while keeping a steady beat** — dual-task fluency is the bar. https://blog.musicplay.ca/rhythm-assessment-1

**Translation to scoring:** per-tap deviation windows (not binary); track running **% accuracy** *and* **tempo variance**; gate advancement on the "accurate AND steady" tier **sustained over multiple consecutive passages** (consistency, not a single clean run). This maps directly onto the flagship's existing mastery gate (Section 5.6).

### 4.5 Readability at speed

- **Beam by the beat** — "a new beam = a new beat"; never beam across the bar's center; in 6/8 beam in threes. https://mymusictheory.com/rhythm/grouping-and-beaming/
- **Spatial position = time** (the scroll itself makes timing literal — stronger than print spacing).
- **Color-code by beat position** so the player reads ahead; sync-highlight noteheads/rests with playback.
- **Count-in**: one measure of accented-downbeat metronome (spoken syllables at slow tempo, ticks at fast); pulsing/pendulum visual beat indicator.
- Large high-contrast noteheads; uncluttered layout.

---

## 5. Concrete design for Rhythm Racer

### 5.1 Core loop

1. Pick a level (or daily challenge / custom level). 2. One-measure **count-in** (accented downbeat + chosen syllables). 3. Notation **scrolls right-to-left toward a fixed hit line**; backing track + metronome play, scheduled on the audio clock. 4. Player taps quarters, **holds** halves/wholes (note-on→note-off), and **stays silent** through rests. 5. Each onset judged Perfect/Great/Good/Miss with directional early/late color; combo builds; the **tug-of-war "Race Meter"** (your racer vs a rival) moves with hits/misses. 6. End screen: star rating (3 to pass / 5 perfect), % accuracy, tempo stability, early/late counts, XP + gems earned, achievements, mastery celebration if gated. 7. Mastery sustained at 90%+ unlocks the next level. **Auto-BPM** nudges tempo up on success; **Wait mode** (practice) won't advance until correct.

### 5.2 Scoring & combo math

- **Note score (sigmoid-flavored, à la FNF):** Perfect 100, Great 70, Good 40, Miss 0; held notes add a release bonus (0–50) for accurate note-off. Rests: correct silence = +Perfect-equivalent; tapping during a rest = a "Shit"/penalty onset (deterministic ghost-tap rule, always on).
- **Combo multiplier:** 1× → 2× (10 consecutive) → 3× (25) → 4× (50), Star-Power-style. **A miss halves the current tier (Beat Saber), it does not full-reset** — gentler, less rage-quit. Score per note = `baseRating × multiplier`.
- **Race Meter** (FNF tug-of-war): hit nudges your racer ahead, miss nudges the rival; finishing ahead = bonus gems. **Not sudden-death.**
- **Star rating:** 3 stars = pass (≈ ≥80% weighted), 5 = perfect run.

### 5.3 Scrolling-notation renderer — recommendation

**Pre-render notation to sprites, then scroll the sprites on canvas. Do NOT run VexFlow per frame** (its formatter is heavy, meant for score-load, not 60 fps).

- At level load, use **VexFlow 5** (MIT, TS-native — https://github.com/vexflow/vexflow) as an **offline rasterizer**: engrave each note/figure/measure correctly (beams, rests, dotted notes, time signatures, ties, tuplets all supported) to an **offscreen canvas / `Image`** and cache the bitmaps. Best of both worlds: correct engraving at authoring time, zero per-frame cost.
- Game loop only `drawImage`s cached bitmaps at updated X (driven by `currentTime`), culling notes past the hit line — the universal Guitar-Hero pattern. MDN endorses offscreen pre-render + `drawImage`. https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- Alternative for max control / smaller dep: draw **SMuFL/Bravura** glyphs (SIL OFL, commercial-OK — https://github.com/steinbergmedia/bravura) directly to offscreen canvases. Use this only if VexFlow's footprint becomes a problem.
- Keep notation on **canvas** (not a mixed animated-SVG layer) for clean coordination with hit detection and effects.

Trade-off summary: live VexFlow = correct but won't scroll smoothly; raw glyphs = fast but you reimplement engraving; **pre-rendered VexFlow sprites = correct + fast** (recommended).

### 5.4 Tech stack + libraries

| Need | Choice | URL / license |
|---|---|---|
| App shell | Vite + React 19 + TypeScript | matches flagship |
| State | Zustand | (flagship already uses it) |
| Audio engine / scheduling | **Tone.js** — `Transport` for scheduling, **`Tone.Draw`** + `Transport.seconds` for audio-locked visuals | https://tonejs.github.io/ — MIT |
| (or) raw Web Audio | hand-rolled 25/100 ms lookahead scheduler if avoiding a dep | https://web.dev/articles/audio-scheduling |
| Notation engraving (offline rasterize) | **VexFlow 5.0** | https://github.com/vexflow/vexflow — MIT |
| Music font (alt renderer) | **Bravura (SMuFL)** | https://github.com/steinbergmedia/bravura — SIL OFL |
| Plain SFX / backing track playback | **Howler.js** (flagship already depends on it) — SFX only, *not* the timing backbone | https://howlerjs.com/ — MIT |
| Mic onset detection (opt-in) | **aubiojs** (Onset, `hfc`) or **Meyda** | https://github.com/qiuxiang/aubiojs · https://meyda.js.org/ |

**Tone.js vs raw Web Audio:** both share the accurate audio clock; Tone.js is recommended because `Transport`, `Part`/`Sequence`, and especially **`Tone.Draw`** provide scheduling + audio-synced-visuals out of the box. Critical caveat: Transport callbacks fire *ahead* of audible time (default lookAhead ≈ 0.1 s) — **never trigger visuals directly inside a Transport callback**; route them through `Tone.Draw`. https://github.com/Tonejs/Tone.js/wiki/Accurate-Timing

### 5.5 Keeping background music in sync

The backing track is itself scheduled on `currentTime` (one `AudioBufferSourceNode.start(songStartTime)` or Tone's `Transport`), so it shares the exact clock that positions the notes and judges taps. Note times are authored as **beats**, converted to seconds via the level BPM; on Auto-BPM tempo change, recompute note seconds and (if using a stretchable backing) adjust playbackRate or swap stems. Use a count-in measure to align `songStartTime`. Because every layer reads one clock, audio, scrolling notation, and judgment never drift.

### 5.6 Reusing the flagship gamification model

The flagship (`grand-staff-prix-3d/src/data/progression.ts` + `src/state/store.ts`) already implements everything — reuse it verbatim:

- **XP ranks** (`RANKS`): Beginner(0) → Novice(100) → Apprentice(300) → Student(600) → Musician(1000) → Performer(1500) → Artist(2200) → Soloist(3200) → Virtuoso(5000) → Master(9000) → **Maestro(15000)**. Use `rankForXp()`.
- **Gems** (`gemsForRun(score, mastered, accuracy)`): `round(score/400)` + 5 if accuracy ≥ 0.95 + 25 if mastered. Reuse unchanged.
- **Mastery gate** (`store.ts`): unlock next level when the player demonstrates the skill — current constants `MASTERY_STAGE=4`, `MASTERY_MIN_NOTES=30`, `MASTERY_ACCURACY=0.9`. Rhythm Racer maps "stage" → tempo tier and adds the **tempo-stability** dimension (Section 4.4): require ≥90% onset accuracy **and** low tempo variance over ≥30 notes sustained, before unlocking. `START_LIVES=3`.
- **Achievements** (`ACHIEVEMENTS`, `checkAchievements`): reuse the framework; add rhythm-specific ones (e.g., "Metronome" = full run within ±50 ms; "In the Pocket" = 50 combo; "Compound Interest" = master a 6/8 level; "Syncopator" = clean syncopation level).
- **Daily challenges** (`dailyChallenges`, `DailyType = notes|accuracy90|stage|streak|games`): reuse directly (e.g., "tap 200 notes today," "finish at 90%+," "reach tempo tier 6").
- **Custom levels** (`addCustomLevel`): extend so students/teachers author their own rhythm charts (note values + meter + BPM) — beats teoria's lack of authoring polish.
- Persist via the existing `localStorage` profile keys pattern.

### 5.7 Phased build plan

**Phase 0 — Spike (de-risk the hard part).** Tone.js (or raw lookahead) + canvas: a single 4/4 quarter-note lane scrolling on `currentTime`, Space-to-tap judged against the audio clock, Perfect/Good/Miss with early/late color. Add the **audio + visual/input calibration wizard** here — it's foundational, not a polish item. Verify on a Bluetooth-headphones device.

**Phase 1 — MVP.** Stages 1–8 of the ladder (quarter→whole, rests, dotted-half in 3/4, beamed eighths, eighth rest). VexFlow offline-rasterized sprites. Hold detection for halves/wholes. Combo + Race Meter + sigmoid scoring + star rating. Count-in. Wire in the **reused** XP/ranks/gems/mastery-gate/achievements/daily-challenges. Keyboard + touch input. Auto-BPM + Wait (practice) mode.

**Phase 2 — Full curriculum.** Stages 9–14: dotted-quarter+eighth, ties, syncopation, sixteenths, dotted-eighth+sixteenth, and **6/8 compound meter** with the two-beat treatment. Counting-system toggle (Kodály / Takadimi / 1-e-&-a) with under-note syllables + spoken count-in. Custom-level authoring.

**Phase 3 — Polish & reach.** Microphone clap mode (AudioWorklet + aubiojs, dedicated mic-cal, widened windows). Web MIDI (digital-piano-key = tap). Full accessibility pass (switch/scanning, reduced-motion, colorblind-safe palette, adjustable windows). Backing-track stems that mute on miss (FNF/GH feel). Leaderboards (deterministic forgiveness preserved).

---

## 6. Source index (primary)

Timing/sync: web.dev "A tale of two clocks" https://web.dev/articles/audio-scheduling · Web Audio timing tutorial https://catarak.github.io/blog/2014/12/02/web-audio-timing-tutorial/ · MDN `outputLatency` https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency · osu! OD https://osu.ppy.sh/wiki/en/Beatmap/Overall_difficulty · StepMania windows https://itgwiki.dominick.cc/en/software/stepmania-judgements · Clone Hero calibration https://wiki.clonehero.net/books/guides-and-tutorials/page/calibrating-audio-and-video · Rhythm Quest devlog 10 (calibration) https://rhythmquestgame.com/devlog/10.html
Games: FNF scoring https://deepwiki.com/FunkinCrew/Funkin/2.4-scoring-and-ratings · FNF ghost-tap https://github.com/FunkinCrew/Funkin/issues/2651 · YARG hit engine https://wiki.yarg.in/wiki/Hit_engine · ADOFAI mechanics https://adofai.fandom.com/wiki/Game_Mechanics · Rhythm Doctor 7th beat https://wiki.rhythm.cafe/w/index.php?title=Classic_Beats
Trainers: teoria rhythmic reading https://www.teoria.com/en/help/exercises/rr.php · Complete Rhythm Trainer https://completerhythmtrainer.com/ · Melodics https://melodics.com/how-it-works
Input/mic: MDN PerformanceEventTiming https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming · Nolan Lawson input perf https://nolanlawson.com/2019/08/11/high-performance-input-handling-on-the-web/ · aubiojs https://github.com/qiuxiang/aubiojs · aubioonset https://aubio.org/manpages/latest/aubioonset.1.html · Meyda features https://meyda.js.org/audio-features.html · getUserMedia constraints https://blog.addpipe.com/getusermedia-audio-constraints/ · XAG 107 https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107
Pedagogy: syllable systems https://makemomentsmatter.org/classroom-ideas/rhythm-syllable-systems-what-to-use-and-why/ · Takadimi https://www.takadimi.net/basics.html · Faber FAQ https://pianoadventures.com/piano-books/basic-faqs/teaching/ · RCM/ABRSM Grade 5 https://www.pianotv.net/2018/10/all-about-grade-5-piano-rcm-abrsm/ · compound meter https://viva.pressbooks.pub/openmusictheory/chapter/compound-meters-and-time-signatures/ · beaming https://mymusictheory.com/rhythm/grouping-and-beaming/ · rhythm assessment https://blog.musicplay.ca/rhythm-assessment-1
Rendering: VexFlow https://github.com/vexflow/vexflow · Bravura/SMuFL https://github.com/steinbergmedia/bravura · canvas optimization https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas · Tone.js accurate timing https://github.com/Tonejs/Tone.js/wiki/Accurate-Timing · Howler https://howlerjs.com/
