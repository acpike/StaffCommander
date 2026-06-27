# Levels Rework — Overnight Build Handoff

> Read this first when you wake up. Everything is on branch **`levels-rework`**, **nothing is
> deployed to live `main`**. The live game your students play is untouched. You review here,
> then decide what/when to ship.

## Status (updated as phases land)

| Phase | What | State | Commit |
|---|---|---|---|
| A | Curriculum data (7 regions / 21 stages + migration) | ✅ done | `5b0f8c4` |
| B | Engine rules (frontier weighting, per-note mastery, tempo, scoring) | ✅ done | `1fc7e4f` |
| B-verify | Independent adversarial review of B | ✅ done — **no blockers** | — |
| B-tests | Store run-loop integration tests (closes review finding M1) | 🔄 in progress | — |
| C | Placement flow + screen | ⏭ next | — |
| D | Journey + Side-Quest menu UI | ⏭ next (parallel w/ C) | — |
| E | Adversarial QA / balance / migration | ⏭ last | — |

Baseline: build clean, **52 tests** green at Phase B.

---

## ⚠️ Needs YOUR call (not bugs — design/balance the adversarial review flagged)

These are honest "I shouldn't decide this for you" items. None block the build; all are easy to change (labeled constants).

- **M3 — beginner runs can be hard to *finish*.** A beginner (Name) stage is no-fail and only ends when you *master* it (every new note ≥90% rolling). A 6-year-old who can't get one note to 90% could be stuck racing until they quit manually. **Decide:** keep "play till mastered," OR add a graceful "good run — come back" exit (e.g., end after N notes / a time cap) for no-fail stages. *I did NOT change this — it's a design choice.*
- **M2 — mastery is single-session.** Per-note proof resets each run (the overall meter persists). To master a stage you must reach the meter cap *and* hold ≥90% on every new note **in one sitting**. Fine for older kids; maybe long for little ones. Tune `MASTERY_BAR` / window, or persist per-note proof, if you want.
- **M4 — when the next note appears.** Spec said "~3 corrects on the frontier note." Implemented: the next note laddered in on the cumulative meter (inherited engine), with frontier weighting making the new note the most-drilled and the per-note gate guaranteeing it's proven before mastery. Educational outcome is preserved; just confirm you're OK with meter-driven introduction.
- **N1 — points ceiling.** Live max per correct (~25 with full speed×combo) is bigger than the spec table's "≈+4" illustration. Spec said reuse speed×combo + tune later, so it's defensible — just a balance dial.
- **N2 — surge vs gentle start.** Region 1·Name *start* is byte-identical to today, but a 5+ streak makes it ramp a touch faster than legacy. Low impact (new readers rarely streak 5).

---

## Tunable knobs (labeled constants — feel-tune in minutes)

**`src/data/pernote.ts`** — `FRONTIER_WEIGHT=3.5` (new-note pick boost) · `ADVANCE_STREAK=3` (corrects to "prove" a note) · `MASTERY_BAR=0.9` · `MASTERY_WINDOW=10` · `MASTERY_MIN_SAMPLES=3`
**`src/data/scoring.ts`** — `MODE_CORRECT_POINTS={name:2,find:3,mix:4}` · `MODE_WRONG_POINTS={name:0,find:1,mix:2}`
**`src/data/tempo.ts`** — `TEMPO_MIN=1` · `MODE_SPEED_FLOOR={name:0,find:1,mix:2}` · `TEMPO_RAMP_PER_CORRECT=0.125` · `TEMPO_SURGE_STREAK=5` · `TEMPO_SURGE_BONUS=0.125` · `EASE_MISS_DROP=0.5` · `COMFORT_WARMUP_STAGES=0.6`
**`src/data/ladder.ts`** — `RAMP_DOWN_WINDOW=6` · `RAMP_DOWN_MISS_RATE=0.5` · `RAMP_DOWN_DROP=15`

---

## The 7-region curriculum (what got built)

| # | Region | Range | New notes | Pool |
|---|---|---|---|---|
| 1 | Middle C | A3–E4 | A3 B3 C4 D4 E4 | 5 |
| 2 | Treble | F3–G4 | F3 G3 F4 G4 | 9 |
| 3 | Both Hands | C3–C5 | C3 D3 E3 · A4 B4 C5 | 15 |
| 4 | Wider Range | G2–F5 | G2 A2 B2 · D5 E5 F5 | 21 |
| 5 | ±1 Ledger | C2–C6 | C2 D2 E2 F2 · G5 A5 B5 C6 | 29 |
| 6 | ±2 Ledger | A1–E6 | A1 B1 · D6 E6 | 33 |
| 7 | Full Staff | F1–G6 | F1 G1 · F6 G6 | 37 |

Each region × Name/Find/Mix = 21 stages. Old position levels kept as **Side Quests**; old profiles migrated.

---

## Test-this-yourself checklist (fill in after D lands)
- [ ] New profile → placement flow picks a region, drops you in correctly
- [ ] Journey screen shows 21 stages, mastered/current/locked, HUD style
- [ ] Side Quests section shows the old position/custom levels
- [ ] Play R1·Name: starts slow, new notes appear often, masters only when each note is solid
- [ ] Existing profile still works (migrated, didn't lose progress)
- [ ] Speed *feels* right; scoring *feels* right (tune the knobs above)

*(Spec of record: `docs/levels-rework-spec.md`. Per-phase detail in git log on `levels-rework`.)*
