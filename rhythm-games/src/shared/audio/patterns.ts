// Rhythm data model — the shared "vocabulary" all 3 games speak.
//
// A Pattern is an ordered list of beat-CELLS. Each cell spans a whole number of
// musical sub-events (notes and/or rests) over some number of beats. We model
// the cell as a reusable "word" (Gordon / Takadimi pedagogy: patterns are words),
// and we also flatten patterns into individual ONSET events (the things a player
// taps / the things we judge) with absolute beat positions.
//
// Beats → seconds is always `beats * 60 / bpm`. Nothing here reads a clock; the
// engine converts to absolute audio-clock time at playback.

/** A single sounding/silent event inside a cell. */
export interface CellNote {
  /** Offset from the cell's start, in beats. */
  beat: number
  /** Duration in beats (for hold notes / rest length). */
  beats: number
  /** True = silence (a rest): no onset, player must NOT tap. */
  isRest: boolean
  /**
   * True = this sounding note is the CONTINUATION of a tie (no fresh attack):
   * the note began earlier and is held through this event. Additive metadata —
   * older consumers can ignore it; it still flattens as a sounding onset so
   * timing maths stays backward-compatible, but notation/judging can render a
   * tie and skip expecting a new tap for it. Undefined/false on normal notes.
   */
  isTie?: boolean
}

/** A named beat-cell — a reusable rhythmic "word". */
export interface BeatCell {
  id: string
  /** Human label, e.g. "two eighths". */
  name: string
  /** Takadimi syllables for the sounding notes, in order (e.g. ["ta","di"]). */
  syllables: string[]
  /** Total beats the cell occupies. */
  beats: number
  /** The notes/rests that make up the cell. */
  notes: CellNote[]
  /**
   * Which beat-space this cell is authored in:
   *  - 'simple'  (default): quarter-beat units — the `beats` count is in
   *    quarter-note beats (e.g. dotted-half = 3 quarter beats). Belongs in
   *    simple meters (4/4, 3/4, …).
   *  - 'compound': eighth-note units — `beats` is in eighths and one FELT beat
   *    (a dotted quarter) is 3 of them. Belongs ONLY in compound meters.
   * Additive metadata: undefined ⇒ 'simple', so older cells/consumers are
   * unchanged. We use it to keep simple + compound cells from ever mixing in
   * one bar (the core rule), since both spaces can produce `beats === 3`.
   */
  space?: 'simple' | 'compound'
}

/** A built rhythm: an ordered list of cells plus meter + tempo context. */
export interface Pattern {
  /** Beats per bar (numerator of the time signature). */
  beatsPerBar: number
  /** Which note value gets the beat (denominator). 4 = quarter. */
  beatUnit: number
  /** The ordered cells that make up the pattern. */
  cells: BeatCell[]
}

/** A flattened, absolutely-positioned onset — what the engine schedules + judges. */
export interface NoteEvent {
  /** Index among sounding onsets (rests excluded). */
  index: number
  /** Absolute position from pattern start, in beats. */
  beat: number
  /** Duration, in beats. */
  beats: number
  /** Takadimi syllable for this onset. */
  syllable: string
  /** True = rest (no onset; never scheduled or judged as a tap). */
  isRest: boolean
  /** True = sounding note carried in by a tie (no fresh attack). Additive. */
  isTie?: boolean
}

// ── Beat-cell library ───────────────────────────────────────────────────────
// Single-beat (and multi-beat) cells in 4/4-style quarter-beat space. Takadimi
// labels: ta (beat), ta-di (two eighths split), ta-ka-di-mi (four sixteenths).
// Kodály equivalents in the names where helpful.

