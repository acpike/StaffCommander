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
