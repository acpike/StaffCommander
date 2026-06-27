// ──────────────────────────────────────────────────────────────────────────
// Integration tests for the store run-loop (Levels Rework §4–§7). The Phase-B
// engine DATA modules (ladder / pernote / tempo / scoring) are unit-tested in
// isolation; this file exercises where they are WIRED TOGETHER in store.ts —
// driving scripted runs through `startGame → beginPlay → answer → endGame` and
// asserting the integration guarantees that no single module can prove alone.
//
// The store is a Zustand singleton; we drive it outside React via
// `useGame.getState()` / `setState`. Browser globals are shimmed by ./test-env,
// imported FIRST so localStorage/window exist before the store is evaluated.
// ──────────────────────────────────────────────────────────────────────────
import './test-env'

import { describe, it, expect, beforeEach } from 'vitest'
import {
  makeNote,
  grandClefFor,
  LETTERS,
  NOTE_SETS,
  startCountOf,
  type NoteSet,
  type Letter,
} from '../data/notes'
import { masterThreshold, WRONG_PENALTY, RAMP_DOWN_DROP, RAMP_DOWN_WINDOW } from '../data/ladder'
import { correctPoints, wrongPenaltyPoints, MODE_CORRECT_POINTS } from '../data/scoring'
import { tempoFloor, COMFORT_WARMUP_STAGES } from '../data/tempo'
import { useGame, type Profile } from './store'

// ── helpers ─────────────────────────────────────────────────────────────────

function setOf(levelId: string): NoteSet {
  const s = NOTE_SETS.find((x) => x.id === levelId)
  if (!s) throw new Error(`no such level ${levelId}`)
  return s
}

/** Mastery threshold (in net-correct meter points) for a journey stage. */
function masterMOf(levelId: string): number {
  const s = setOf(levelId)
  return masterThreshold(s.notes.length, startCountOf(s))
}

function profile(): Profile {
  const s = useGame.getState()
  const p = s.profiles.find((x) => x.id === s.currentId)
  if (!p) throw new Error('no current profile')
  return p
}

