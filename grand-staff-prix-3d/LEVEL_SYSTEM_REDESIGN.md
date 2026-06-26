# Grand Staff Prix — Level System Redesign (Adaptive Note Ladder)

Status: **DESIGN — ready to implement.** This is the source of truth for the rebuild.
Implementation will be done by a loop of agents; each Phase in §11 is a discrete unit.

> **Working agreement for the agent loop:** There is **no time limit**. Do not rush or
> cut scope to "finish fast." The only goal is work that is **accurate, professional, and
> clean** — pedagogically correct, matching the surrounding code's style, fully typed,
> compiling, with the smoke test green. Prefer doing one phase thoroughly and verifying it
> over racing ahead. When unsure between "quick" and "correct," always choose correct.

---

## 0. The problems we're fixing (grounded in current code)

1. **Earliest levels are too hard.** Every level — including `treble-1` "Middle C Position" — is hardcoded `mode: 'mix'`, and the wave generator coin-flips name vs. find each wave (`src/state/store.ts:298`). So a 6-year-old's *first* note gets the hardest variant ("find" = letter shown, place it on the staff) at random. Identification must come first.
2. **No finish line → boredom.** A race only ends when lives hit 0 (`store.ts:561`). Stages increment forever (`stage = 1 + floor(correctCount/8)`, `store.ts:505`). A good student literally cannot "win" — they get bored or must deliberately fail.
3. **One-and-done mastery.** Mastery is a single gate (`stage≥4 && ≥30 notes && ≥90%`, `store.ts:521`). Passing once = permanently unlocked. No reinforcement; rusty students keep their unlock for free.
4. **No micro-progression.** Note pools are fixed per level. There's no "earn the next note" loop, which is the single most motivating beat for young students (Note Rush's whole model).

---

## 1. Design pillars (pedagogy)

- **Recognition before recall.** *Name* (staff shown → pick the letter) is easier than *Find* (letter shown → place on staff). Earliest levels are **name-only**; Find is introduced later, on already-known notes; **Mix** (interleaving) is last and hardest.
- **One note at a time, mastery-gated.** Start with 2 notes; add the next only after demonstrated accuracy (mastery learning, ~85–90% threshold).
- **Adaptive difficulty / flow.** If a student slips, notes are *removed* until they're solid again, then re-added. Keeps them in the zone of proximal development — never drowning, never bored.
- **Reinforcement over time (spaced retrieval).** Mastery **decays** between sessions. Returning rusty → notes peel away → you re-prove. Passing once ≠ knowing it forever.
- **Confidence before stakes.** Super-beginner (name) levels are **no-fail practice** — the only way out is success. Stakes (lives) appear once reading is established.
- **Win conditions, visibly.** Mastering a level = **checkered flag → exit ramp → next landscape**. Every race can be *won*, not just survived.

---

## 2. Two independent layers (this is the key mental model)

The existing speed system stays. The ladder is **added on top**. They run side by side and never fight:

| Layer | Driven by | Effect | Status |
|---|---|---|---|
| **Race / Speed** | total correct this run (every `CORRECT_PER_STAGE`=8) | car speeds up, stages climb, tempo rises | **KEEP AS-IS** (with a per-band speed cap, §8) |
| **Note Ladder (Mastery Meter `M`)** | accuracy on the *current* pool | adds a note when proven, removes one when slipping; fills to the finish line | **NEW** |

A wrong answer slows the **ladder** (and, on non-beginner bands, costs a life). It never slows the speed layer — speed only ever responds to correct answers, exactly as today.

---

## 3. The Mastery Meter `M` (the core mechanic)

Each level has an **ordered ladder of notes** and a single integer meter `M` per (profile, level).

```
M starts each session near the student's saved progress (see §6 for decay).
On a correct answer:  M += 1
On a wrong answer:    M -= 2     (floored at 0)
```

### 3a. How `M` controls the active note pool

A level defines `ladder: string[]` (ordered) and `startCount` (initial pool size, default **2**).

```
STEP = 15                       // points to earn each new note (the #1 tunable, see §3d)
HYST = 5                        // hysteresis band so the pool doesn't flicker

activeCount(M):
  added = number of integers k ≥ 1 such that M ≥ k*STEP        // notes earned above the start pool
  // hysteresis: once a note is added at k*STEP, it isn't removed until M < k*STEP - HYST
  clamp(startCount + added, startCount, ladder.length)

activePool = ladder.slice(0, activeCount(M))
```

