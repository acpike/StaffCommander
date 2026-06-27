import { describe, it, expect } from 'vitest'
import {
  STEP,
  HYST,
  masterThreshold,
  isMastered,
  resolveActiveCount,
  activeCountAt,
  meterStart,
  ladderProgress,
  BASE_WARMUP,
  DECAY_PER_DAY,
} from './ladder'

// A canonical 5-note level starting with 2 notes (e.g. treble C,D → +E → +F → +G).
const LEN = 5
const START = 2

describe('masterThreshold', () => {
  it('is STEP per note added above the start pool, plus one to hold the full pool', () => {
    // 3 notes added (E,F,G) + 1 hold = 4 rungs × STEP.
    expect(masterThreshold(LEN, START)).toBe(STEP * (LEN - START + 1))
    expect(masterThreshold(5, 2)).toBe(60)
  })
})

describe('isMastered', () => {
  it('is true exactly at the threshold', () => {
    const m = masterThreshold(LEN, START)
    expect(isMastered(m - 1, LEN, START)).toBe(false)
    expect(isMastered(m, LEN, START)).toBe(true)
  })
})

describe('activeCountAt (fresh start)', () => {
  it('climbs one note per STEP from the start pool', () => {
    expect(activeCountAt(0, LEN, START)).toBe(2)
    expect(activeCountAt(STEP - 1, LEN, START)).toBe(2)
    expect(activeCountAt(STEP, LEN, START)).toBe(3)
    expect(activeCountAt(2 * STEP, LEN, START)).toBe(4)
    expect(activeCountAt(3 * STEP, LEN, START)).toBe(5)
  })
  it('never exceeds the ladder length', () => {
    expect(activeCountAt(999, LEN, START)).toBe(LEN)
  })
})

describe('resolveActiveCount (hysteresis)', () => {
  it('adds a note when the meter reaches the add-threshold', () => {
    expect(resolveActiveCount(STEP, 2, LEN, START)).toBe(3)
    expect(resolveActiveCount(2 * STEP, 3, LEN, START)).toBe(4)
  })

  it('does NOT drop the note immediately after adding it (hysteresis band)', () => {
    // Just added the 3rd note at M=15; a single miss (−2 → 13) must keep it.
    expect(resolveActiveCount(STEP - 2, 3, LEN, START)).toBe(3)
    // Still held anywhere within the HYST band.
    expect(resolveActiveCount(STEP - HYST, 3, LEN, START)).toBe(3)
  })

  it('drops the top note once the meter falls a full HYST below its threshold', () => {
    // 3rd note keep-band floor = STEP − HYST = 10; below it → drop to 2.
    expect(resolveActiveCount(STEP - HYST - 1, 3, LEN, START)).toBe(2)
  })

  it('never drops below the start pool', () => {
    expect(resolveActiveCount(0, 2, LEN, START)).toBe(2)
    expect(resolveActiveCount(-50, 2, LEN, START)).toBe(2)
  })

  it('never grows past the ladder length', () => {
    expect(resolveActiveCount(999, 5, LEN, START)).toBe(LEN)
  })

  it('round-trips a realistic climb-and-slip sequence', () => {
    let count = START
    let M = 0
    // Climb to 3 notes.
    M = STEP
    count = resolveActiveCount(M, count, LEN, START)
    expect(count).toBe(3)
    // A couple of misses inside the hysteresis band keep 3.
    M -= 2
    count = resolveActiveCount(M, count, LEN, START)
    expect(count).toBe(3)
    // A bad streak punches through the band → back to 2.
    M = STEP - HYST - 1
    count = resolveActiveCount(M, count, LEN, START)
    expect(count).toBe(2)
    // Recover and push to mastery.
    M = masterThreshold(LEN, START)
    count = resolveActiveCount(M, count, LEN, START)
    expect(count).toBe(LEN)
    expect(isMastered(M, LEN, START)).toBe(true)
  })
})

describe('meterStart (warm-up + decay)', () => {
  it('first visit (savedM 0) starts at 0', () => {
    expect(meterStart(0, 0, masterThreshold(LEN, START))).toBe(0)
  })
  it('same-day return applies only the base warm-up', () => {
    expect(meterStart(40, 0, 60)).toBe(40 - BASE_WARMUP)
  })
  it('decays further per day away', () => {
    expect(meterStart(40, 3, 60)).toBe(40 - (BASE_WARMUP + DECAY_PER_DAY * 3))
  })
  it('never goes below 0 or above the mastery cap', () => {
    expect(meterStart(5, 10, 60)).toBe(0)
    // A saved meter at the cap decays normally; an over-cap input is clamped down.
    expect(meterStart(60, 0, 60)).toBe(60 - BASE_WARMUP)
    expect(meterStart(1000, 0, 60)).toBe(60)
  })
})

describe('ladderProgress', () => {
  it('reports fraction toward the next note', () => {
    const p = ladderProgress(Math.floor(STEP / 2), 2, LEN, START)
    expect(p.activeCount).toBe(2)
    expect(p.full).toBe(false)
    expect(p.toNext).toBeCloseTo(0.5, 1)
  })
  it('when full, reports progress toward mastery', () => {
    const masterM = masterThreshold(LEN, START)
    const p = ladderProgress(masterM - STEP, LEN, LEN, START)
    expect(p.full).toBe(true)
    expect(p.toNext).toBeCloseTo(0, 5)
    const p2 = ladderProgress(masterM, LEN, LEN, START)
    expect(p2.toNext).toBe(1)
  })
})