export const CELLS = {
  quarter: cell('quarter', 'quarter (ta)', ['ta'], 1, [n(0, 1)]),
  twoEighths: cell('two-eighths', 'two eighths (ta-di)', ['ta', 'di'], 1, [n(0, 0.5), n(0.5, 0.5)]),
  fourSixteenths: cell('four-sixteenths', 'four sixteenths (ta-ka-di-mi)', ['ta', 'ka', 'di', 'mi'], 1, [
    n(0, 0.25),
    n(0.25, 0.25),
    n(0.5, 0.25),
    n(0.75, 0.25),
  ]),
  eighthTwoSixteenths: cell('eighth-two-sixteenths', 'eighth + two sixteenths (ta-di-mi)', ['ta', 'di', 'mi'], 1, [
    n(0, 0.5),
    n(0.5, 0.25),
    n(0.75, 0.25),
  ]),
  twoSixteenthsEighth: cell('two-sixteenths-eighth', 'two sixteenths + eighth (ta-ka-di)', ['ta', 'ka', 'di'], 1, [
    n(0, 0.25),
    n(0.25, 0.25),
    n(0.5, 0.5),
  ]),
  dottedEighthSixteenth: cell('dotted-eighth-sixteenth', 'dotted eighth + sixteenth (ta..mi)', ['ta', 'mi'], 1, [
    n(0, 0.75),
    n(0.75, 0.25),
  ]),
  // dotted-quarter + eighth (long-short across TWO quarter beats): ta . . di.
  // Two sounding onsets: a dotted-quarter (1.5 beats) then an eighth (0.5).
  dottedQuarterEighth: cell('dotted-quarter-eighth', 'dotted quarter + eighth (ta..di)', ['ta', 'di'], 2, [
    n(0, 1.5),
    n(1.5, 0.5),
  ]),
  // eighth-note TRIPLET: three equal onsets across ONE simple (quarter) beat.
  // Takadimi triplet syllables: ta-ki-da (one-third of a beat each).
  eighthTriplet: cell('eighth-triplet', 'eighth-note triplet (ta-ki-da)', ['ta', 'ki', 'da'], 1, [
    n(0, 1 / 3),
    n(1 / 3, 1 / 3),
    n(2 / 3, 1 / 3),
  ]),
  half: cell('half', 'half note (ta-a)', ['ta'], 2, [n(0, 2)]),
  dottedHalf: cell('dotted-half', 'dotted half (ta-a-a)', ['ta'], 3, [n(0, 3)]),
  whole: cell('whole', 'whole note (ta-a-a-a)', ['ta'], 4, [n(0, 4)]),
  quarterRest: cell('quarter-rest', 'quarter rest', [], 1, [r(0, 1)]),
  halfRest: cell('half-rest', 'half rest', [], 2, [r(0, 2)]),
  wholeRest: cell('whole-rest', 'whole rest', [], 4, [r(0, 4)]),
  eighthRest: cell('eighth-rest', 'eighth rest', [], 0.5, [r(0, 0.5)]),
  // a beat that is "eighth note then eighth rest"
  eighthAndRest: cell('eighth-and-rest', 'eighth + eighth rest (ta-_)', ['ta'], 1, [n(0, 0.5), r(0.5, 0.5)]),
  // syncopated: eighth-rest then eighth (off-beat)
  restEighth: cell('rest-eighth', 'eighth rest + eighth (_-di)', ['di'], 1, [r(0, 0.5), n(0.5, 0.5)]),

  // ── Tie: a beat sustained from a note that began in the previous beat ──────
  // A single sounding note that spans the whole beat but carries NO new attack —
  // it is the continuation (tie) of the prior note. We model the "tied-into"
  // beat as a held continuation: one sounding note, beat-long, marked as a tie
  // so the engine/notation can render a tie and NOT expect a fresh tap onset.
  // (Kept as a normal sounding note for backward-compat flatten/onsets; the
  // `isTie` flag is additive metadata that older consumers simply ignore.)
  tiedQuarter: tieCell('tied-quarter', 'tied quarter (—a)', 1, [tieNote(0, 1)]),
  // A whole beat of sustain that is the tail of a syncopation: eighth tap on the
  // off-beat tied across the barline-feel — sounded eighth + tied eighth.
  syncopatedTie: cell('syncopated-tie', 'syncopation tie (_-di-—)', ['di'], 1, [
    r(0, 0.5),
    tieFrom(n(0.5, 0.5)),
  ]),

  // ── Compound cells (eighth-unit space: one FELT beat = dotted-quarter = 3) ──
  // A felt beat in compound meter is a dotted-quarter spanning three eighth-
  // units. These cells are authored in EIGHTH units so a 6/8 bar (6 eighths) =
  // two of these felt-beat groups, 9/8 = three, 12/8 = four. NEVER mix these
  // with the simple (quarter-space) cells in one bar.
  compoundFeltBeat: compoundCell('compound-felt-beat', 'compound felt beat — dotted quarter (ta)', ['ta'], 3, [n(0, 3)]),
  compoundDivision: compoundCell('compound-division', 'compound division — three eighths (ta-ki-da)', ['ta', 'ki', 'da'], 3, [
    n(0, 1),
    n(1, 1),
    n(2, 1),
  ]),
  // quarter + eighth WITHIN the 3-group (long-short): ta . da
  compoundQuarterEighth: compoundCell('compound-quarter-eighth', 'compound quarter + eighth (ta . da)', ['ta', 'da'], 3, [
    n(0, 2),
    n(2, 1),
  ]),
  // eighth + quarter within the 3-group (short-long): ta . . — ta then a tied
  // pair; two sounding onsets, ta-ki with ki held: ta then a two-eighth note.
  compoundEighthQuarter: compoundCell('compound-eighth-quarter', 'compound eighth + quarter (ta-ki .)', ['ta', 'ki'], 3, [
    n(0, 1),
    n(1, 2),
  ]),
  // compound eighth rest then two eighths within the 3-group (_-ki-da)
  compoundEighthRest: compoundCell('compound-eighth-rest', 'compound eighth rest (_-ki-da)', ['ki', 'da'], 3, [
    r(0, 1),
    n(1, 1),
    n(2, 1),
  ]),
  // compound felt-beat rest: a whole dotted-quarter of silence (one felt beat off)
  compoundFeltRest: compoundCell('compound-felt-rest', 'compound felt-beat rest', [], 3, [r(0, 3)]),
} as const