- **Promote:** when `M` crosses `k*STEP`, note `ladder[startCount-1 + k]` joins the pool. Fire a juicy "New note unlocked!" celebration.
- **Demote:** when `M` falls below `k*STEP - HYST`, that note leaves the pool. Quiet, no shame — just fewer notes.
- The HYST gap means a single miss right at a boundary can't add-then-remove-then-add a note.

### 3b. The finish line (mastery)

```
M_master = STEP * (ladder.length - startCount + 1)
```

Reaching `M_master` = the **full pool held one more STEP's worth** = level **mastered** →
checkered flag → car takes the exit ramp → next landscape/level unlocks.

For a 5-note ladder with `startCount=2`, `STEP=15`: `M_master = 15*(5-2+1) = 60`.
A flawless student masters in 60 notes; at ~85% accuracy, ~80–90 notes (a focused 3–5 min race). This naturally lands near the "~50 correct then exit" instinct from earlier discussion.

**`startCount` is tuned per level so every level masters in ~60–75 correct notes**, no
matter how many notes it ultimately contains. Beginner levels start at **2** and add one
note at a time (the slow, confidence-building ramp). Whole-staff and ledger levels would
otherwise have a huge `M_master` (a 9-note ladder from 2 → 120; an 18-note grand → 240), so
they **pre-load the staff the student already knows** via a larger `startCount` and ladder-in
only the last few stretch/ledger notes. A `curriculum.test.ts` test asserts every level's
`M_master` stays in 45–90, so future edits can't accidentally create a marathon level.

### 3c. A worked example (Treble L1, ladder `[C4,D4,E4,F4,G4]`, start=2, STEP=15)

| `M` range | Active pool | What's happening |
|---|---|---|
| 0–14 | C, D | the two starter notes |
| 15 | +E → C,D,E | earned E (≈15 net correct) |
| 30 | +F | earned F |
| 45 | +G → full hand | earned G |
| 60 | **MASTERED** | held the full C–G → 🏁 exit ramp → next landscape |
| (drop) | e.g. M slips to 10 | E removed → back to C,D until rebuilt |

### 3d. Tuning `STEP` (you said 10–12 is too little)

`STEP` = how many *net* points to earn one note. Higher = more reps = stronger reinforcement, longer race.

| `STEP` | Notes to master a 5-note level (flawless) | At ~85% accuracy (with −2 penalties) | Feel |
|---|---|---|---|
| 15 | 60 | ~80–90 | **recommended** — solid reinforcement, 3–5 min race |
| 20 | 80 | ~110–120 | heavier drill; longer races |
| 25 | 100 | ~140+ | very repetitive; risk of boredom returns |

**Default: `STEP = 15`**, exposed as one constant so it can be bumped per-band if you want early levels even drillier. (The promote target is a forgiving *net* meter, not a fragile 15-in-a-row: one slip costs 2, never a reset to zero.)

---

## 4. Mode progression: name → find → mix

Find is **used**, just never in the earliest levels. Mode is a per-level property and advances *within* each clef track:

```
Position 1 (name) → Position 2 (name) → revisit as Find → whole staff (Mix) → + ledgers (Mix)
       ▲ super-beginner, no-fail                 ▲ Find on already-known notes      ▲ hardest
```

- **name** — staff shown, pick the letter (recognition). All super-beginner levels.
- **find** — letter shown, place it on the staff (recall + spatial). Introduced only after a clef's notes are individually known, on the *same* note set.
- **mix** — alternates name/find per wave. Whole-staff & ledger levels only.

---

## 5. The curriculum (full track listing)

> **IMPLEMENTED (Phase 1).** The authoritative ladders, `startCount`s and modes now live in
> `src/data/notes.ts` (`NOTE_SETS`) and are validated by `src/data/curriculum.test.ts`. The
> tables below capture the *intent*; a few `startCount`s were raised from the original sketch
> (per §3b) so advanced levels don't become marathons — see the code for exact values.

Each level: `id`, display name, **mode**, **ladder** (ordered), `startCount`, `band`. `STEP`/`HYST` are global. Landscapes map 1:1 to levels in track order (§7).

