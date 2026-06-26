// Progression: XP → named ranks, gems per run, achievements, daily challenges.
// Adapted from grand-staff-prix-3d/src/data/progression.ts so the rhythm-games
// suite shares the EXACT same gamification feel (ranks Beginner→Maestro, gems,
// mastery bonus). Tuned for a 3-game suite where XP accrues across all games.

export interface Rank {
  xp: number
  name: string
}

// XP accrues across all three games (one shared profile). Curve mirrors the
// flagship's spirit — Novice after a couple of runs, Maestro a long-term goal.
export const RANKS: Rank[] = [
  { xp: 0, name: 'Beginner' },
  { xp: 50, name: 'Novice' },
  { xp: 150, name: 'Apprentice' },
  { xp: 350, name: 'Student' },
  { xp: 700, name: 'Musician' },
  { xp: 1200, name: 'Performer' },
  { xp: 2000, name: 'Artist' },
  { xp: 3200, name: 'Soloist' },
  { xp: 5000, name: 'Virtuoso' },
  { xp: 8000, name: 'Master' },
  { xp: 12000, name: 'Maestro' },
]

export interface RankInfo {
  level: number // 1-based
  name: string
  xpInto: number // xp earned past the current rank's threshold
  xpForNext: number // span from current rank to the next (Infinity at max)
  nextName: string | null
  /** Fraction toward the next rank, 0..1 (1 at max rank). */
  progress: number
}

export function rankForXp(xp: number): RankInfo {
  let i = 0
  for (let k = 0; k < RANKS.length; k++) {
    if (xp >= RANKS[k].xp) i = k
  }
  const cur = RANKS[i]
  const next = RANKS[i + 1]
  const xpInto = xp - cur.xp
  const xpForNext = next ? next.xp - cur.xp : Infinity
  return {
    level: i + 1,
    name: cur.name,
    xpInto,
    xpForNext,
    nextName: next ? next.name : null,
    progress: next ? Math.min(1, xpInto / xpForNext) : 1,
  }
}

/**
 * Gems earned for a finished run — rewards score, mastery and clean play.
 * Mirrors the flagship's gemsForRun shape (score-scaled + accuracy + mastery
 * bonuses) so the currency feels identical across the whole Staff Commander suite.
 */
export function gemsForRun(score: number, mastered: boolean, accuracy: number): number {
  let g = Math.round(score / 120)
  if (accuracy >= 0.95) g += 5
  if (mastered) g += 25
  return g
}

// ── Achievements ──────────────────────────────────────────────────────────
// Shared across all 3 games. `gameId` lets a game contribute game-specific
// achievements while the generic ones (xp/gems/streak/accuracy) apply suite-wide.
export interface AchStats {
  /** Which game produced this run (echo | detective | builder). */
  gameId: string
  /** Stage / level reached this run (game-defined). */
  stageReached: number
  /** 0..1 onset accuracy this run. */
  accuracy: number
  /** Notes / taps judged this run. */
  totalNotes: number
  /** Best consecutive streak this run. */
  bestStreak: number
  /** Did the player master a level this run? */
  masteredThisRun: boolean
  /** Wrong / missed judgments this run. */
  wrongThisRun: number
  /** Lifetime XP (after this run). */
  xp: number
  /** Lifetime gems (after this run). */
  gems: number
  /** Total levels mastered (lifetime, across all games). */
  masteredCount: number
  /** Distinct games played at least once (lifetime). */
  gamesPlayedCount: number
}

export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  test: (s: AchStats) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-beat', name: 'First Beat', desc: 'Finish your first run', icon: '🎵', test: () => true },
  { id: 'perfect-ear', name: 'Perfect Ear', desc: 'Finish a run at 100% (12+ notes)', icon: '🎯', test: (s) => s.accuracy >= 1 && s.totalNotes >= 12 },
  { id: 'in-the-pocket', name: 'In the Pocket', desc: 'Reach a 15 streak', icon: '🔥', test: (s) => s.bestStreak >= 15 },
  { id: 'top-class', name: 'Top of the Class', desc: 'Master a level', icon: '⭐', test: (s) => s.masteredCount >= 1 },
  { id: 'maestro-track', name: 'On Track', desc: 'Master 3 levels', icon: '🎓', test: (s) => s.masteredCount >= 3 },
  { id: 'triple-threat', name: 'Triple Threat', desc: 'Play all 3 games', icon: '🎮', test: (s) => s.gamesPlayedCount >= 3 },
  { id: 'flawless', name: 'Flawless', desc: 'Master a level with no mistakes', icon: '🛡️', test: (s) => s.masteredThisRun && s.wrongThisRun === 0 },
  { id: 'dedicated', name: 'Dedicated', desc: 'Earn 5,000 XP', icon: '💪', test: (s) => s.xp >= 5000 },
  { id: 'collector', name: 'Collector', desc: 'Bank 100 gems', icon: '💎', test: (s) => s.gems >= 100 },
]

/** Returns the ids of achievements newly satisfied (not already owned). */
export function checkAchievements(stats: AchStats, have: string[]): string[] {
  return ACHIEVEMENTS.filter((a) => !have.includes(a.id) && a.test(stats)).map((a) => a.id)
}

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

// ── Daily challenges ───────────────────────────────────────────────────────
export type DailyType = 'notes' | 'accuracy90' | 'stage' | 'streak' | 'games'

export interface DailyChallenge {
  id: string
  type: DailyType
  desc: string
  target: number
  reward: number // gems
}

function seedFromKey(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Stable date key (local), e.g. "2026-06-24". */
export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Three challenges for the given day, deterministic from the date. */
export function dailyChallenges(key: string): DailyChallenge[] {
  const seed = seedFromKey(key)
  const pick = (arr: number[], salt: number) => arr[(Math.imul(seed ^ (salt * 2654435761), 2246822519) >>> 0) % arr.length]
  const notesT = pick([20, 30, 40], 1)
  const stageT = pick([3, 4, 5], 2)
  const streakT = pick([8, 12, 15], 3)
  const gamesT = pick([2, 3, 4], 4)
  const all: DailyChallenge[] = [
    { id: 'd-notes', type: 'notes', desc: `Nail ${notesT} notes today`, target: notesT, reward: 30 },
    { id: 'd-acc', type: 'accuracy90', desc: 'Finish a run at 90%+ accuracy', target: 1, reward: 25 },
    { id: 'd-stage', type: 'stage', desc: `Reach Stage ${stageT}`, target: stageT, reward: 25 },
    { id: 'd-streak', type: 'streak', desc: `Hit a ${streakT}-streak`, target: streakT, reward: 20 },
    { id: 'd-games', type: 'games', desc: `Play ${gamesT} games`, target: gamesT, reward: 15 },
  ]
  const start = (Math.imul(seed ^ 0x9e3779b9, 2246822519) >>> 0) % all.length
  return [all[start], all[(start + 1) % all.length], all[(start + 2) % all.length]]
}

// ── Mastery gate ────────────────────────────────────────────────────────────
// Same spirit as the flagship: demonstrate the skill (a deep stage, a meaningful
// sample of notes, at high accuracy) — games pass `mastered` into recordRun, but
// these constants are exported so all three games gate identically if they choose
// to compute mastery themselves.
export const MASTERY_STAGE = 4
export const MASTERY_MIN_NOTES = 30
export const MASTERY_ACCURACY = 0.9
export const START_LIVES = 3
/** XP bonus granted when a level is mastered. */
export const MASTERY_XP_BONUS = 50
