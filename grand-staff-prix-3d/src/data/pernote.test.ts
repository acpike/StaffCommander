import { describe, it, expect } from 'vitest'
import {
  noteKey,
  recordAnswer,
  rollingAccuracy,
  isProven,
  noteWeight,
  pickWeighted,
  stageMasteryGate,
  FRONTIER_WEIGHT,
  ADVANCE_STREAK,
  MASTERY_MIN_SAMPLES,
  type PerNote,
} from './pernote'
import { makeNote } from './notes'

const A = makeNote('A3', 'treble') // frontier
const B = makeNote('B3', 'treble') // established

/** Answer a note `times`, all correct unless `wrong` listed by 0-based index. */
function play(key: string, times: number, wrong: Set<number> = new Set()): PerNote {
  let stats: PerNote = {}
  for (let i = 0; i < times; i++) stats = recordAnswer(stats, key, !wrong.has(i))
  return stats
}

describe('recordAnswer + rollingAccuracy', () => {
  it('tracks seen / correct / streak and a rolling window', () => {
    const s = play('A3', 3) // 3 correct
    expect(s.A3.seen).toBe(3)
    expect(s.A3.correct).toBe(3)
    expect(s.A3.streak).toBe(3)
    expect(rollingAccuracy(s.A3)).toBe(1)
  })
  it('resets the streak on a miss but keeps the seen/correct counts', () => {
    const s = play('A3', 4, new Set([3])) // C C C X
    expect(s.A3.streak).toBe(0)
    expect(s.A3.correct).toBe(3)
    expect(rollingAccuracy(s.A3)).toBeCloseTo(0.75, 5)
  })
})

describe('frontier weighting', () => {
  it('boosts an unproven frontier note and relaxes once proven', () => {
    const frontier = new Set(['A3'])
    // Unproven (streak 0): boosted.
    expect(noteWeight('A3', frontier, {})).toBe(FRONTIER_WEIGHT)
    // After ADVANCE_STREAK consecutive corrects it relaxes to normal.
    const proven = play('A3', ADVANCE_STREAK)
    expect(isProven(proven.A3)).toBe(true)
    expect(noteWeight('A3', frontier, proven)).toBe(1)
    // An established (non-frontier) note is always weight 1.
    expect(noteWeight('B3', frontier, {})).toBe(1)
  })

  it('pickWeighted favours the frontier note ~FRONTIER_WEIGHT× over time', () => {
    const frontier = new Set(['A3'])
    // Deterministic LCG so the distribution is reproducible.
    let seed = 12345
    const rand01 = () => {
      seed = (seed * 1664525 + 1013904223) % 0x100000000
      return seed / 0x100000000
    }
    let aCount = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      if (noteKey(pickWeighted([A, B], frontier, {}, rand01)) === 'A3') aCount++
    }
    // Expected share = 3.5 / (3.5 + 1) ≈ 0.78.
    expect(aCount / N).toBeGreaterThan(0.7)
    expect(aCount / N).toBeLessThan(0.85)
  })

  it('boundary: rand below the frontier weight share picks the frontier note', () => {
    const frontier = new Set(['A3'])
    // weights [3.5, 1], total 4.5. r just under 3.5 → first; just over → second.
    expect(noteKey(pickWeighted([A, B], frontier, {}, () => 3.4 / 4.5))).toBe('A3')
    expect(noteKey(pickWeighted([A, B], frontier, {}, () => 3.6 / 4.5))).toBe('B3')
  })
})

describe('stageMasteryGate (per-note mastery)', () => {
  const pool = [A, B]
  it('passes when there is no frontier (e.g. custom practice)', () => {
    expect(stageMasteryGate([], pool, {})).toBe(true)
  })
  it('blocks while a frontier note is under-sampled', () => {
    const stats = play('A3', MASTERY_MIN_SAMPLES - 1) // too few reps
    expect(stageMasteryGate(['A3'], pool, stats)).toBe(false)
  })
  it('blocks while a frontier note is below the accuracy bar', () => {
    // 10 reps, 3 wrong → 70% < 90%.
    const stats = play('A3', 10, new Set([0, 1, 2]))
    expect(stageMasteryGate(['A3'], pool, stats)).toBe(false)
  })
  it('passes once every active frontier note clears its own bar', () => {
    let stats: PerNote = {}
    for (let i = 0; i < 10; i++) stats = recordAnswer(stats, 'A3', true)
    for (let i = 0; i < 10; i++) stats = recordAnswer(stats, 'B3', i !== 0) // 9/10
    expect(stageMasteryGate(['A3', 'B3'], pool, stats)).toBe(true)
  })
  it('ignores a frontier note that is not yet in the active pool', () => {
    // 'C4' is frontier but not in the pool → not required yet; A3 cleared.
    const stats = play('A3', 10)
    expect(stageMasteryGate(['A3', 'C4'], pool, stats)).toBe(true)
  })
})
