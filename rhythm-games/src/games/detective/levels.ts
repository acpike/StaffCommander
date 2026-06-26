// RHYTHM DETECTIVE — level definitions + progression.
//
// Each level is a "case file" using ONE of three identification mechanics:
//   - spot   : Spot-the-Difference (hear A then A', tap which beat changed)
//   - lineup : Catch the Impostor (hear TARGET, pick the matching suspect)
//   - alarm  : Forbidden Rhythm (memorize a wanted pattern, catch it in a sequence)
//
// Difficulty rises across the case files: more similar distractors, faster
// tempo, higher cell tiers, longer patterns. Mastery is reached at the final
// case (stage MASTERY_STAGE) with accuracy >= MASTERY_ACCURACY.

export type Mechanic = 'spot' | 'lineup' | 'alarm'

export interface LevelDef {
  /** Stable id — key into store progress. */
  id: string
  /** 1-based stage number (used for mastery gating). */
  stage: number
  /** Display name of the "case". */
  name: string
  /** One-line case brief. */
  brief: string
  mechanic: Mechanic
  /** Cell-tier index (0..5) used to generate patterns. */
  tier: number
  /** Tempo for previews. */
  bpm: number
  /** Bars per pattern. */
  bars: number
  /** Questions to clear the case. */
  questions: number
  /** Difficulty 0..1 — drives distractor similarity + tempo feel. */
  difficulty: number
  /** Icon glyph for the case card. */
  icon: string
}

export const LEVELS: LevelDef[] = [
  {
    id: 'case-1',
    stage: 1,
    name: 'Rookie Beat',
    brief: 'Two takes of the same phrase. Spot the single beat that changed.',
    mechanic: 'spot',
    tier: 1,
    bpm: 84,
    bars: 1,
    questions: 5,
    difficulty: 0.1,
    icon: '🔍',
  },
  {
    id: 'case-2',
    stage: 1,
    name: 'The Lineup',
    brief: 'Memorize the wanted rhythm, then pick the suspect that matches.',
    mechanic: 'lineup',
    tier: 2,
    bpm: 88,
    bars: 1,
    questions: 5,
    difficulty: 0.2,
    icon: '🕵️',
  },
  {
    id: 'case-3',
    stage: 2,
    name: 'Forbidden Groove',
    brief: 'A pattern is wanted. Sound the alarm only when it shows up.',
    mechanic: 'alarm',
    tier: 2,
    bpm: 92,
    bars: 1,
    questions: 6,
    difficulty: 0.3,
    icon: '🚨',
  },
  {
    id: 'case-4',
    stage: 2,
    name: 'Eighth Trouble',
    brief: 'Eighth notes hide the change. Tap the beat slot that differs.',
    mechanic: 'spot',
    tier: 2,
    bpm: 96,
    bars: 1,
    questions: 6,
    difficulty: 0.45,
    icon: '🔎',
  },
  {
    id: 'case-5',
    stage: 3,
    name: 'Crowded Room',
    brief: 'Four suspects, sharper disguises. Match the target by ear.',
    mechanic: 'lineup',
    tier: 3,
    bpm: 100,
    bars: 1,
    questions: 6,
    difficulty: 0.6,
    icon: '🎭',
  },
  {
    id: 'case-6',
    stage: 3,
    name: 'Syncopation Sting',
    brief: 'Off-beats and rests. Catch the forbidden groove in the queue.',
    mechanic: 'alarm',
    tier: 3,
    bpm: 104,
    bars: 1,
    questions: 7,
    difficulty: 0.72,
    icon: '⚡',
  },
  {
    id: 'case-7',
    stage: 4,
    name: 'Sixteenth Heist',
    brief: 'Two long phrases, sixteenth-note detail. Find the one swapped beat.',
    mechanic: 'spot',
    tier: 4,
    bpm: 108,
    bars: 2,
    questions: 7,
    difficulty: 0.85,
    icon: '💎',
  },
  {
    id: 'case-8',
    stage: 4,
    name: 'Master Detective',
    brief: 'The final case. Pick the impostor from a near-perfect lineup.',
    mechanic: 'lineup',
    tier: 4,
    bpm: 112,
    bars: 2,
    questions: 8,
    difficulty: 1,
    icon: '🏆',
  },
]

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function nextLevelId(id: string): string | null {
  const i = LEVELS.findIndex((l) => l.id === id)
  if (i < 0 || i + 1 >= LEVELS.length) return null
  return LEVELS[i + 1].id
}

/** The first case is always unlocked. */
export const FIRST_LEVEL_ID = LEVELS[0].id
