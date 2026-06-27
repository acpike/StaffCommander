// ──────────────────────────────────────────────────────────────────────────
// End-to-end integration tests for the Levels Rework MIGRATION seam (Phase E).
//
// These exercise where Phase A's migration (`migrate.ts`) meets Phase C/D's
// journey-state contract: after an old/legacy profile is re-keyed on load, the
// Learning-Mode chain that Menu.tsx renders must be COHERENT — a gap-free
// unlock/mastery chain with exactly one "you are here" current stage (the first
// unlocked-but-unmastered stage in tier order, the same predicate Menu uses).
//
// The headline bug this covers: the legacy id map is NOT onto a contiguous tier
// prefix (treble-1→r1-name but treble-2→r2-name skips r1-find/r1-mix; the *-5
// ledger levels leap to r5-mix over r3/r4), so a naive re-key leaves a MASTERED
// stage floating above LOCKED ones and the current-stage finder skips the hole
// and lands the student on a far-future stage (a treble graduate was placed on
// r5-mix). migrateProfileIds now backfills the chain to fix that.
// ──────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { migrateProfileIds, migrateLevelId, type MigratableProfile } from './migrate'
import { JOURNEY_STAGES } from './notes'

const STAGES = [...JOURNEY_STAGES].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))
const tierOf = (id: string): number => JOURNEY_STAGES.find((s) => s.id === id)?.tier ?? 0

function emptyProfile(partial: Partial<MigratableProfile> = {}): MigratableProfile {
  return { best: {}, unlocked: [], mastered: [], mastery: {}, lastPlayed: {}, ...partial }
}

// Replicates Menu.tsx's journey predicates so the test pins the exact contract
// the UI relies on (tier-1 is always unlocked; current = first unlocked & not
// mastered, in tier order).
function journeyView(m: MigratableProfile) {
  const masteredSet = new Set(m.mastered)
  const unlockedSet = new Set(m.unlocked)
  const isUnlocked = (id: string) => tierOf(id) === 1 || unlockedSet.has(id)
  const current = STAGES.find((s) => isUnlocked(s.id) && !masteredSet.has(s.id))
  return { masteredSet, isUnlocked, current }
}

/**
 * Assert the journey chain is COHERENT for a (migrated) profile:
 *  • mastered journey tiers are a contiguous prefix [1..maxMastered];
 *  • every tier ≤ maxMastered is unlocked (no Mastered-above-Locked);
 *  • unlocked journey tiers are a contiguous prefix [1..maxUnlocked] (no
 *    Unlocked-above-Locked gap);
 *  • there is exactly ONE current stage (or none, iff the journey is complete),
 *    and it sits right after the mastered frontier.
 */
function expectCoherent(m: MigratableProfile) {
  const { masteredSet, isUnlocked, current } = journeyView(m)
  const masteredTiers = STAGES.filter((s) => masteredSet.has(s.id)).map((s) => s.tier!)
  const unlockedTiers = STAGES.filter((s) => isUnlocked(s.id)).map((s) => s.tier!)
  const maxMastered = masteredTiers.length ? Math.max(...masteredTiers) : 0
  const maxUnlocked = unlockedTiers.length ? Math.max(...unlockedTiers) : 0

  // mastered is a gap-free prefix 1..maxMastered
  expect(masteredTiers).toEqual(Array.from({ length: maxMastered }, (_, i) => i + 1))
  // unlocked is a gap-free prefix 1..maxUnlocked
  expect(unlockedTiers).toEqual(Array.from({ length: maxUnlocked }, (_, i) => i + 1))
  // no mastered stage floats above a locked one
  expect(maxUnlocked).toBeGreaterThanOrEqual(maxMastered)

  if (maxMastered === STAGES.length) {
    expect(current).toBeUndefined() // whole journey done → no "you are here"
  } else {
    expect(current).toBeDefined()
    expect(current!.tier).toBe(maxMastered + 1) // current sits just past the frontier
  }
  return current
}

