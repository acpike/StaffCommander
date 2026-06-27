// ──────────────────────────────────────────────────────────────────────────
// Per-note tracking, frontier weighting & per-note mastery (Levels Rework §4.2 /
// §7). This is the "dilution fix": a freshly-added note must show up enough to be
// truly tested, and a stage can only be mastered when EVERY new note clears its
// own bar — not just an overall average.
//
// All functions here are PURE (the RNG is injected) so the behaviour is unit-
// testable in isolation (see pernote.test.ts). The store owns the live PerNote
// map for the current run/stage and threads it through.
// ──────────────────────────────────────────────────────────────────────────

import type { GameNote } from './notes'

// ── Tunables ────────────────────────────────────────────────────────────────
/** A frontier (new/unproven) note is drawn at this multiple of an established
 *  note's weight, so each region's stage is mostly its NEW notes with the old
 *  ones sprinkled in as light review. (spec §4.2 "3–4×") */
export const FRONTIER_WEIGHT = 3.5
/** Consecutive corrects on a frontier note that "prove" it: it then relaxes from
 *  the boosted weight back into the normal mix. (spec §4.1/§7 "~3 corrects") */
export const ADVANCE_STREAK = 3
/** Per-note rolling-window accuracy a note must hold to count as mastered. (§7) */
export const MASTERY_BAR = 0.9
/** How many recent reps the per-note accuracy is measured over (the rolling window). */
export const MASTERY_WINDOW = 10
/** A note needs at least this many reps before its accuracy can gate mastery —
 *  stops a barely-seen note from passing (or blocking) on a tiny sample. */
export const MASTERY_MIN_SAMPLES = 3

/** Running record for a single note within a run/stage. */
export interface NoteStat {
  /** Times this note has been shown. */
  seen: number
  /** Times answered correctly. */
  correct: number
  /** Current consecutive-correct streak (resets to 0 on a miss). */
  streak: number
  /** Last MASTERY_WINDOW results (true = correct), oldest first — the rolling window. */
  window: boolean[]
}

/** Per-note stats keyed by note name ("C4", "G2"). */
export type PerNote = Record<string, NoteStat>

/** Stable key for a note (clef-independent — same pitch shares one record). */
export function noteKey(n: GameNote): string {
  return `${n.letter}${n.octave}`
}

const EMPTY: NoteStat = { seen: 0, correct: 0, streak: 0, window: [] }

/** Immutably fold one answer into the per-note map. */
export function recordAnswer(stats: PerNote, key: string, correct: boolean): PerNote {
  const prev = stats[key] ?? EMPTY
  const window = [...prev.window, correct]
  if (window.length > MASTERY_WINDOW) window.shift()
  return {
    ...stats,
    [key]: {
      seen: prev.seen + 1,
      correct: prev.correct + (correct ? 1 : 0),
      streak: correct ? prev.streak + 1 : 0,
      window,
    },
  }
}

/** Rolling-window accuracy for a note (0 if never seen). */
export function rollingAccuracy(stat: NoteStat | undefined): number {
  if (!stat || stat.window.length === 0) return 0
  const hits = stat.window.reduce((n, ok) => n + (ok ? 1 : 0), 0)
  return hits / stat.window.length
}

/** A frontier note is "proven" (no longer needs the weight boost) once the
 *  student strings together ADVANCE_STREAK consecutive corrects on it. */
export function isProven(stat: NoteStat | undefined): boolean {
  return (stat?.streak ?? 0) >= ADVANCE_STREAK
}

/** The pick weight for one note: boosted while it is an unproven frontier note. */
export function noteWeight(name: string, frontier: Set<string>, stats: PerNote): number {
  if (frontier.has(name) && !isProven(stats[name])) return FRONTIER_WEIGHT
  return 1
}

/**
 * Weighted pick from the active pool that favours unproven frontier notes
 * (spec §4.2). `rand01` returns [0,1); injected so tests are deterministic.
 */
export function pickWeighted(
  pool: GameNote[],
  frontier: Set<string>,
  stats: PerNote,
  rand01: () => number = Math.random,
): GameNote {
  if (pool.length === 0) throw new Error('pickWeighted: empty pool')
  const weights = pool.map((n) => noteWeight(noteKey(n), frontier, stats))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand01() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r < 0) return pool[i]
  }
  return pool[pool.length - 1]
}

/**
 * Per-note mastery gate (spec §4.2/§7): a stage is only mastered when every
 * FRONTIER note that is in the active pool has cleared its own bar — ≥MASTERY_BAR
 * over the rolling window, with at least MASTERY_MIN_SAMPLES reps. You can't coast
 * past the new material on the old. Stages with no frontier notes (e.g. custom
 * practice) gate on the meter alone.
 */
export function stageMasteryGate(frontier: string[], activePool: GameNote[], stats: PerNote): boolean {
  if (frontier.length === 0) return true
  const active = new Set(activePool.map(noteKey))
  for (const name of frontier) {
    if (!active.has(name)) continue // not yet laddered in — can't be required yet
    const stat = stats[name]
    if (!stat || stat.window.length < MASTERY_MIN_SAMPLES) return false
    if (rollingAccuracy(stat) < MASTERY_BAR) return false
  }
  return true
}
