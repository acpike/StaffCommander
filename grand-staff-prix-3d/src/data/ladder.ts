// ──────────────────────────────────────────────────────────────────────────
// The adaptive note ladder — the educational core of progression.
//
// Each level has an ORDERED ladder of notes and a per-(profile, level) mastery
// meter `M`. Correct answers raise M; wrong answers lower it. As M climbs past
// evenly-spaced thresholds, the next note in the ladder joins the active pool;
// as M falls, the most-recently-added note drops back off (with hysteresis so a
// single slip can't flicker a note on and off). Holding the full pool long
// enough masters the level.
//
// All functions here are PURE so the behaviour can be unit-tested in isolation
// (see ladder.test.ts). The store owns the running `M` and active-count state.
// ──────────────────────────────────────────────────────────────────────────

// ── Tunables ────────────────────────────────────────────────────────────────
// Net points to earn each new note. Higher = more reps per note = stronger
// reinforcement and longer races. 15 ≈ 80–90 notes to master a 5-note level at
// ~85% accuracy. (See LEVEL_SYSTEM_REDESIGN.md §3d.)
export const STEP = 15
// Hysteresis: once a note is added at k·STEP, it isn't removed until M drops
// below k·STEP − HYST. Stops the pool flickering at a threshold boundary.
export const HYST = 5
// Meter cost of a wrong answer (a correct answer is worth +1).
export const WRONG_PENALTY = 2
// On re-entering a level, M is pulled back by this much (a warm-up the student
// re-climbs in seconds if they know it), plus DECAY_PER_DAY for each day away —
// so mastery decays and must be re-proven. (See §6.)
export const BASE_WARMUP = 8
export const DECAY_PER_DAY = 4

// ── Two-way ladder: ramp-DOWN on a miss-rate spike (spec §4.1) ───────────────
// The meter already dips WRONG_PENALTY per wrong answer. On top of that, when the
// student is missing repeatedly within a short window, shed a whole STEP so the
// pool shrinks a rung — isolating the troublesome note to drill it at higher
// frequency, then re-introduce it as accuracy recovers. Invisible + automatic.
/** How many recent answers the miss-rate is measured over. */
export const RAMP_DOWN_WINDOW = 6
/** Miss fraction in that window that triggers a ramp-down (≥ half missed). */
export const RAMP_DOWN_MISS_RATE = 0.5
/** Extra meter shed when a ramp-down fires (one STEP ≈ drops the top note). */
export const RAMP_DOWN_DROP = STEP

/**
 * Extra meter to subtract because the recent miss-rate has spiked. Returns 0
 * until the window is full of recent results AND at least RAMP_DOWN_MISS_RATE of
 * them are misses; the store resets the window after a drop so it can't re-fire
 * every answer. PURE — `recent` is the last few results (true = correct).
 */
export function rampDownPenalty(recent: boolean[]): number {
  if (recent.length < RAMP_DOWN_WINDOW) return 0
  const misses = recent.reduce((n, ok) => n + (ok ? 0 : 1), 0)
  return misses / recent.length >= RAMP_DOWN_MISS_RATE ? RAMP_DOWN_DROP : 0
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Meter value at which a level is fully mastered: the whole ladder held for one
 * more STEP's worth of correct answers beyond unlocking the last note.
 */
export function masterThreshold(ladderLen: number, startCount: number): number {
  return STEP * (ladderLen - startCount + 1)
}

/** True once the meter has reached the mastery threshold. */
export function isMastered(M: number, ladderLen: number, startCount: number): boolean {
  return M >= masterThreshold(ladderLen, startCount)
}

/**
 * Resolve the active note count from the meter, given the PREVIOUS count (for
 * hysteresis). Grows when M reaches the next note's add-threshold; shrinks when
 * M falls a full HYST band below the current top note's threshold.
 *
 *   add note (count→count+1) when  M ≥ STEP·(count − startCount + 1)
 *   drop top note             when  M < STEP·(count − startCount) − HYST
 */
export function resolveActiveCount(
  M: number,
  prevCount: number,
  ladderLen: number,
  startCount: number,
): number {
  let count = clamp(prevCount, startCount, ladderLen)
  // Grow: add the next note while the meter has reached its add-threshold.
  while (count < ladderLen && M >= STEP * (count - startCount + 1)) count++
  // Shrink: drop the top note while the meter has fallen below its keep-band.
  while (count > startCount && M < STEP * (count - startCount) - HYST) count--
  return count
}

/**
 * Active count for a FRESH start at meter M (no previous count to carry). Used
 * when (re)entering a level. Climbs from startCount with no hysteresis, since
 * there is no prior state to debounce against.
 */
export function activeCountAt(M: number, ladderLen: number, startCount: number): number {
  let count = startCount
  while (count < ladderLen && M >= STEP * (count - startCount + 1)) count++
  return count
}

/**
 * The meter value to begin a session with, given the saved meter, how many days
 * since the level was last played, and the level's mastery threshold. Applies a
 * warm-up plus per-day decay so returning students re-prove what they know.
 */
export function meterStart(savedM: number, daysAway: number, masterM: number): number {
  const decay = BASE_WARMUP + DECAY_PER_DAY * Math.max(0, daysAway)
  return clamp(savedM - decay, 0, masterM)
}

export interface LadderProgress {
  /** Notes currently in play. */
  activeCount: number
  /** Whole ladder length. */
  total: number
  /** True when the full ladder is active. */
  full: boolean
  /** 0..1 progress of the meter toward the NEXT note (or toward mastery when full). */
  toNext: number
}

/**
 * HUD-facing snapshot: how full the "next note" meter is, for the progress bar.
 * When the pool is already full, reports progress toward mastery instead.
 */
export function ladderProgress(
  M: number,
  activeCount: number,
  ladderLen: number,
  startCount: number,
): LadderProgress {
  const masterM = masterThreshold(ladderLen, startCount)
  const full = activeCount >= ladderLen
  // Meter floor for the current rung, and the target that reveals the next note
  // (or masters the level when full).
  const rung = activeCount - startCount // notes added so far
  const floorM = STEP * rung
  const targetM = full ? masterM : STEP * (rung + 1)
  const span = Math.max(1, targetM - floorM)
  return {
    activeCount,
    total: ladderLen,
    full,
    toNext: clamp((M - floorM) / span, 0, 1),
  }
}