describe('migration → gap-free journey chain (Phase A × C/D seam)', () => {
  it('the bug case: a treble graduate lands at the next chain stage, NOT a far-future stage', () => {
    // Old profile: mastered treble-1..4, treble-5 unlocked (the classic graduate).
    const m = migrateProfileIds(
      emptyProfile({
        mastered: ['treble-1', 'treble-2', 'treble-3', 'treble-4'],
        unlocked: ['treble-1', 'treble-2', 'treble-3', 'treble-4', 'treble-5'],
      }),
    )
    const current = expectCoherent(m)
    // treble-4 → r2-mix (tier 6) is the highest mastered; the gap-fill masters
    // r1-find/r1-mix too, so the student resumes at r3-name — NOT r5-mix.
    expect(current!.id).toBe('r3-name')
    expect(m.mastered).toEqual(expect.arrayContaining(['r1-name', 'r1-find', 'r1-mix', 'r2-name', 'r2-find', 'r2-mix']))
    expect(current!.id).not.toBe('r5-mix')
  })

  it('grand-5 mastered (top of old grand track) masters through Region 5, current = r6-name', () => {
    const m = migrateProfileIds(emptyProfile({ mastered: ['grand-1', 'grand-5'], unlocked: ['grand-1', 'grand-5'] }))
    const current = expectCoherent(m)
    // grand-5 → r5-mix (tier 15) → mastered 1..15, current is the next, r6-name.
    expect(current!.id).toBe('r6-name')
    expect(m.mastered).toContain('r5-mix')
  })

  it('grand-4 mastered + grand-5 unlocked-not-mastered → current = r5-name', () => {
    const m = migrateProfileIds(
      emptyProfile({
        mastered: ['grand-1', 'grand-2', 'grand-3', 'grand-4'],
        unlocked: ['grand-1', 'grand-2', 'grand-3', 'grand-4', 'grand-5'],
      }),
    )
    const current = expectCoherent(m)
    // grand-4 → r4-mix (tier 12) highest mastered → current r5-name (tier 13).
    expect(current!.id).toBe('r5-name')
  })

  it('a bass-only graduate stays coherent (different map branch)', () => {
    const m = migrateProfileIds(
      emptyProfile({
        mastered: ['bass-1', 'bass-2', 'bass-3'],
        unlocked: ['bass-1', 'bass-2', 'bass-3', 'bass-4'],
      }),
    )
    expectCoherent(m)
  })

  it('a fully-completed old profile (everything mastered) shows the journey COMPLETE', () => {
    const all = ['treble-1', 'treble-2', 'treble-3', 'treble-4', 'treble-5', 'bass-1', 'bass-2', 'bass-3', 'bass-4', 'bass-5', 'grand-1', 'grand-2', 'grand-3', 'grand-4', 'grand-5']
    const m = migrateProfileIds(emptyProfile({ mastered: all, unlocked: all }))
    // highest is *-5 → r5-mix (tier 15), so the journey is NOT all-mastered (regions
    // 6/7 never existed in the old catalog) — current should be r6-name, coherent.
    const current = expectCoherent(m)
    expect(current!.id).toBe('r6-name')
  })

  it('a brand-new / empty profile has no journey progress and a fresh current at r1-name', () => {
    const m = migrateProfileIds(emptyProfile())
    expect(m.mastered).toHaveLength(0)
    // tier-1 is always unlocked in the UI even with an empty unlocked list.
    const { current } = journeyView(m)
    expect(current?.id).toBe('r1-name')
  })
})

describe('migration is non-destructive (no progress lost)', () => {
  it('keeps the BETTER value when two old ids collide on one new stage', () => {
    // treble-5 and grand-5 BOTH map to r5-mix — best score + meter must keep the max.
    const m = migrateProfileIds(
      emptyProfile({
        best: { 'treble-5': 100, 'grand-5': 250 },
        mastery: { 'treble-5': 40, 'grand-5': 80 },
        lastPlayed: { 'treble-5': '2025-01-01', 'grand-5': '2025-06-01' },
        unlocked: ['treble-5', 'grand-5'],
        mastered: ['treble-5', 'grand-5'],
      }),
    )
    expect(m.best['r5-mix']).toBe(250) // larger score wins
    expect(m.mastery['r5-mix']).toBe(80) // larger meter wins
    expect(m.lastPlayed['r5-mix']).toBe('2025-06-01') // later date wins
  })

  it('custom (cl-*) ids pass through untouched', () => {
    const m = migrateProfileIds(emptyProfile({ best: { 'cl-abc123': 99 }, unlocked: ['cl-abc123'], mastered: ['cl-abc123'] }))
    expect(m.best['cl-abc123']).toBe(99)
    expect(m.unlocked).toContain('cl-abc123')
    expect(m.mastered).toContain('cl-abc123')
  })

  it('the saved active level id survives as a valid current stage', () => {
    // settings.levelId is migrated separately via migrateLevelId in the store.
    expect(migrateLevelId('grand-4')).toBe('r4-mix')
    expect(JOURNEY_STAGES.some((s) => s.id === migrateLevelId('grand-4'))).toBe(true)
    expect(migrateLevelId('treble-5')).toBe('r5-mix')
    expect(migrateLevelId('cl-keepme')).toBe('cl-keepme') // custom untouched
    expect(migrateLevelId('r3-find')).toBe('r3-find') // already-current untouched
    expect(migrateLevelId('totally-unknown')).toBe('r1-name') // safe fallback
  })
})

describe('migration is idempotent', () => {
  it('re-running migrate on an already-migrated profile is a no-op (chain stays stable)', () => {
    const once = migrateProfileIds(
      emptyProfile({
        mastered: ['treble-1', 'treble-2', 'treble-3', 'treble-4'],
        unlocked: ['treble-1', 'treble-2', 'treble-3', 'treble-4', 'treble-5'],
        best: { 'grand-5': 250 },
      }),
    )
    const twice = migrateProfileIds(once)
    expect(new Set(twice.mastered)).toEqual(new Set(once.mastered))
    expect(new Set(twice.unlocked)).toEqual(new Set(once.unlocked))
    expect(twice.best).toEqual(once.best)
    expectCoherent(twice)
  })
})
