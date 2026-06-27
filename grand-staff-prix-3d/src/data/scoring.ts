// ──────────────────────────────────────────────────────────────────────────
// Points scoring — per-mode tiers (Levels Rework §6). Harder modes pay more per
// correct AND cost more per wrong. POINTS are entirely separate from MASTERY: a
// wrong answer hurts the score but can never lower the mastery/meter floor or
// cost an earned stage (the store enforces that — mastery is sticky).
//
// The existing speed×combo multiplier stacks ON TOP of the mode tier, so going
// fast on a confident streak in Mix is the biggest payout. Pure + tested.
// ──────────────────────────────────────────────────────────────────────────

import type { NoteMode } from './notes'

// ── Tunables ────────────────────────────────────────────────────────────────
/** Base points for a correct answer, by mode tier. Name=Beginner … Mix=Advanced.
 *  speed×combo multiplies these (so a fast Mix streak is the top score). (§6) */
export const MODE_CORRECT_POINTS: Record<NoteMode, number> = { name: 2, find: 3, mix: 4 }
/** Points DEDUCTED for a wrong answer, by mode tier. Beginner never punishes a
 *  first-learning kid (0); the penalty grows with the tier. (§6) */
export const MODE_WRONG_POINTS: Record<NoteMode, number> = { name: 0, find: 1, mix: 2 }

/** Points awarded for a correct answer: mode tier × speed × combo (rounded). */
export function correctPoints(mode: NoteMode, speedMult: number, comboMult: number): number {
  return Math.round(MODE_CORRECT_POINTS[mode] * speedMult * comboMult)
}

/** Points deducted for a wrong answer: a flat per-mode penalty (no multiplier). */
export function wrongPenaltyPoints(mode: NoteMode): number {
  return MODE_WRONG_POINTS[mode]
}