export type CellId = keyof typeof CELLS

/** All cells, as a flat array (for pickers / random generation). */
export const ALL_CELLS: BeatCell[] = Object.values(CELLS)

/** Curated, difficulty-ordered cell groups for level generation. */
export const CELL_TIERS: BeatCell[][] = [
  [CELLS.quarter, CELLS.half], // 1: steady pulse, long notes
  [CELLS.quarter, CELLS.half, CELLS.whole, CELLS.quarterRest], // 2: + whole + rest
  [CELLS.quarter, CELLS.twoEighths, CELLS.quarterRest, CELLS.half], // 3: + eighths
  [CELLS.quarter, CELLS.twoEighths, CELLS.eighthAndRest, CELLS.restEighth, CELLS.quarterRest], // 4: syncopation seeds
  [CELLS.twoEighths, CELLS.fourSixteenths, CELLS.eighthTwoSixteenths, CELLS.twoSixteenthsEighth], // 5: sixteenths
  [CELLS.dottedEighthSixteenth, CELLS.fourSixteenths, CELLS.twoEighths, CELLS.quarter], // 6: dotted
]

// ── Construction helpers ─────────────────────────────────────────────────────
function n(beat: number, beats: number): CellNote {
  return { beat, beats, isRest: false }
}
function r(beat: number, beats: number): CellNote {
  return { beat, beats, isRest: true }
}
function cell(id: string, name: string, syllables: string[], beats: number, notes: CellNote[]): BeatCell {
  return { id, name, syllables, beats, notes }
}
/**
 * A compound-space cell: `beats`/note durations are in EIGHTH units (one felt
 * beat = a dotted quarter = 3). Tagged `space: 'compound'` so it is never mixed
 * into a simple-meter bar.
 */
function compoundCell(id: string, name: string, syllables: string[], beats: number, notes: CellNote[]): BeatCell {
  return { id, name, syllables, beats, notes, space: 'compound' }
}
/** A sounding note that is the continuation of a tie (no fresh attack). */
function tieNote(beat: number, beats: number): CellNote {
  return { beat, beats, isRest: false, isTie: true }
}
/** Mark an existing sounding note as tied-in (continuation). */
function tieFrom(note: CellNote): CellNote {
  return { ...note, isTie: true }
}
/**
 * A cell made of tied (continuation) notes only — it sustains but carries no
 * new attack, so it has no syllables of its own (the syllable belongs to the
 * note it is tied from, in the previous cell).
 */
