import { describe, it, expect } from 'vitest'
import {
  TEMPO_MIN,
  MODE_SPEED_FLOOR,
  TEMPO_RAMP_PER_CORRECT,
  TEMPO_SURGE_STREAK,
  TEMPO_SURGE_BONUS,
  EASE_MISS_DROP,
  COMFORT_WARMUP_STAGES,
  tempoFloor,
  initialTempo,
  tempoOnCorrect,
  tempoOnMiss,
  updateComfort,
} from './tempo'

describe('per-mode floor (§5 — base speed steps up each mode)', () => {
  it('Name keeps the slowest on-ramp; Find/Mix step up', () => {
    expect(MODE_SPEED_FLOOR.name).toBe(0)
    expect(tempoFloor('name')).toBe(TEMPO_MIN) // as slow as today
    expect(tempoFloor('find')).toBeGreaterThan(tempoFloor('name'))
    expect(tempoFloor('mix')).toBeGreaterThan(tempoFloor('find'))
  })
})

describe('initialTempo (comfort-tempo warm-up start)', () => {
  it('first visit (no comfort) starts at the mode floor — Region 1 · Name == 1', () => {
    expect(initialTempo('name', undefined)).toBe(TEMPO_MIN)
    expect(initialTempo('name', 0)).toBe(TEMPO_MIN)
  })
  it('on return, starts a short warm-up below the comfort tempo', () => {
    expect(initialTempo('name', 5)).toBeCloseTo(5 - COMFORT_WARMUP_STAGES, 5)
  })
  it('never starts below the mode floor', () => {
    expect(initialTempo('mix', 1)).toBe(tempoFloor('mix'))
  })
})

describe('ease-on-miss / surge-on-confidence (§5)', () => {
  it('ramps up per correct and never exceeds the cap', () => {
    expect(tempoOnCorrect(1, 1, 99)).toBeCloseTo(1 + TEMPO_RAMP_PER_CORRECT, 5)
    expect(tempoOnCorrect(3, 1, 3)).toBe(3) // already at cap
  })
  it('surges faster once the student is on a confident streak', () => {
    const calm = tempoOnCorrect(2, TEMPO_SURGE_STREAK - 1, 99)
    const hot = tempoOnCorrect(2, TEMPO_SURGE_STREAK, 99)
    expect(hot - calm).toBeCloseTo(TEMPO_SURGE_BONUS, 5)
  })
  it('eases off on a miss but never below the mode floor', () => {
    expect(tempoOnMiss(3, 'name')).toBeCloseTo(3 - EASE_MISS_DROP, 5)
    expect(tempoOnMiss(tempoFloor('find'), 'find')).toBe(tempoFloor('find'))
  })
})

describe('updateComfort (persisted comfort tempo ratchets up)', () => {
  it('keeps the higher of the saved comfort and this run’s peak', () => {
    expect(updateComfort(undefined, 4)).toBe(4)
    expect(updateComfort(6, 4)).toBe(6)
    expect(updateComfort(3, 5)).toBe(5)
  })
})
