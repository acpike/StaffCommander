import { describe, it, expect } from 'vitest'
import {
  MODE_CORRECT_POINTS,
  MODE_WRONG_POINTS,
  correctPoints,
  wrongPenaltyPoints,
} from './scoring'

describe('per-mode scoring tiers (§6)', () => {
  it('correct base pays more per harder mode (2/3/4)', () => {
    expect(MODE_CORRECT_POINTS.name).toBe(2)
    expect(MODE_CORRECT_POINTS.find).toBe(3)
    expect(MODE_CORRECT_POINTS.mix).toBe(4)
    // At neutral speed×combo (1×1) the award equals the tier base.
    expect(correctPoints('name', 1, 1)).toBe(2)
    expect(correctPoints('find', 1, 1)).toBe(3)
    expect(correctPoints('mix', 1, 1)).toBe(4)
  })

  it('speed×combo multiplies the mode tier on top', () => {
    // Mix base 4 × 2.5 speed × 2 combo = 20.
    expect(correctPoints('mix', 2.5, 2)).toBe(20)
    // Name base 2 × 1.5 × 1.5 = 4.5 → rounds to 5.
    expect(correctPoints('name', 1.5, 1.5)).toBe(Math.round(2 * 1.5 * 1.5))
  })

  it('wrong costs more per harder mode and never punishes beginner Name', () => {
    expect(MODE_WRONG_POINTS.name).toBe(0)
    expect(MODE_WRONG_POINTS.find).toBe(1)
    expect(MODE_WRONG_POINTS.mix).toBe(2)
    expect(wrongPenaltyPoints('name')).toBe(0)
    expect(wrongPenaltyPoints('find')).toBe(1)
    expect(wrongPenaltyPoints('mix')).toBe(2)
  })
})