function tieCell(id: string, name: string, beats: number, notes: CellNote[]): BeatCell {
  return { id, name, syllables: [], beats, notes }
}

/** Look up a cell by id (from CELLS), or undefined. */
export function cellById(id: string): BeatCell | undefined {
  return ALL_CELLS.find((c) => c.id === id)
}

/** Build a Pattern from a list of cells (defaults to 4/4). */
export function pattern(cells: BeatCell[], beatsPerBar = 4, beatUnit = 4): Pattern {
  return { cells, beatsPerBar, beatUnit }
}

/** Total beats spanned by a pattern. */
export function patternBeats(p: Pattern): number {
  return p.cells.reduce((sum, c) => sum + c.beats, 0)
}

/**
 * Flatten a pattern into absolutely-positioned onset events (including rests,
 * flagged). Sounding onsets get a sequential `index`; rests get index -1.
 */
export function flatten(p: Pattern): NoteEvent[] {
  const events: NoteEvent[] = []
  let cursor = 0 // beats elapsed
  let onsetIdx = 0
  for (const c of p.cells) {
    let sylIdx = 0
    for (const note of c.notes) {
      const syllable = note.isRest ? '' : c.syllables[sylIdx] ?? 'ta'
      if (!note.isRest) sylIdx++
      events.push({
        index: note.isRest ? -1 : onsetIdx,
        beat: cursor + note.beat,
        beats: note.beats,
        syllable,
        isRest: note.isRest,
        // Propagate the tie flag: a sounding note carried in by a tie has no
        // fresh attack. Additive metadata — only set when present so older
        // consumers (which ignore it) see identical events otherwise.
        ...(note.isTie ? { isTie: true } : {}),
      })
      if (!note.isRest) onsetIdx++
    }
    cursor += c.beats
  }
  return events
}

/** Just the sounding onsets (rests removed), re-indexed 0..n. */
export function onsets(p: Pattern): NoteEvent[] {
  return flatten(p)
    .filter((e) => !e.isRest)
    .map((e, i) => ({ ...e, index: i }))
}

/** Number of tappable onsets in a pattern. */
export function onsetCount(p: Pattern): number {
  return onsets(p).length
}

/** Beats → seconds at a given BPM (beat = the quarter unless beatUnit differs). */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm
}

// ── Meter helpers ─────────────────────────────────────────────────────────────
// A meter is COMPOUND when the beat unit is an eighth (or shorter) AND the
// numerator is a multiple of 3 greater than 3 (6/8, 9/8, 12/8). Everything else
// is SIMPLE (4/4, 3/4, 2/4, cut 2/2) or ODD (5/8, 7/8). Compound felt beats are
// dotted-quarters = three eighth-units; we generate per felt beat for those.

/** True if (beatsPerBar/beatUnit) is a compound meter: 6/8, 9/8, 12/8, …. */
export function isCompound(beatsPerBar: number, beatUnit: number): boolean {
  return beatUnit === 8 && beatsPerBar % 3 === 0 && beatsPerBar > 3
}

/** True if the meter is an odd / additive eighth meter: 5/8, 7/8. */
export function isOddMeter(beatsPerBar: number, beatUnit: number): boolean {
  return beatUnit === 8 && !isCompound(beatsPerBar, beatUnit) && beatsPerBar % 2 === 1 && beatsPerBar >= 5
}

/**
 * Beat positions (in bar units) where the beat-grid should draw a divider —
 * one per FELT beat. Positions are in the SAME unit space the bar's cells use:
 *  - simple (denom 4): quarter-units → 4/4 [0,1,2,3], 3/4 [0,1,2], 2/4 [0,1]
 *  - cut time (2/2):   half-units    → [0,1]   (two felt half-note beats)
 *  - compound (denom 8): eighth-units, felt dotted-quarter beats →
 *      6/8 [0,3], 9/8 [0,3,6], 12/8 [0,3,6,9]
 *  - odd (5/8, 7/8): eighth-units, grouped 2+3 / 3+2+2 →
 *      5/8 [0,2] (2+3), 7/8 [0,2,4] (2+2+3)
 */
