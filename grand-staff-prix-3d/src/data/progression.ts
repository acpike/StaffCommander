// Progression: XP → named ranks, and gems earned per run. Values follow the
// README's level curve so ranks feel earned.

export interface Rank {
  xp: number
  name: string
}

export const RANKS: Rank[] = [
  { xp: 0, name: 'Beginner' },
  { xp: 100, name: 'Novice' },
  { xp: 300, name: 'Apprentice' },
  { xp: 600, name: 'Student' },
  { xp: 1000, name: 'Musician' },
  { xp: 1500, name: 'Performer' },
  { xp: 2200, name: 'Artist' },
  { xp: 3200, name: 'Soloist' },
  { xp: 5000, name: 'Virtuoso' },
  { xp: 9000, name: 'Master' },
  { xp: 15000, name: 'Maestro' },
]

export interface RankInfo {
  level: number // 1-based
  name: string
  xpInto: number // xp earned past the current rank's threshold
  xpForNext: number // span from current rank to the next (Infinity at max)
  nextName: string | null
}

export function rankForXp(xp: number): RankInfo {
  let i = 0
  for (let k = 0; k < RANKS.length; k++) {
    if (xp >= RANKS[k].xp) i = k
  }
  const cur = RANKS[i]
  const next = RANKS[i + 1]
  return {
    level: i + 1,
    name: cur.name,
    xpInto: xp - cur.xp,
    xpForNext: next ? next.xp - cur.xp : Infinity,
    nextName: next ? next.name : null,
  }
}

/** Gems earned for a finished run — rewards score, mastery and clean play. */
export function gemsForRun(score: number, mastered: boolean, accuracy: number): number {
  let g = Math.round(score / 400)
  if (accuracy >= 0.95) g += 5
  if (mastered) g += 25
  return g
}

// ── Achievements ──────────────────────────────────────────────────────────
export interface AchStats {
  stageReached: number
  accuracy: number
  totalNotes: number
  bestStreak: number
  masteredThisRun: boolean
  wrongThisRun: number
  xp: number
  gems: number
  masteredCount: number
}

export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  test: (s: AchStats) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-game', name: 'First Lap', desc: 'Finish your first race', icon: '🏁', test: () => true },
  { id: 'sharp-ear', name: 'Sharp Ear', desc: 'Finish a run at 100% (12+ notes)', icon: '🎯', test: (s) => s.accuracy >= 1 && s.totalNotes >= 12 },
  { id: 'on-fire', name: 'On Fire', desc: 'Reach a 15 streak', icon: '🔥', test: (s) => s.bestStreak >= 15 },
  { id: 'top-class', name: 'Top of the Class', desc: 'Master a level', icon: '⭐', test: (s) => s.masteredCount >= 1 },
  { id: 'scholar', name: 'Scholar', desc: 'Master 3 levels', icon: '🎓', test: (s) => s.masteredCount >= 3 },
  { id: 'speedster', name: 'Speedster', desc: 'Reach Stage 6', icon: '⚡', test: (s) => s.stageReached >= 6 },
  { id: 'untouchable', name: 'Untouchable', desc: 'Master a level with no mistakes', icon: '🛡️', test: (s) => s.masteredThisRun && s.wrongThisRun === 0 },
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