### Treble track
| Tier | Name | Mode | Ladder (ordered) | start | Band |
|---|---|---|---|---|---|
| 1 | Middle C Steps | name | C4, D4, E4, F4, G4 | 2 | beginner (no-fail) |
| 2 | Treble G Position | name | G4, A4, B4, C5, D5 | 2 | beginner (no-fail) |
| 3 | Find: C Position | **find** | C4, D4, E4, F4, G4 | 2 | intermediate |
| 4 | Whole Treble Staff | mix | E4, G4, B4, D5, F5, F4, A4, C5, E5 | 2 | intermediate |
| 5 | Treble + Ledgers | mix | C4, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, A5, C6 | 3 | advanced |

(L4 ladder order = the five **line** notes EGBDF first, then the **space** notes FACE — landmark-then-fill, standard reading pedagogy.)

### Bass track
| Tier | Name | Mode | Ladder (ordered) | start | Band |
|---|---|---|---|---|---|
| 1 | Middle C Steps (Bass) | name | C4, B3, A3, G3, F3 | 2 | beginner (no-fail) |
| 2 | Bass C Position | name | C3, D3, E3, F3, G3 | 2 | beginner (no-fail) |
| 3 | Find: Bass C Position | **find** | C4, B3, A3, G3, F3 | 2 | intermediate |
| 4 | Whole Bass Staff | mix | G2, B2, D3, F3, A3, A2, C3, E3, G3 | 2 | intermediate |
| 5 | Bass + Ledgers | mix | C2, D2, E2, F2, G2, A2, B2, C3, D3, E3, F3, A3, C4 | 3 | advanced |

(L1 descends from Middle C = the left-hand C-position. L4 = lines GBDFA, then spaces ACEG.)

### Grand Staff track (integration — both hands)
| Tier | Name | Mode | Ladder (ordered) | start | Band |
|---|---|---|---|---|---|
| 1 | Grand Middle C | name | C4, B3, D4, A3, E4 | 2 | intermediate |
| 2 | Grand Positions | name | F3, G3, A3, B3, C4, D4, E4, F4, G4 | 2 | intermediate |
| 3 | Find: Grand | **find** | C4, B3, D4, A3, E4, G3, F4 | 2 | intermediate |
| 4 | Whole Grand Staff | mix | (treble E4–F5 ∪ bass G2–A3, landmark order) | 3 | advanced |
| 5 | Grand + Ledgers | mix | (grand range + ledgers both directions) | 3 | advanced |

Grand-staff notes draw on the correct clef via the existing `grandClefFor(name)` helper (`src/data/notes.ts:175`).

### Optional tracks (alto / tenor)
Keep them, hidden behind the existing `optional` flag (`CLEF_GROUPS`, `notes.ts:217`). Same name→find→mix shape; lower priority — implement after the three core tracks.

---

## 6. Persistence & reinforcement across sessions

Store the meter per level on the profile: `mastery: Record<levelId, number>` (clamped to `M_master`), plus `lastPlayed: Record<levelId, dateKey>`.

On (re)entering a level:
```
daysAway   = days between lastPlayed[levelId] and today (0 if same day / first time)
decay      = BASE_WARMUP + DECAY_PER_DAY * daysAway        // e.g. 8 + 4*days
M_start    = clamp(savedM - decay, 0, M_master)
```
- A student who **knows it** re-climbs the warm-up in under a minute.
- A **rusty** student watches notes peel away (auto-demotion) and re-earns them → built-in spaced reinforcement.
- A **mastered** level, replayed days later, starts below `M_master` and must be re-proven — "passing once doesn't mean they always know it." ✔ (the explicit ask)

`BASE_WARMUP = 8`, `DECAY_PER_DAY = 4`, both tunable. (Recommended default; this is the "warm-up one rung below peak" behavior, scaled by time away.)

**Unlock gating:** level N+1 unlocks the first time level N reaches `M_master`. Replaying never re-locks N+1.

---

## 7. Finish line → landscape transition

- Landscapes already exist: `DesertScene`, `CandyScene`, `SFScene`, `MountainScene` (`src/game/`). Map one landscape per level in track order (cycle/extend as needed; define a `levelId → scene` map).
- On `M` reaching `M_master` mid-race: set `screen` to a **finish** state → checkered-flag + exit-ramp animation → "Track Complete!" → award mastery bonus → roll into the next level's landscape (or back to menu with the next level highlighted).
- A race still ends early on lives=0 for stakes-bearing bands. Beginner (no-fail) bands can only end by mastering — the positive exit.