export function feltBeats(beatsPerBar: number, beatUnit: number): number[] {
  if (isCompound(beatsPerBar, beatUnit)) {
    // every dotted-quarter (3 eighth-units)
    const out: number[] = []
    for (let p = 0; p < beatsPerBar; p += 3) out.push(p)
    return out
  }
  if (isOddMeter(beatsPerBar, beatUnit)) {
    // additive grouping: a leading 2+2+… then a final 3 (so 5/8 = 2+3,
    // 7/8 = 2+2+3). Common default; renderable as felt-beat dividers.
    const groups = oddGroupSizes(beatsPerBar)
    const out: number[] = []
    let pos = 0
    for (const g of groups) {
      out.push(pos)
      pos += g
    }
    return out
  }
  if (beatUnit === 2) {
    // cut time 2/2 (or n/2): each beat is a half-note → bar uses half-units,
    // one divider per beat.
    return Array.from({ length: beatsPerBar }, (_, i) => i)
  }
  // simple meters with a quarter (or whole-note) beat: one divider per beat.
  return Array.from({ length: beatsPerBar }, (_, i) => i)
}

/** Group sizes for an odd eighth meter: 5/8 → [2,3], 7/8 → [2,2,3]. */
function oddGroupSizes(beatsPerBar: number): number[] {
  const groups: number[] = []
  let rem = beatsPerBar
  while (rem > 3) {
    groups.push(2)
    rem -= 2
  }
  groups.push(rem) // final group of 2 or 3 (odd numerator → always lands 3, or 2)
  return groups
}

/**
 * Generate a random n-bar pattern that fills each bar EXACTLY to its meter.
 *
 * Backward-compatible: called as `generatePattern(tier, { bars, beatsPerBar,
 * beatUnit, rng })` it behaves exactly as before for SIMPLE quarter-beat meters
 * (greedy fill to `bars * beatsPerBar` quarter-units).
 *
 * For COMPOUND meters (6/8, 9/8, 12/8) it generates per FELT BEAT — a dotted-
 * quarter group of three eighth-units — using only the COMPOUND cells (those
 * whose `beats` is 3 in eighth-unit space), so a 6/8 bar = 2 felt beats, 9/8 =
 * 3, 12/8 = 4. For ODD meters (5/8, 7/8) it fills each additive group (2 or 3
 * eighth-units) from cells that fit that group. Bars ALWAYS sum exactly.
 *
 * The `tier` argument is the allowed-cells list. If it contains no cell that
 * fits a compound/odd group, we fall back to canonical compound cells so the
 * bar still sums.
 */
export function generatePattern(
  tier: BeatCell[],
  opts: { bars?: number; beatsPerBar?: number; beatUnit?: number; rng?: () => number } = {},
): Pattern {
  const beatsPerBar = opts.beatsPerBar ?? 4
  const beatUnit = opts.beatUnit ?? 4
  const bars = opts.bars ?? 1
  const rng = opts.rng ?? Math.random

  if (isCompound(beatsPerBar, beatUnit)) {
    return generateCompound(tier, bars, beatsPerBar, beatUnit, rng)
  }
  if (isOddMeter(beatsPerBar, beatUnit)) {
    return generateOdd(tier, bars, beatsPerBar, beatUnit, rng)
  }
  return generateSimple(tier, bars, beatsPerBar, beatUnit, rng)
}

/** SIMPLE-meter fill (unchanged behaviour): greedy to bars*beatsPerBar units. */
function generateSimple(
  tier: BeatCell[],
  bars: number,
  beatsPerBar: number,
  beatUnit: number,
  rng: () => number,
): Pattern {
  const target = bars * beatsPerBar
  const cells: BeatCell[] = []
  let used = 0
  let guard = 0
  // Simple-space cells ONLY. Compound cells are authored in eighth units (a
  // dotted-quarter felt beat = 3), so their `beats` count is not comparable to
  // the quarter-beat space a simple bar fills — letting one in would mix simple
  // + compound in a single bar (e.g. a 3-eighth compound cell read as 3 quarter
  // beats in 4/4). The core rule: NEVER mix simple + compound cells in one bar.
  const simpleTier = tier.filter((c) => c.space !== 'compound')
  while (used < target && guard++ < 256) {
    const remaining = target - used
    const options = simpleTier.filter((c) => c.beats <= remaining)
    if (options.length === 0) {
      // pad the gap with a quarter-equivalent; fall back to a rest of the gap.
      if (remaining >= 1) {
        cells.push(CELLS.quarter)
        used += 1
      } else {
        used = target
      }
      continue
    }
    const choice = options[Math.floor(rng() * options.length)]
    cells.push(choice)
    used += choice.beats
  }
  return { cells, beatsPerBar, beatUnit }
}

