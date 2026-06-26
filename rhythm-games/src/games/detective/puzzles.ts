// RHYTHM DETECTIVE — puzzle generators for the three mechanics.
//
// All three return self-contained, verifiable puzzles built from shared
// patterns. We lean on `comparePatterns` to GUARANTEE the relationships we need
// (e.g. exactly-one-beat-changed for spot, matching/odd suspects for lineup).

import {
  CELL_TIERS,
  CELLS,
  comparePatterns,
  generatePattern,
  onsetCount,
  pattern,
  type BeatCell,
  type Pattern,
} from '../../shared/audio/patterns'
import type { LevelDef } from './levels'

// ── small RNG helpers ────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function tierCells(tierIdx: number): BeatCell[] {
  return CELL_TIERS[Math.max(0, Math.min(CELL_TIERS.length - 1, tierIdx))]
}

/** Generate a base pattern that has at least 2 sounding onsets (so it's audible). */
function makeBase(level: LevelDef): Pattern {
  const cells = tierCells(level.tier)
  for (let attempt = 0; attempt < 40; attempt++) {
    const p = generatePattern(cells, { bars: level.bars, beatsPerBar: 4, beatUnit: 4 })
    if (onsetCount(p) >= 2) return p
  }
  return generatePattern(cells, { bars: level.bars, beatsPerBar: 4, beatUnit: 4 })
}

/**
 * Replace exactly one beat-cell of `base` with a different cell of the same beat
 * length, producing a variant whose RHYTHM differs from base. Returns the
 * variant and the index of the changed cell, or null if no swap was possible.
 */
function swapOneCell(base: Pattern, tierIdx: number): { variant: Pattern; cellIndex: number } | null {
  const palette = tierCells(tierIdx)
  const order = base.cells.map((_, i) => i)
  // shuffle the candidate cell indices so the changed beat isn't predictable
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (const idx of order) {
    const original = base.cells[idx]
    const replacements = palette.filter((c) => c.beats === original.beats && c.id !== original.id)
    if (replacements.length === 0) continue
    const repl = pick(replacements)
    const cells = base.cells.slice()
    cells[idx] = repl
    const variant = pattern(cells, base.beatsPerBar, base.beatUnit)
    // confirm the rhythm actually differs (rest<->note swaps of equal length can match)
    if (!comparePatterns(base, variant).equal) {
      return { variant, cellIndex: idx }
    }
  }
  return null
}

/**
 * Guaranteed single-cell swap drawn from the GLOBAL cell library (not just the
 * tier palette), so it works even when a tier has no same-length alternative.
 * Returns a variant differing from `base` by exactly one beat-cell, or null only
 * for a degenerate single-cell bar with no same-length counterpart anywhere.
 */
function forceSwapGlobal(base: Pattern): { variant: Pattern; cellIndex: number } | null {
  const all = Object.values(CELLS) as BeatCell[]
  const order = base.cells.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (const idx of order) {
    const original = base.cells[idx]
    const alt = all.find((c) => c.beats === original.beats && c.id !== original.id)
    if (!alt) continue
    const cells = base.cells.slice()
    cells[idx] = alt
    const variant = pattern(cells, base.beatsPerBar, base.beatUnit)
    if (!comparePatterns(base, variant).equal) return { variant, cellIndex: idx }
  }
  return null
}

// ── 1) SPOT THE DIFFERENCE ───────────────────────────────────────────────────
export interface SpotPuzzle {
  kind: 'spot'
  a: Pattern
  b: Pattern
  /** Index into the BEAT SLOTS (one per beat of the bar) that changed. */
  changedBeat: number
  /** Total beat slots in the timeline. */
  beatSlots: number
}

/** Map a cell index to the absolute beat (slot) it starts on. */
function cellStartBeat(p: Pattern, cellIndex: number): number {
  let b = 0
  for (let i = 0; i < cellIndex; i++) b += p.cells[i].beats
  return b
}

export function makeSpotPuzzle(level: LevelDef): SpotPuzzle {
  for (let attempt = 0; attempt < 30; attempt++) {
    const a = makeBase(level)
    const swap = swapOneCell(a, level.tier)
    if (!swap) continue
    const beatSlots = level.bars * 4
    const changedBeat = Math.floor(cellStartBeat(a, swap.cellIndex))
    return { kind: 'spot', a, b: swap.variant, changedBeat, beatSlots }
  }
  // Fallback: the tier palette had no same-length swap; force one from the
  // global cell library so A and B ALWAYS differ by exactly one beat (never an
  // impossible identical pair).
  const a = makeBase(level)
  const forced = forceSwapGlobal(a)
  if (forced) {
    return {
      kind: 'spot',
      a,
      b: forced.variant,
      changedBeat: Math.floor(cellStartBeat(a, forced.cellIndex)),
      beatSlots: level.bars * 4,
    }
  }
  // Truly degenerate (single mono-cell bar with no counterpart anywhere).
  return { kind: 'spot', a, b: a, changedBeat: 0, beatSlots: level.bars * 4 }
}