function patchProfile(patch: Partial<Profile>): void {
  const id = useGame.getState().currentId
  useGame.setState((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
}

/** setLevel → startGame → beginPlay, leaving the store in a live `playing` run. */
function start(levelId: string): void {
  const g = useGame.getState()
  g.setLevel(levelId)
  g.startGame()
  g.beginPlay()
}

function otherLetter(l: Letter): Letter {
  return LETTERS.find((x) => x !== l)!
}

/**
 * Force the next shown note to `name` (bypassing the weighted RNG so runs are
 * deterministic) and answer it correctly or incorrectly via the real `answer`
 * action — the wiring under test.
 */
function answer(name: string, correct: boolean): void {
  const note = makeNote(name, grandClefFor(name))
  useGame.setState({ note })
  const g = useGame.getState()
  g.answer(correct ? note.letter : otherLetter(note.letter))
}
const correctly = (name: string) => answer(name, true)
const wrongly = (name: string) => answer(name, false)

beforeEach(() => {
  localStorage.clear()
  useGame.setState({ profiles: [], currentId: null, customLevels: [], screen: 'menu' })
  useGame.getState().addProfile('Tester')
})

// ── §4.2 — per-note gate blocks premature mastery ────────────────────────────

describe('per-note mastery gate (§4.2 headline guarantee)', () => {
  it('maxing the meter does NOT master while a frontier note is unproven; proving it then masters', () => {
    const lvl = 'r2-name' // Region 2 · Name — frontier F4 G4 F3 G3, masterM 75
    const masterM = masterMOf(lvl) // 75
    const set = setOf(lvl)
    // Every ladder note EXCEPT the frontier note G3 — drive the meter to the top
    // on these so the stage can only be gated by the one unproven note.
    const drivable = set.ladder!.filter((n) => n !== 'G3')

    start(lvl)
    // Max the meter with `masterM` correct answers, never showing G3.
    for (let i = 0; i < masterM; i++) correctly(drivable[i % drivable.length])

    const maxed = useGame.getState()
    expect(maxed.meterM).toBe(masterM) // meter is at the mastery threshold…
    expect(maxed.activeCount).toBe(set.notes.length) // …and the full pool (incl. G3) is active
    expect(maxed.masteredThisRun).toBeNull() // …yet the stage did NOT master:
    expect(maxed.screen).toBe('playing') // the run is still going (no win/exit)
    expect(profile().mastered).not.toContain(lvl) // …and nothing was banked

    // Now prove the held-out frontier note: it clears its bar on its 3rd rep.
    correctly('G3') // 1 sample — still under MASTERY_MIN_SAMPLES
    expect(useGame.getState().masteredThisRun).toBeNull()
    correctly('G3') // 2 samples — still under
    expect(useGame.getState().masteredThisRun).toBeNull()
    correctly('G3') // 3 samples @ 100% — gate now passes → masters

    const done = useGame.getState()
    expect(done.masteredThisRun).toBe(set.name)
    expect(done.screen).toBe('over') // mastering ends the race as a win
    expect(profile().mastered).toContain(lvl)
  })
})

// ── §6/§7 — a bad run can never cost an earned stage ─────────────────────────

describe('earned progress is sticky (§6/§7)', () => {
  it('a terrible run (long miss streak + ramp-down) leaves mastered/unlocked/peak untouched', () => {
    const lvl = 'r2-name'
    const masterM = masterMOf(lvl)
    const next = 'r2-find'
    // Pre-earn the stage: mastered, next unlocked, peak meter banked at the top.
    patchProfile({
      mastered: [lvl],
      unlocked: [...new Set([...profile().unlocked, lvl, next])],
      mastery: { [lvl]: masterM },
    })
    const before = profile()
    const masteredBefore = [...before.mastered]
    const unlockedBefore = [...before.unlocked]
    const peakBefore = before.mastery[lvl]

    start(lvl)
    // Beginner (Name) is no-fail, so we can pound out a wretched run: all misses,
    // long enough to spike the ramp-down repeatedly.
    for (let i = 0; i < 12; i++) wrongly('C4')
    expect(useGame.getState().meterM).toBeLessThan(masterM) // transient meter fell hard
    useGame.getState().endGame()

    const after = profile()
    expect(after.mastered).toEqual(masteredBefore) // stage stays mastered
    expect(after.unlocked).toEqual(unlockedBefore) // next stays unlocked
    expect(after.mastery[lvl]).toBe(peakBefore) // saved peak never lowered
    expect(after.mastered).toContain(lvl)
    expect(after.unlocked).toContain(next)
  })
})

// ── §4.1 — two-way ramp-down is bounded ──────────────────────────────────────

describe('two-way ladder ramp-down (§4.1)', () => {
  it('shrinks the active pool but never below startCount, and the window-reset stops it re-firing every miss', () => {
    const lvl = 'r2-name'
    const set = setOf(lvl)
    const startCount = startCountOf(set) // 5
    const masterM = masterMOf(lvl)
    // Bank a full peak so the run starts with the whole pool active (room to shrink).
    patchProfile({ mastery: { [lvl]: masterM } })

    start(lvl)
    expect(useGame.getState().activeCount).toBe(set.notes.length) // full pool to start

    // Phase 1 — drop cadence. Over two full windows of misses (meter still has
    // headroom, so every delta is clean), the ramp-down fires only on the
    // window-boundary miss, then the store resets the window so the next miss is
    // an ordinary small drop. It does NOT fire on every miss.
    const drops: number[] = [] // meter lost on each successive miss
    const counts: number[] = [] // active-pool size after each miss
    for (let i = 0; i < 2 * RAMP_DOWN_WINDOW; i++) {
      const m0 = useGame.getState().meterM
      wrongly('C4')
      const s = useGame.getState()
      drops.push(m0 - s.meterM)
      counts.push(s.activeCount)
    }
    const bigDrop = WRONG_PENALTY + RAMP_DOWN_DROP // 2 + 15
    expect(drops[RAMP_DOWN_WINDOW - 1]).toBe(bigDrop) // 6th miss: ramp-down fires
    expect(drops[RAMP_DOWN_WINDOW]).toBe(WRONG_PENALTY) // 7th miss: window reset → small
    expect(drops[2 * RAMP_DOWN_WINDOW - 1]).toBe(bigDrop) // 12th miss: fires again
    expect(drops.filter((d) => d === bigDrop).length).toBe(2) // exactly one per window — not every miss
    // No two consecutive misses are both ramp-downs (the reset is what guarantees this).
    for (let i = 1; i < drops.length; i++) expect(drops[i - 1] === bigDrop && drops[i] === bigDrop).toBe(false)

    // Phase 2 — bounded below. Keep missing; the pool shrinks rung-by-rung but is
    // floored at startCount and never drops beneath it.
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(startCount)
    for (let i = 0; i < 2 * RAMP_DOWN_WINDOW && useGame.getState().activeCount > startCount; i++) {
      wrongly('C4')
      counts.push(useGame.getState().activeCount)
    }
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(startCount)
    expect(Math.min(...counts)).toBe(startCount) // it actually reaches — and holds at — the floor
  })
})

// ── §5 — comfort-tempo ratchets ──────────────────────────────────────────────

describe('comfort tempo persistence (§5)', () => {
  it('stores the run peak, starts a later run below it (warm-up), and never lowers it on a worse run', () => {
    const lvl = 'r1-find' // Find mode → floor above the absolute minimum
    const floor = tempoFloor('find')

    // Run 1: ramp the tempo up with a confident streak.
    start(lvl)
    for (let i = 0; i < 12; i++) correctly('C4')
    const peak = useGame.getState().tempoPeak
    expect(peak).toBeGreaterThan(floor) // the run actually warmed up past the floor
    useGame.getState().endGame()
    expect(profile().comfortTempo[lvl]).toBe(peak) // comfort tempo banked = peak

    // Run 2 (return): the warm-up ramp restarts a notch BELOW the peak, not from
    // scratch — between the floor and the saved comfort tempo.
    start(lvl)
    const restart = useGame.getState().tempo
    expect(restart).toBeCloseTo(peak - COMFORT_WARMUP_STAGES, 6)
    expect(restart).toBeLessThan(peak) // below peak (warm-up)…
    expect(restart).toBeGreaterThan(floor) // …but above the cold-start floor

    // A worse run (no further progress) must NOT lower the stored comfort tempo.
    useGame.getState().endGame()
    expect(profile().comfortTempo[lvl]).toBe(peak) // ratchet only ever climbs
  })
})

// ── §6 — scoring tiers in the run-loop ───────────────────────────────────────

describe('scoring tiers in-loop (§6)', () => {
  // Car is stationary in tests (no render loop) ⇒ speedMult = 1; the first
  // correct of a run is a 1-streak ⇒ comboMult = 1.2. We assert against the real
  // scoring fn so the BASE tier (name 2 < find 3 < mix 4) is what differs.
  const SPEED_MULT = 1
  const COMBO_MULT = 1.2

  it('awards the correct base tier (×speed×combo) per mode — Name < Find < Mix', () => {
    const expectFirstCorrect = (lvl: string, mode: 'name' | 'find' | 'mix') => {
      start(lvl)
      correctly('C4')
      return useGame.getState().score === correctPoints(mode, SPEED_MULT, COMBO_MULT)
    }
    expect(expectFirstCorrect('r1-name', 'name')).toBe(true)
    const nameScore = useGame.getState().score

    expect(expectFirstCorrect('r1-find', 'find')).toBe(true)
    const findScore = useGame.getState().score

    expect(expectFirstCorrect('r1-mix', 'mix')).toBe(true)
    const mixScore = useGame.getState().score

    // The base tiers strictly escalate with mode difficulty.
    expect(MODE_CORRECT_POINTS.name).toBeLessThan(MODE_CORRECT_POINTS.find)
    expect(MODE_CORRECT_POINTS.find).toBeLessThan(MODE_CORRECT_POINTS.mix)
    expect(nameScore).toBeLessThan(findScore)
    expect(findScore).toBeLessThan(mixScore)
  })

  it('a wrong answer changes points only — never the saved mastery floor of an earned stage', () => {
    const lvl = 'r1-find'
    const masterM = masterMOf(lvl)
    // Earn the stage first: mastered + peak banked.
    patchProfile({ mastered: [lvl], mastery: { [lvl]: masterM } })

    start(lvl)
    correctly('C4') // get some points on the board
    const scoreBefore = useGame.getState().score
    const livesBefore = useGame.getState().lives
    expect(scoreBefore).toBeGreaterThan(0)

    wrongly('C4') // Find penalty is 1 point
    const after = useGame.getState()
    expect(scoreBefore - after.score).toBe(wrongPenaltyPoints('find')) // points dropped by the tier penalty
    expect(after.lives).toBe(livesBefore - 1) // (Find is fail-able; a life is spent)
    // The earned stage's saved floor is untouched mid-run — only transient meter moved.
    expect(profile().mastery[lvl]).toBe(masterM)
    expect(profile().mastered).toContain(lvl)
    expect(after.masteredThisRun).toBeNull()
  })

  it('Beginner (Name) never punishes points on a wrong answer (penalty 0)', () => {
    start('r1-name')
    correctly('C4')
    const scoreBefore = useGame.getState().score
    const livesBefore = useGame.getState().lives
    wrongly('C4')
    const after = useGame.getState()
    expect(after.score).toBe(scoreBefore) // 0-penalty tier: points unchanged
    expect(after.lives).toBe(livesBefore) // no-fail: no life lost either
    expect(wrongPenaltyPoints('name')).toBe(0)
  })
})
