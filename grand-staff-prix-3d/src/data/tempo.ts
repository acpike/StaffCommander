// ──────────────────────────────────────────────────────────────────────────
// Tempo / speed model (Levels Rework §5). Tempo is a CONTINUOUS "stage level"
// (≥1) that the car speed + music tempo read in place of the integer stage. It:
//
//  • starts as slow as the legacy stage-1 ramp for Region 1 · Name (no faster
//    on-ramp for brand-new readers),
//  • steps its FLOOR up each mode (Name→Find→Mix) so every pass is harder even on
//    known notes,
//  • starts a few notches BELOW the persisted comfort tempo on return (a short
//    warm-up, not from scratch),
//  • EASES OFF on a miss and SURGES on a confident streak — never accelerates
//    into failure.
//
// Tempo is measured in the same unit as the old integer `stage` (the car adds
// STAGE_SPEED per unit), so tempo 1 == legacy stage 1. Pure + tested.
// ──────────────────────────────────────────────────────────────────────────

import type { NoteMode } from './notes'

// ── Tunables ────────────────────────────────────────────────────────────────
/** Absolute slowest tempo — Region 1 · Name starts here, as slow as today. */
export const TEMPO_MIN = 1
/** Per-mode floor bump: each pass starts faster than the last. Name keeps the
 *  gentle beginner on-ramp (0); Find/Mix step up. (spec §5) */
export const MODE_SPEED_FLOOR: Record<NoteMode, number> = { name: 0, find: 1, mix: 2 }
/** Tempo gained per correct answer — ≈ +1 stage per 8 corrects, matching the
 *  legacy warm-up ramp so the build-up feels the same. */
export const TEMPO_RAMP_PER_CORRECT = 0.125
/** Streak at/above which the student is "confident" and the tempo SURGES. */
export const TEMPO_SURGE_STREAK = 5
/** Extra tempo per correct while surging (doubles the ramp on a hot streak). */
export const TEMPO_SURGE_BONUS = 0.125
/** Tempo shed on a miss — eases off so we never accelerate into failure. (§5) */
export const EASE_MISS_DROP = 0.5
/** How far below the persisted comfort tempo the ramp restarts on return — a
 *  short (~5-note) warm-up, not a cold start. (spec §5) */
export const COMFORT_WARMUP_STAGES = 0.6

/** The slowest tempo a given mode can ease down to (its floor). */
export function tempoFloor(mode: NoteMode): number {
  return TEMPO_MIN + MODE_SPEED_FLOOR[mode]
}

/** Tempo to begin a run at: the mode floor, or a short warm-up below the saved
 *  comfort tempo if one exists (never below the floor). */
export function initialTempo(mode: NoteMode, comfort: number | undefined): number {
  const floor = tempoFloor(mode)
  if (!comfort || comfort <= 0) return floor
  return Math.max(floor, comfort - COMFORT_WARMUP_STAGES)
}

/** Tempo after a correct answer — ramps up (faster while confident), capped. */
export function tempoOnCorrect(tempo: number, streak: number, cap: number): number {
  const up = TEMPO_RAMP_PER_CORRECT + (streak >= TEMPO_SURGE_STREAK ? TEMPO_SURGE_BONUS : 0)
  return Math.min(cap, tempo + up)
}

/** Tempo after a miss — eases off toward (but never below) the mode floor. */
export function tempoOnMiss(tempo: number, mode: NoteMode): number {
  return Math.max(tempoFloor(mode), tempo - EASE_MISS_DROP)
}

/** New comfort tempo to persist: the highest tempo sustained this run ratchets up. */
export function updateComfort(saved: number | undefined, peak: number): number {
  return Math.max(saved ?? 0, peak)
}