/** The canonical compound cells (3 eighth-units = one felt beat). */
const COMPOUND_FELT_CELLS: BeatCell[] = [
  CELLS.compoundFeltBeat,
  CELLS.compoundDivision,
  CELLS.compoundQuarterEighth,
  CELLS.compoundEighthQuarter,
  CELLS.compoundEighthRest,
  CELLS.compoundFeltRest,
]

/**
 * COMPOUND fill: per felt beat (3 eighth-units). Each felt beat is filled by ONE
 * cell of exactly 3 eighth-units, drawn from the compound cells present in the
 * allowed list (falling back to the full compound set, never the felt-rest as a
 * sole fallback so we keep a sounding pulse).
 */
function generateCompound(
  tier: BeatCell[],
  bars: number,
  beatsPerBar: number,
  beatUnit: number,
  rng: () => number,
): Pattern {
  // Allowed compound cells = those in the tier that span exactly one felt beat,
  // plus any tier cells that are themselves felt-beat groups. Fall back to the
  // canonical compound set (minus the felt-rest) if the tier offers nothing.
  let allowed = tier.filter((c) => c.beats === 3)
  if (allowed.length === 0) allowed = COMPOUND_FELT_CELLS.filter((c) => c.id !== 'compound-felt-rest')

  const feltBeatsPerBar = beatsPerBar / 3 // 6/8 → 2, 9/8 → 3, 12/8 → 4
  const cells: BeatCell[] = []
  for (let b = 0; b < bars; b++) {
    for (let fb = 0; fb < feltBeatsPerBar; fb++) {
      cells.push(allowed[Math.floor(rng() * allowed.length)])
    }
  }
  return { cells, beatsPerBar, beatUnit }
}

/**
 * ODD (5/8, 7/8) fill: per additive group (2 or 3 eighth-units). Each group is
 * filled by a cell of exactly that size from the allowed list; if none fits we
 * use a sounding fallback (a 2- or 3-eighth note) so the group sums exactly.
 */
function generateOdd(
  tier: BeatCell[],
  bars: number,
  beatsPerBar: number,
  beatUnit: number,
  rng: () => number,
): Pattern {
  const groups = oddGroupSizes(beatsPerBar)
  const cells: BeatCell[] = []
  for (let b = 0; b < bars; b++) {
    for (const size of groups) {
      const options = tier.filter((c) => c.beats === size)
      if (options.length > 0) {
        cells.push(options[Math.floor(rng() * options.length)])
      } else if (size === 3) {
        cells.push(CELLS.compoundFeltBeat)
      } else {
        cells.push(ODD_TWO_GROUP)
      }
    }
  }
  return { cells, beatsPerBar, beatUnit }
}

/** A 2-eighth-unit sounding group for odd-meter fallback (one quarter felt). */
const ODD_TWO_GROUP: BeatCell = compoundCell('odd-two-group', 'two-eighth group (ta)', ['ta'], 2, [n(0, 2)])

/**
 * Compare two patterns by their sounding-onset timing (the thing that matters
 * pedagogically — the rhythm, not which named cell was used). Returns a match
 * report: per-onset alignment within `tolBeats`.
 */
export function comparePatterns(
  a: Pattern,
  b: Pattern,
  tolBeats = 0.05,
): { equal: boolean; matched: number; total: number } {
  const oa = onsets(a)
  const ob = onsets(b)
  let matched = 0
  const total = Math.max(oa.length, ob.length)
  const len = Math.min(oa.length, ob.length)
  for (let i = 0; i < len; i++) {
    if (Math.abs(oa[i].beat - ob[i].beat) <= tolBeats && Math.abs(oa[i].beats - ob[i].beats) <= tolBeats + 1e-6) {
      matched++
    }
  }
  return { equal: matched === total && oa.length === ob.length, matched, total }
}