---

## 8. Lives & speed per band

Keep `CORRECT_PER_STAGE = 8`. Add a per-band cap so speed never outruns a beginner's reading.

| Band | Lives | Stage speed cap | Notes |
|---|---|---|---|
| beginner (name) | **no-fail** (lives off / ∞) | cap at stage 3 | wrong = `M−2` + streak reset, **no life lost**; can only exit by mastering |
| intermediate (find / whole staff) | 4 | cap at stage 5 | standard |
| advanced (mix / ledgers) | 3 (`START_LIVES`) | uncapped | full pressure |

Speed cap = clamp the `stage` used for `STAGE_SPEED`/tempo (not the score), so the pool keeps growing but the car stops accelerating past the cap.

---

## 9. Scoring / XP / gems (minimal changes)

- **Keep** the current per-note score formula (`store.ts:507–513`) — small base × speed × combo. It's already good.
- **XP = learning:** keep +1 XP per correct note; mastery bonus +50 stays, but now fires on `M_master` instead of the old gate.
- **Gems:** unchanged (`gemsForRun`).
- **Achievements/dailies:** unchanged except the "Master a level" tests now key off the new mastery event.

---

## 10. Code changes (for implementers)

**`src/data/notes.ts`**
- Extend `NoteSet` (or the level record): add `ladder: string[]` (ordered), `startCount: number`, keep `mode: 'name'|'find'|'mix'`, keep `band`/`group`/`tier`.
- Rewrite `NOTE_SETS` from the §5 tables. `notes` (full pool) = `ladder.map(makeNote)`; expose `ladder` separately for the meter.
- Add helpers: `activeCount(M, level)`, `activePool(M, level)`, `masterThreshold(level)`.

**`src/data/progression.ts`**
- Add `STEP`, `HYST`, `BASE_WARMUP`, `DECAY_PER_DAY` constants + the `activeCount`/`M_master` math (or co-locate in notes.ts). Single tunables block.

**`src/state/store.ts`**
- `Profile`: add `mastery: Record<string, number>` and `lastPlayed: Record<string, string>`; load/save them alongside `mastered`/`unlocked` (`store.ts:66–101`).
- Live run state: add `meterM: number` and derive `activePool`/`activeCount` for the spawner.
- `startGame`: set `meterM = M_start` (§6 decay), seed pool from it.
- `nextWave`: draw the target note from `activePool` (not the full `notes`); for beginner name levels force `noteMode='name'`; mode rules per §4 (`store.ts:296–299`).
- `answer` (correct, `store.ts:501`): `meterM += 1`; recompute `activeCount`; if it grew → unlock-note celebration; if `meterM ≥ M_master` and not yet mastered → trigger **finish line** (mastery event, +50 XP, unlock next, landscape transition) replacing the old gate at `store.ts:521`.
- `answer` (wrong, `store.ts:557`): `meterM = max(0, meterM-2)`; recompute pool (auto-demote); **skip life loss when band is no-fail**; only decrement lives / end game on stakes bands.
- Persist `mastery[levelId]` and `lastPlayed[levelId]` on `endGame` and on finish.

**`src/ui/`**
- HUD: add a **"notes unlocked / next note" progress bar** for `M` toward the next `k*STEP` (the motivating meter). Show current pool count "★ 3/5 notes."
- Finish-line / checkered-flag screen + exit-ramp transition into the next landscape.
- Menu: show per-level mastery (e.g., a 0–100% ring from `M / M_master`), and which notes are unlocked.

**`src/game/`**
- `levelId → Scene` map for the landscape-per-level mapping (§7).

---

## 11. Build phases (each = one agent task in the loop)

1. **Data model. ✅ DONE.** Added `src/data/ladder.ts` (tunables + pure meter math:
   `resolveActiveCount`/`activeCountAt`/`masterThreshold`/`isMastered`/`meterStart`/
   `ladderProgress`), extended `NoteSet` with `ladder`/`startCount` + helpers (`ladderOf`,
   `startCountOf`, `activeNotes`, `pickNoteFrom`, `lettersOfNotes`), rewrote `NOTE_SETS` per
   §5. Added **vitest** + `ladder.test.ts` (16) + `curriculum.test.ts` (9). `npm test` (25 ✅),
   `tsc -b` clean, `npm run build` clean. **Note:** levels now carry real per-level modes, so
   `treble-1` etc. are already `name`-only even before Phase 2 wires the meter.