// ── 2) CATCH THE IMPOSTOR (lineup / match) ──────────────────────────────────
export interface Suspect {
  id: number
  pattern: Pattern
  /** True if this suspect's rhythm matches the target. */
  isMatch: boolean
}
export interface LineupPuzzle {
  kind: 'lineup'
  target: Pattern
  suspects: Suspect[]
  /** Index of the matching suspect in `suspects`. */
  answerIndex: number
}

/** Build a distractor that does NOT match the target (differs by >=1 beat). */
function makeDistractor(target: Pattern, level: LevelDef): Pattern {
  // High difficulty → derive a near-clone (one beat off). Low → fully fresh.
  const nearClone = Math.random() < 0.3 + level.difficulty * 0.6
  if (nearClone) {
    const swap = swapOneCell(target, level.tier)
    if (swap) return swap.variant
  }
  for (let i = 0; i < 30; i++) {
    const p = makeBase(level)
    if (!comparePatterns(target, p).equal) return p
  }
  // last resort: a guaranteed single-cell swap (tier first, then global library)
  const swap = swapOneCell(target, level.tier) ?? forceSwapGlobal(target)
  return swap ? swap.variant : target
}

export function makeLineupPuzzle(level: LevelDef): LineupPuzzle {
  const target = makeBase(level)
  const count = level.difficulty >= 0.5 ? 4 : 3
  const patterns: Pattern[] = [target] // first is the true match
  let guard = 0
  while (patterns.length < count && guard++ < 400) {
    const d = makeDistractor(target, level)
    // NEVER allow a second pattern that matches the target (would be ambiguous)...
    if (comparePatterns(target, d).equal) continue
    // ...and keep distractors distinct from one another too.
    if (patterns.some((p) => comparePatterns(p, d).equal)) continue
    patterns.push(d)
  }
  // Pad with GUARANTEED non-matching distractors (force a global single-cell
  // swap off the target) so the lineup is always full and exactly one suspect
  // — the target — matches.
  while (patterns.length < count) {
    const forced = forceSwapGlobal(target)
    if (!forced) break
    patterns.push(forced.variant)
  }
  // Absolute last resort (degenerate): repeat a known non-matching distractor.
  while (patterns.length < count && patterns.length > 1) {
    patterns.push(patterns[patterns.length - 1])
  }

  const suspects: Suspect[] = patterns.map((p, i) => ({
    id: i,
    pattern: p,
    isMatch: comparePatterns(target, p).equal,
  }))
  // shuffle
  for (let i = suspects.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[suspects[i], suspects[j]] = [suspects[j], suspects[i]]
  }
  const answerIndex = suspects.findIndex((s) => s.isMatch)
  return { kind: 'lineup', target, suspects, answerIndex }
}

// ── 3) FORBIDDEN RHYTHM (alarm) ──────────────────────────────────────────────
export interface AlarmStep {
  pattern: Pattern
  /** True if this step IS the forbidden/wanted pattern. */
  forbidden: boolean
}
export interface AlarmPuzzle {
  kind: 'alarm'
  /** The "wanted" pattern the player memorizes. */
  wanted: Pattern
  steps: AlarmStep[]
}

/**
 * Build a single-bar Forbidden-Rhythm round: a wanted pattern, then a short
 * queue of patterns to classify. Some steps equal the wanted (alarm!), the rest
 * are decoys.
 */
export function makeAlarmPuzzle(level: LevelDef): AlarmPuzzle {
  const wanted = makeBase(level)
  const queueLen = 4 + Math.round(level.difficulty * 2) // 4..6 steps
  const forbiddenCount = Math.max(1, Math.round(queueLen * 0.4))
  const steps: AlarmStep[] = []
  for (let i = 0; i < queueLen; i++) steps.push({ pattern: wanted, forbidden: i < forbiddenCount })
  // The non-forbidden steps need distinct decoys.
  for (const s of steps) {
    if (s.forbidden) continue
    let decoy = makeDistractor(wanted, level)
    let guard = 0
    while (comparePatterns(wanted, decoy).equal && guard++ < 20) decoy = makeDistractor(wanted, level)
    s.pattern = decoy
  }
  // shuffle the queue
  for (let i = steps.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
  }
  return { kind: 'alarm', wanted, steps }
}

export type Puzzle = SpotPuzzle | LineupPuzzle | AlarmPuzzle

export function makePuzzle(level: LevelDef): Puzzle {
  switch (level.mechanic) {
    case 'spot':
      return makeSpotPuzzle(level)
    case 'lineup':
      return makeLineupPuzzle(level)
    case 'alarm':
      return makeAlarmPuzzle(level)
  }
}
