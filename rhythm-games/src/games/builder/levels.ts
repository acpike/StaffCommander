// Beat Builder — level definitions. Each level controls which beat-cell BLOCKS
// appear in the palette (via CELL_TIERS), the meter, bar count, and tempo.
// Progression climbs from a steady quarter-note pulse to sixteenths, syncopation,
// dotted figures, and 3/4 + 6/8 meters.

import { CELL_TIERS, CELLS, type BeatCell } from '../../shared/audio/patterns'

export interface BuilderLevel {
  id: string
  /** Display index (1-based) for the stage number. */
  stage: number
  title: string
  subtitle: string
  /** Cells available in the palette for this level. */
  palette: BeatCell[]
  /** Cells used to GENERATE the target (subset / same as palette). */
  generator: BeatCell[]
  bars: number
  beatsPerBar: number
  beatUnit: number
  bpm: number
  /** id of the level this one unlocks on mastery (or null = end). */
  unlockNext: string | null
}

// Helper: dedupe a cell list by id (keeps order).
function uniq(cells: BeatCell[]): BeatCell[] {
  const seen = new Set<string>()
  const out: BeatCell[] = []
  for (const c of cells) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      out.push(c)
    }
  }
  return out
}

export const LEVELS: BuilderLevel[] = [
  {
    id: 'l1',
    stage: 1,
    title: 'Steady Pulse',
    subtitle: 'Quarters & halves in 4/4',
    palette: uniq([...CELL_TIERS[0], CELLS.whole]),
    generator: CELL_TIERS[0],
    bars: 1,
    beatsPerBar: 4,
    beatUnit: 4,
    bpm: 76,
    unlockNext: 'l2',
  },
  {
    id: 'l2',
    stage: 2,
    title: 'Rest & Hold',
    subtitle: 'Add whole notes & quarter rests',
    palette: uniq([...CELL_TIERS[1], CELLS.whole]),
    generator: CELL_TIERS[1],
    bars: 1,
    beatsPerBar: 4,
    beatUnit: 4,
    bpm: 84,
    unlockNext: 'l3',
  },
  {
    id: 'l3',
    stage: 3,
    title: 'Eighth Notes',
    subtitle: 'ta-di splits enter the loop',
    palette: uniq([...CELL_TIERS[2], CELLS.whole]),
    generator: CELL_TIERS[2],
    bars: 1,
    beatsPerBar: 4,
    beatUnit: 4,
    bpm: 90,
    unlockNext: 'l4',
  },
  {
    id: 'l4',
    stage: 4,
    title: 'Off the Beat',
    subtitle: 'Syncopation: rests & offbeat eighths (2 bars)',
    palette: uniq([...CELL_TIERS[3], CELLS.half]),
    generator: CELL_TIERS[3],
    bars: 2,
    beatsPerBar: 4,
    beatUnit: 4,
    bpm: 92,
    unlockNext: 'l5',
  },
  {
    id: 'l5',
    stage: 5,
    title: 'Sixteenth Lab',
    subtitle: 'ta-ka-di-mi & mixed sixteenths (2 bars)',
    palette: uniq([...CELL_TIERS[4], CELLS.quarter]),
    generator: CELL_TIERS[4],
    bars: 2,
    beatsPerBar: 4,
    beatUnit: 4,
    bpm: 88,
    unlockNext: 'l6',
  },
  {
    id: 'l6',
    stage: 6,
    title: 'Waltz Time',
    subtitle: '3/4 meter — three beats to a bar (2 bars)',
    palette: uniq([CELLS.quarter, CELLS.twoEighths, CELLS.half, CELLS.dottedHalf, CELLS.quarterRest]),
    generator: uniq([CELLS.quarter, CELLS.twoEighths, CELLS.half, CELLS.quarterRest]),
    bars: 2,
    beatsPerBar: 3,
    beatUnit: 4,
    bpm: 96,
    unlockNext: 'l7',
  },
  {
    id: 'l7',
    stage: 7,
    title: 'Dotted & Compound',
    subtitle: 'Dotted figures + sixteenths, fast 4/4 (2 bars)',
    palette: uniq([...CELL_TIERS[5], CELLS.quarterRest, CELLS.half]),
    generator: CELL_TIERS[5],
    bars: 2,
    beatsPerBar: 4,
    beatUnit: 4,
    bpm: 100,
    unlockNext: null,
  },
]

export const FIRST_LEVEL_ID = LEVELS[0].id

export function levelById(id: string): BuilderLevel | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function levelIndex(id: string): number {
  return LEVELS.findIndex((l) => l.id === id)
}