2. **Meter in the store. ✅ DONE.** `meterM`/`activeCount` run state; `nextWave` draws from
   the active pool; promote (`resolveActiveCount`) on correct, demote on wrong; `WRONG_PENALTY`
   meter cost; mastery (`meterM ≥ M_master`) ends the race as a win (curriculum levels only —
   custom practice stays endless).
3. **Mode rules. ✅ DONE (folded into 1–2).** Levels carry real per-level modes; `nextWave`
   forces `name` on beginner (no-fail) levels; the random name/find coin-flip only applies to
   `mix` levels now, so early levels are never "find".
4. **Persistence + decay. ✅ DONE.** `Profile.mastery` + `Profile.lastPlayed` (load/save/cloud/
   migrate); `startGame` seeds `meterM` via `meterStart` (warm-up + per-day decay); meter saved
   as a peak on `endGame`; unlock-on-first-master gating.
5. **Finish line + landscape transition. ◑ PARTIAL.** Functional finish DONE: mastering ends the
   race as a win, `audio.fanfare()` (not crash), GameOver shows "🏁 Track Complete", next level
   unlocks. **DEFERRED:** the cinematic exit-ramp + auto landscape-per-level (`levelId→scene`) —
   needs a product decision, since today the player *chooses* the theme/landscape in the menu
   (auto-assigning per level would remove that choice). See §13.
6. **HUD + ladder meter. ✅ DONE.** Right-edge bar now fills toward the next note (gold near the
   finish), shows the live pool count `activeCount/total`, and pops a "🎵 New note unlocked!"
   toast on `unlockTick`. (Per-level mastery ring in the *menu* list — minor — not yet added.)
7. **Speed/lives caps per band. ✅ DONE.** `bandCaps()` → per-band starting lives (beginner 3
   no-fail, intermediate 4, advanced 3) + `stageCap` (3 / 5 / uncapped) applied to car speed
   (`Car.tsx`) and tempo; HUD hearts use the run's `startLives`.
8. **Optional tracks (alto/tenor). ✅ DONE (data).** Converted to the name→find→whole-staff
   ladder shape in `NOTE_SETS`; still gated behind the existing `showCClefs` flag.

Verification gate (all green after each phase): `npm run verify` = `tsc -b` + `vitest run` (25
tests) + `vite build` + self-contained headless `smoke` (boots to menu, plays a race, zero
runtime errors). The smoke's `hudChanged:false` is the known headless-SwiftShader slowness (the
car can't reach a gate in the sample window); the meter logic itself is covered by unit tests.

---

## 12. Tunables (one block, easy to dial)

| Constant | Default | Meaning |
|---|---|---|
| `STEP` | 15 | net points to earn each new note (you wanted >12) |
| `HYST` | 5 | hysteresis band before a note is removed |
| `startCount` | 2 | starting pool size per level |
| `CORRECT_PER_STAGE` | 8 | unchanged — speed bump cadence |
| `BASE_WARMUP` | 8 | meter decay applied on re-entry |
| `DECAY_PER_DAY` | 4 | extra decay per day since last play |
| wrong penalty | −2 | meter cost of a miss (demotion pressure) |

---

## 13. Open questions to confirm before/at Phase 1

1. **`STEP = 15` or `20`?** (15 ≈ 80–90 notes/level at ~85%; 20 ≈ 110–120.) You said 10–12 is too little — 15 is the recommendation, 20 if you want it drillier.
2. **Bass L1 direction** — descend from Middle C (C4→F3, left-hand C-position, as tabled) vs. ascend a bass C-position (C3→G3)? Tables assume descend-from-Middle-C for the landmark bridge.
3. **The "then adds C and D" note from chat** — confirmed as "the full C–G hand," not a lower octave? Tables assume full C–G.
4. **Find as separate levels (current plan) vs. a Find *mode toggle*** on the journey? Plan = separate levels (tier 3 of each track).
5. **No-fail for beginner band** — OK that super-beginner name levels can't "game over," only master? (Strongly recommended for young students.)
