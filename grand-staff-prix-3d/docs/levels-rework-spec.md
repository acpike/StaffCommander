# Grand Staff Prix — Levels System Rework (Spec v1 — LOCKED for build)

> **Status:** all open decisions resolved (§16, all ✓). **[DEFAULT]** values are starting
> balance numbers we'll tune by playtesting. Ready to build — §17 maps to agent assignments.

---

## 1. Why rework

The current catalog mixes two different things into one list — a **curriculum**
(which notes you're learning) and a **difficulty setting** (name vs find vs mix) —
so a brand-new learner sees a muddled menu instead of a guided path. The rework
splits them: one **Learning Mode** journey that gently grows note knowledge, plus
optional **Side Quests** for targeted practice and teacher assignment.

**The good news (already built in the engine — confirmed in code):**

| Capability | Where | Status |
|---|---|---|
| Name / Find / Mix gameplay | `data/notes.ts` `NoteMode = 'name' \| 'find' \| 'mix'` | ✅ done |
| Adaptive note ladder (ramps **up** on success) | `level().ladder` + `startCount` | ✅ done |
| Mastery + unlock gating | `store.ts` (`mastered`, `unlocked`, stage logic) | ✅ done |
| Speed/tempo by stage, capped per band | `store.ts` `stage`, `stageCap`, `BASE_SPEED + (stage-1)*STAGE_SPEED` | ✅ done |
| Per-level best score + return decay | `Profile.best`, last-played date decay | ✅ done |

So this is mostly **re-authoring the catalog + adding placement + a journey UI +
a few engine tweaks**, not a gameplay rebuild.

---

## 2. Core model — two independent dials

1. **Knowledge (the note ladder)** — *which* notes are in play. **Persistent**,
   accumulates across the whole journey, never resets.
2. **Tempo (speed)** — *how fast* notes arrive. A **per-run warm-up ramp** with a
   smart floor/ceiling, and it **eases off when you miss**.

And keep **two scores separate**:
- **Mastery** (do you advance?) → gated on **accuracy**, never on points.
- **Points** (the competitive / leaderboard / feel-good layer) → speed- & streak-boosted.

---

## 3. Learning Mode — the main journey

### 3.1 Regions (note ranges)

**Confirmed: cumulative/nested.** Notes are only ever **added** — each region = all the
previous notes **+ a few new ones** (some a little higher, some a little lower). The range
labels below are Aaron's; what matters is the *additive* note list. A new region's ladder
*starts where the last ended*, so known notes are never re-ground.

| # | Region | Range (Aaron's) | New notes added (~) |
|---|---|---|---|
| 1 | Middle C | A3–E4 | A3 B3 C4 D4 E4 (start) |
| 2 | Treble | F3–G5 | up: F4 G4 A4 B4 C5 D5 E5 F5 G5 · down: F3 G3 |
| 3 | + Bass reach | C3–C5 | down: C3 D3 E3 |
| 4 | Wider | G2–F5 | down: G2 A2 B2 |
| 5 | ±1 Ledger | C2–C6 | down: C2 … · up: A5 B5 C6 |
| 6 | ±2 Ledger | A1–E6 | down: A1 B1 … · up: D6 E6 |
| 7 | Full (±3 Ledger) | F1–G6 | down: F1 G1 · up: F6 G6 |

> **Exact per-region note lists are a Phase-A deliverable** (we'll lock the precise
> notes-added when authoring the data). The structure — *cumulative, a few each
> direction, never removed* — is confirmed. The "truly test the new notes" problem this
> raises is solved in **§4.2**.

### 3.2 The three modes per region

Within each region you make three passes (engine already supports all three):

1. **Name** — staff shown → steer to the gate with the matching **letter**.
2. **Find** — letter shown → steer to the gate with the matching **note on the staff**.
3. **Mix** — each wave randomly Name or Find.

Find and Mix are **full passes** (not shortened) — same length as a learning stage. They
reuse the region's notes but the skill is harder, and the **base speed steps up each mode**
(see §5), so every pass is a real, escalating challenge — the game shouldn't be easy to beat.

### 3.3 Stage structure

Learning Mode ≈ **7 regions × 3 modes = 21 stages**, each gated by mastery, in a
single linear chain: `R1-Name → R1-Find → R1-Mix → R2-Name → …`.

---

## 4. Adaptive note ladder

### 4.1 Two-way ladder
Today the ladder only ramps **up** (add a note as you succeed). Add a **ramp-down**:

- **Up:** introduce the next note after **[DEFAULT] ~3 consecutive corrects** on the
  current frontier note.
- **Down (NEW):** on repeated misses, **shrink the active pool**, isolate the
  troublesome note (drill it at higher frequency), then re-introduce. Invisible and
  automatic — the level self-tunes to the kid in the moment.

### 4.2 New-note emphasis + per-note mastery  ← THE dilution fix

> Aaron's concern: if a region only adds a few notes to a big pool, will the new notes
> show up enough to truly test them? **Right instinct — and today they wouldn't.**
> `pickNoteFrom` picks **uniformly** from the active pool, and mastery is an overall
> meter, **not per-note**. So a freshly-added note appears only ~1/N of the time and a
> kid could clear a stage on notes they *already* knew.

Two fixes (both NEW, both small):

- **Frontier weighting** — make `pickNoteFrom` a **weighted** pick that heavily favors the
  **newest note(s)** (**[DEFAULT] 3–4×** the weight of established notes) until they're
  proven, then they settle into the normal mix. Each region's stage is thus *mostly its
  new notes*, with older ones sprinkled in as **light review/retention**.
- **Per-note mastery** — track **correct/seen per note**, and gate stage mastery on
  **each note** (especially the new ones) clearing its own bar — not just an overall %.
  You can't coast past the new material on the old.

---

## 5. Speed / tempo model

**Keep the per-run warm-up ramp** (cold reading is genuinely slower; the build-up is
satisfying). Fix "re-grinding the slow part" by raising where the ramp *starts and tops out*:

- **Very slow start (keep it):** Region 1 · Name — the *beginner milestone, beginner mode* —
  starts **as slow as it does today**: the gentle on-ramp for brand-new readers.
- **Base speed steps UP each mode:** Name → Find → Mix each **bumps the base/floor speed a
  notch**, so every pass is more challenging (not easier just because the notes are known).
- **Ceiling** scales with region/mode (via `stageCap`) — late-game "slow" is faster than
  early-game "fast," so the game never gets easy to beat.
- **Floor / comfort tempo (NEW):** persist a **comfort tempo per stage**; on return start
  the ramp a few notches **below** it (a ~**[DEFAULT] 5-note warm-up**), not from scratch.
- **Ease-on-miss (NEW):** tie tempo to a **rolling accuracy/streak** so it *backs off when
  missing* and *surges when confident* — never accelerate into failure.

---

## 6. Scoring (points) — separate from mastery

Points scale with mode difficulty — **harder mode pays more per correct AND costs more per
wrong** (Aaron's call):

| Mode | Correct | Wrong | Fast / accelerated correct |
|---|---|---|---|
| **Name** (Beginner) | **+2** | **0** | speed×combo on top (≈ up to +4) |
| **Find** (Intermediate) | **+3** | **−1** | … (≈ up to +6) |
| **Mix** (Advanced) | **+4** | **−2** | … (≈ up to +8) |

- "Fast / accelerated" applies the existing **speed×combo** multiplier on top — confident
  speed pays, and it stacks with the mode tier.
- A wrong answer hurts **points**, never the **mastery floor** — a bad run can't cost a stage.
- Beginner keeps a **0** wrong-penalty (never punish a kid first-learning a note); the
  penalty grows with the tier. Numbers (2/3/4 · 0/−1/−2) are starting values — tune by testing.

---

## 7. Mastery & advancement

- **Advance a note:** ~3 consecutive corrects on the frontier note (§4).
- **Master a stage:** **every active note** at **[DEFAULT] ≥90%** over a rolling window
  (per-note, §4.2 — not just an overall average), with the new notes weighted to appear
  enough to actually prove them.
- Mastering a stage unlocks the next stage in the chain.

---

## 8. Return & struggle handling

- **Mastery is sticky** — a cleared stage stays cleared; never auto-demote a whole stage.
- **Rust warm-up** — reuse the existing return-decay so a stage starts a notch easier
  after a gap (gentle on-ramp, not a slam).
- Struggle is absorbed *inside* the stage by the two-way ladder (§4) + ease-on-miss tempo (§5).

---

## 9. Placement test (part of the adaptive build)

On a **new profile**:

1. Show the **milestone ladder** — the 7 regions with their ranges, each with a small
   **staff preview** so kids recognize the range.
2. Student taps the region they think they know.
3. Run a **placement run** at that region in **Name mode ✓ confirmed** — Name *is* the
   Beginner pass of each region, so the placement run looks exactly like the stage they'd
   play (and counts as their Beginner/Name pass if they hit the bar) — over
   **[DEFAULT] ~15–20 notes**.
4. **Pass (≥[DEFAULT] 85%)** → mark all regions *below* as earned/mastered, and drop them
   in at that region's **Find** mode (the placement *was* their Name pass — don't re-prove it).
5. **Miss** → **re-test downward ✓ confirmed** — step down one region and run the placement
   again; keep stepping down until they pass, then place there. Finds their true level
   instead of guessing.
6. **Edges:** bottom region → no test, just start. "I'm new" always available.

Bias **conservative** — under-placing is cheap (laps fly by); over-placing strands a kid.

---

## 10. Side Quests

The current position levels (**C position, G position, custom-built levels**) move OFF
the main spine into a **Side Quests** section:
- Optional, replayable, great for targeted drilling.
- **Teacher-assignable** (see §11).
- The existing **Create-a-Level** flow feeds custom side quests.

---

## 11. Teacher / class assignment — DEFERRED (out of scope)

Not in this rework. Teacher-assigns-a-starting-region waits until the **companion teacher
app** (where teachers track all their students) exists — revisit then. Placement (§9)
already gets advanced students to the right spot without a teacher.

---

## 12. Leaderboard & records integration

The leaderboard we just shipped re-keys cleanly:
- **Class Standings** (total XP) — unchanged.
- **Per-level "track record"** — now keyed on the new **stage ids** (region+mode).
  Each Learning-Mode stage and each Side Quest can carry a class record.

---

## 13. Reuse vs. new (build surface)

- ✅ **Reuse:** Name/Find/Mix gameplay, the ramp-**up** ladder, mastery/unlock gating,
  per-level best, return decay, the run/accuracy loop, scoring engine (speed×combo).
- 🔨 **New/changed:**
  1. Re-author `NOTE_SETS` into the 21-stage Learning-Mode chain + tag Side Quests.
  2. Ladder ramp-**down** + **frontier weighting & per-note mastery** (§4) — `pickNoteFrom`
     becomes weighted; add per-note correct/seen tracking.
  3. Tempo: persist comfort-tempo + ease-on-miss (§5).
  4. Scoring tweak (§6).
  5. Placement flow (§9).
  6. Menu UI: Journey screen (replaces the timing-tower list for Learning Mode) +
     Side Quests section.

---

## 14. Data model changes (sketch)

- `NOTE_SETS` → a structured **regions[]** (range, notes, adds) the chain is generated from.
- New stage id scheme, e.g. `r{n}-name | r{n}-find | r{n}-mix`, plus `sq-*` for side quests.
- `Profile` additions: `comfortTempo: Record<stageId, number>`, and a `placed`/`startStage`
  marker. (`mastered`/`unlocked` keep working, re-keyed.)
- Migration: existing profiles map old level ids → nearest new stage; default unmigrated → Region 1.

---

## 15. UI changes

- **Journey screen** (Learning Mode): a vertical/path layout of the 21 stages showing
  mastered / current / locked, with the active stage front-and-center. Replaces the
  timing-tower list *for Learning Mode* (HUD style retained).
- **Side Quests** section: position levels + custom levels + Create-a-Level.
- **Placement screen** (§9): the milestone ladder picker with staff previews.
- Per-stage **track record** line stays (§12).

---

## 16. Open decisions to confirm (consolidated)

1. ~~Regions~~ — ✓ **cumulative/nested, Aaron's ranges** (exact per-region note lists finalized in Phase A, §3.1).
2. ~~Placement test mode~~ — ✓ **Name mode** (= the Beginner pass of each region).
3. ~~Placement miss~~ — ✓ **re-test downward** (step down & re-test until they pass).
4. **Scoring** — per-mode tiers: **2/3/4** correct · **0/−1/−2** wrong (§6) — confirm exact numbers.
5. ~~Mastery threshold~~ — ✓ **defaults (90% · 3 corrects · 3–4× weight)**, tune by testing.
6. ~~Teacher assignment~~ — ✓ **deferred** until the companion teacher app (§11).
7. ~~Find/Mix length~~ — ✓ **full passes**, with base speed stepping up each mode (§5).

**All decisions resolved — spec is v1, ready to build.**

---

## 17. Build phases → agent assignments

> Phased so a working game is never broken; each phase is verifiable on its own.

- **Phase A — Curriculum data** *(1 agent)*: author the regions[] + generate the 21-stage
  chain in `data/notes.ts`; tag Side Quests; keep old ids working via migration. No UI yet.
- **Phase B — Engine rules** *(1 agent)*: two-way ladder, comfort-tempo persistence +
  ease-on-miss, scoring tweak, re-pointed mastery gate. Behind the existing UI.
- **Phase C — Placement** *(1 agent)*: new-profile placement flow + screen, "earned below,
  drop in at Find" logic.
- **Phase D — Journey + Side Quests UI** *(1 agent)*: the Learning-Mode journey screen and
  Side Quests section in the HUD menu; wire records.
- **Phase E — Polish/QA** *(1 agent, adversarial)*: migration of real profiles, balance pass
  on thresholds/tempo, edge cases.

Each phase = one agent brief; B depends on A, C/D depend on A+B, E last.

---

*End of v0.1. Red-line away — strike/replace anything, and we'll lock v1 before assigning agents.*

---

## Phase A — final note breakdown (DATA shipped)

Curriculum authored in `src/data/notes.ts` (`REGIONS`, `JOURNEY_STAGES`) + migration in
`src/data/migrate.ts`. Cumulative grand-staff, middle C outward to F1–G6 by Region 7.

### Per-region notes

| # | Region | Range | New this region | Pool | Pre-load (`startCount`) | Ladders in (frontier) | Mastery¹ |
|---|---|---|---|---|---|---|---|
| 1 | Middle C | A3–E4 | A3 B3 C4 D4 E4 *(start)* | 5 | 2 | E4 B3 A3 | 60 |
| 2 | Treble | F3–G5 | F3 G3 F4 G4 A4 B4 C5 D5 E5 F5 G5 | 16 | 11 | C5 D5 E5 F5 G5 | 90 |
| 3 | Bass Reach | C3–C5 | C3 D3 E3 | 19 | 16 | E3 D3 C3 | 60 |
| 4 | Wider Range | G2–F5 | G2 A2 B2 | 22 | 19 | B2 A2 G2 | 60 |
| 5 | ±1 Ledger | C2–C6 | C2 D2 E2 F2 · A5 B5 C6 | 29 | 24 | E2 D2 C2 B5 C6 | 90 |
| 6 | ±2 Ledger | A1–E6 | A1 B1 · D6 E6 | 33 | 29 | B1 A1 D6 E6 | 75 |
| 7 | Full Staff | F1–G6 | F1 G1 · F6 G6 | 37 | 33 | G1 F1 F6 G6 | 75 |

¹ Mastery threshold = `15·(pool − startCount + 1)` correct notes; the `curriculum.test.ts`
invariant keeps it in 45–90, i.e. **2–5 notes laddered per stage**.

> **Judgment call:** the spec's literal "ladder in *all* new notes, `startCount` = carried
> count" would make Region 2 ladder 11 notes (threshold 180) and Region 5 ladder 7 — far past
> the 45–90 consistency bound the engine + tests rely on. So the two big-block regions
> **pre-load their inner new notes and ladder in only the outer ~5 frontier notes** (Region 2
> pre-loads F3 G3 F4 G4 A4 B4, Region 5 pre-loads F2 A5). The pre-loaded new notes are still
> live in the active pool from note one; Phase B's frontier weighting (§4.2) is what makes them
> get *emphasized*. All other regions follow the spec literally (carried = `startCount`).

### Stage chain (21 = 7 × 3)

`group: 'journey'`, `kind: 'learning'`, ids `r{n}-name|find|mix`, **tiers 1…21** in a single
linear chain (each unlocks the next via the existing `nextLevel` group+tier walk):

```
r1-name → r1-find → r1-mix → r2-name → … → r7-mix
 tier 1     2          3        4              21
```

Modes map onto the existing band machinery so base speed/lives step up each pass with **no
engine change**: Name → `beginner` (no-fail, slow), Find → `intermediate`, Mix → `advanced`.

### Side Quests (§10)

The old position levels are kept (not deleted), tagged `kind: 'sidequest'`, ids namespaced
`sq-<clef>-<tier>` (treble/bass/grand/alto/tenor tracks). Custom levels (`customSet`) are also
tagged `kind: 'sidequest'`. Phase D filters the menu on `kind`.

### Migration (`src/data/migrate.ts`, wired in `store.ts` at load)

Old profile ids re-key onto the nearest journey stage (non-destructive, idempotent):

| Old | → New | Old | → New | Old | → New |
|---|---|---|---|---|---|
| treble-1 | r1-name | bass-1 | r1-name | grand-1 | r1-name |
| treble-2 | r2-name | bass-2 | r3-name | grand-2 | r3-name |
| treble-3 | r2-find | bass-3 | r3-find | grand-3 | r3-find |
| treble-4 | r2-mix | bass-4 | r4-mix | grand-4 | r4-mix |
| treble-5 | r5-mix | bass-5 | r5-mix | grand-5 | r5-mix |
| alto-1/2/3 | r1-name/find/mix | tenor-1/2/3 | r1-name/find/mix | *(unmapped)* | r1-name |

Custom (`cl-*`) ids pass through unchanged. Applied to `best`/`unlocked`/`mastered`/`mastery`/
`lastPlayed` and the saved `settings.levelId`.
