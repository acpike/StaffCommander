// Echo — level + progression definitions for Beat Battle mode.
//
// Each level is a few call-and-response rounds in a given meter, at a given BPM,
// drawing from a GROWING vocabulary of beat-cells, vs an animated opponent.
// Levels unlock in sequence as you master the previous one.
//
// This table implements ECHO-LEVEL-SYSTEM.md §3 — 10 stages, ~41 levels. The
// difficulty model is the growing MIX of rhythmic vocabulary used across
// multi-measure phrases (NOT one note-value at a time): the "easy" long values
// are taught together from the start in 2-bar mixes, and each stage adds the
// next vocabulary layer to the running set (spiral review is automatic). Each
// stage = a Feature level (new element prominent, fully scaffolded) → Practice
// levels (mixed, denser, faster, scaffolds fading) → a ★ Remix that consolidates
// and spiral-reviews earlier stages.
//
// Backward-compat: the older flat fields (`num`, `tier`, `rounds`, `difficulty`)
// are retained so existing call sites (Battle/Menu/index) keep building and
// behaving the same, while the richer fields (`stage`, `kind`, `timeSig`,
// `meter`, `feltBeats`, `cells`, `scaffold`, `spiral`) drive the new system.

import {
  CELL_TIERS,
  CELLS,
  feltBeats as computeFeltBeats,
  type BeatCell,
} from '../../shared/audio/patterns'

/** What role a level plays in its stage's rote → practice → create arc. */
export type EchoLevelKind = 'feature' | 'practice' | 'remix'

/** Simple (quarter-beat) vs compound (dotted-quarter felt-beat) meter family. */
export type EchoMeter = 'simple' | 'compound'

/** A time signature: `beats`/`unit` (e.g. {beats:6, unit:8} for 6/8). */
export interface EchoTimeSig {
  /** Numerator — beats per bar. */
  beats: number
  /** Denominator — which note value gets the beat (4 = quarter, 8 = eighth). */
  unit: number
}

/** Per-level scaffold configuration — which helpers are on and how they fade. */
export interface EchoScaffold {
  /** Beat pips (onset bubbles) lit during the CALL. */
  pips: boolean
  /** If true, the pips fade away mid-level after one clean (no-miss) round. */
  pipsFadeAfterClean: boolean
  /** Dashed beat-grid dividers at each FELT beat. */
  beatGrid: boolean
  /** Takadimi syllables shown under the pips (Feature levels of a new element). */
  syllables: boolean
}

export interface EchoLevel {
  id: string
  /** Display order / index (1-based for UI). Back-compat with the old ladder. */
  num: number
  /** Which curriculum stage (1–10) this level belongs to. */
  stage: number
  /** Role in the stage arc: feature → practice(s) → remix. */
  kind: EchoLevelKind
  title: string
  /** Flavor subtitle. */
  blurb: string
  /** Time signature for the round. */
  timeSig: EchoTimeSig
  /** Meter family — simple vs compound. */
  meter: EchoMeter
  /**
   * Felt-beat divider positions within a bar (bar-unit space), from the shared
   * patterns helper — where the beat-grid draws and where the pulse is felt.
   */
  feltBeats: number[]
  /**
   * The allowed beat-cell VOCABULARY for this level — the GROWING set per the
   * stage (older values stay in play). Generation draws only from these cells.
   */
  cells: BeatCell[]
  /** Bars per call pattern (the ramp target when the doc shows e.g. "2→4"). */
  bars: number
  /** Clap-back target tempo (BPM). */
  bpm: number
  /** Per-level scaffold helpers + fade behaviour. */
  scaffold: EchoScaffold
  /** Earlier stages a Remix spiral-reviews (empty for Feature/Practice). */
  spiral: number[]
  /** The opponent you're trading fours with. */
  opponent: { name: string; emoji: string }
  /** The level you unlock by mastering this one (or null = end of ladder). */
  unlockNext: string | null

  // ── Back-compat fields (kept so existing call sites are unchanged) ──────────
  /**
   * Legacy CELL_TIERS index. Retained for any consumer that still references it;
   * new code should use `cells` / `cellsForLevel`. Roughly tracks stage depth.
   */
  tier: number
  /** How many call-and-response rounds to clear the level. */
  rounds: number
  /** Judging difficulty 0..1 → tightenWindows. Ramps with stage/level. */
  difficulty: number
}

// ── Vocabulary: the growing set, accumulated stage by stage ───────────────────
// Each stage ADDS its new cells to everything before it (spiral review is
// automatic). Compound stages (8–10) use the dotted-quarter felt-beat cells in
// their own eighth-unit space and are never mixed with simple-space cells.

const S1_LONG: BeatCell[] = [
  CELLS.quarter,
  CELLS.half,
  CELLS.dottedHalf,
  CELLS.whole,
  CELLS.quarterRest,
]
const S2_EIGHTHS: BeatCell[] = [...S1_LONG, CELLS.twoEighths]
const S3_SIXTEENTHS: BeatCell[] = [...S2_EIGHTHS, CELLS.fourSixteenths]
const S4_RESTS: BeatCell[] = [
  ...S3_SIXTEENTHS,
  CELLS.halfRest,
  CELLS.wholeRest,
  CELLS.eighthRest,
  CELLS.eighthAndRest,
  CELLS.restEighth,
]
const S5_GROUPS: BeatCell[] = [
  ...S4_RESTS,
  CELLS.eighthTwoSixteenths,
  CELLS.twoSixteenthsEighth,
  CELLS.dottedEighthSixteenth,
]
const S6_TRIPLETS: BeatCell[] = [...S5_GROUPS, CELLS.eighthTriplet]
const S7_DOTTED_SYNC: BeatCell[] = [
  ...S6_TRIPLETS,
  CELLS.dottedQuarterEighth,
  CELLS.tiedQuarter,
  CELLS.syncopatedTie,
]

// Compound vocabulary (eighth-unit space; one felt beat = dotted quarter = 3).
// Kept separate from the simple set — the two are never mixed in one bar.
const COMPOUND_BASE: BeatCell[] = [
  CELLS.compoundFeltBeat,
  CELLS.compoundDivision,
  CELLS.compoundQuarterEighth,
  CELLS.compoundEighthQuarter,
  CELLS.compoundEighthRest,
  CELLS.compoundFeltRest,
]

// Bongo, Echo Cat, … — one opponent per stage (doc §3 headers).
const OPP = {
  bongo: { name: 'Bongo', emoji: '🐵' },
  echoCat: { name: 'Echo Cat', emoji: '🐱' },
  djFox: { name: 'DJ Fox', emoji: '🦊' },
  funkOwl: { name: 'Funk Owl', emoji: '🦉' },
  tempoTiger: { name: 'Tempo Tiger', emoji: '🐯' },
  waltzWolf: { name: 'Waltz Wolf', emoji: '🐺' },
  metroGnome: { name: 'Metro Gnome', emoji: '🤖' },
  jigFrog: { name: 'Jig Frog', emoji: '🐸' },
  blitzDragon: { name: 'Blitz Dragon', emoji: '🐲' },
  maestro: { name: 'The Maestro', emoji: '🎼' },
} as const

// ── Level authoring helper ────────────────────────────────────────────────────
// A compact spec the table fills in; we derive `feltBeats`, the back-compat
// `num`/`rounds`/`difficulty`, and link the unlock chain afterwards.

interface LevelSpec {
  id: string
  stage: number
  kind: EchoLevelKind
  title: string
  blurb: string
  timeSig: EchoTimeSig
  meter: EchoMeter
  cells: BeatCell[]
  bars: number
  bpm: number
  scaffold: EchoScaffold
  spiral: number[]
  opponent: { name: string; emoji: string }
  /** Back-compat legacy tier index (defaults derived from stage if omitted). */
  tier: number
}

/** Full scaffold (Feature levels): pips + grid + syllables, no early fade. */
function full(beatGrid: boolean): EchoScaffold {
  return { pips: true, pipsFadeAfterClean: false, beatGrid, syllables: true }
}
/** Practice scaffold: pips that fade after a clean round, optional grid, no syllables. */
function practice(beatGrid: boolean): EchoScaffold {
  return { pips: true, pipsFadeAfterClean: true, beatGrid, syllables: false }
}
/** Remix scaffold: pips off (ear/memory); grid only kept for 16ths/compound. */
function remix(beatGrid: boolean): EchoScaffold {
  return { pips: false, pipsFadeAfterClean: false, beatGrid, syllables: false }
}

// ── The table (ECHO-LEVEL-SYSTEM.md §3) ───────────────────────────────────────
// `bars` uses the ramp TARGET where the doc shows "2→4" (the harder end). Where
// the doc lists a meter combo (e.g. "4/4 & 3/4") the primary meter drives
// generation; the combo is reflected in the blurb. Compound felt-beat dividers
// come from the shared helper.

const SPECS: LevelSpec[] = [
  // ── Stage 1 — Long Notes · 4/4 & 3/4 · 🐵 Bongo ─────────────────────────────
  {
    id: '1.1', stage: 1, kind: 'feature', tier: 0,
    title: 'Warm-Up Claps', blurb: 'Quarters & halves — find the pulse.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: [CELLS.quarter, CELLS.half], bars: 2, bpm: 66,
    scaffold: full(false), spiral: [], opponent: OPP.bongo,
  },
  {
    id: '1.2', stage: 1, kind: 'practice', tier: 1,
    title: 'Hold & Release', blurb: 'Dotted-half & whole join in — hold them long.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: [CELLS.quarter, CELLS.half, CELLS.dottedHalf, CELLS.whole], bars: 2, bpm: 72,
    scaffold: practice(false), spiral: [], opponent: OPP.bongo,
  },
  {
    id: '1.3', stage: 1, kind: 'practice', tier: 1,
    title: 'Three to the Bar', blurb: 'Dotted-half fills a 3/4 bar.',
    timeSig: { beats: 3, unit: 4 }, meter: 'simple',
    cells: [CELLS.quarter, CELLS.half, CELLS.dottedHalf], bars: 2, bpm: 72,
    scaffold: practice(false), spiral: [], opponent: OPP.bongo,
  },
  {
    id: '1.4', stage: 1, kind: 'practice', tier: 1,
    title: 'Rest Easy', blurb: 'All long notes + the quarter rest, in 4/4 & 3/4.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S1_LONG, bars: 4, bpm: 80,
    scaffold: practice(false), spiral: [], opponent: OPP.bongo,
  },
  {
    id: '1.5', stage: 1, kind: 'remix', tier: 1,
    title: '★ Long-Note Remix', blurb: 'The full long-note mix from memory.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S1_LONG, bars: 4, bpm: 78,
    scaffold: remix(false), spiral: [1], opponent: OPP.bongo,
  },

  // ── Stage 2 — Eighth Notes · 4/4 · 🐱 Echo Cat · beat-grid on ───────────────
  {
    id: '2.1', stage: 2, kind: 'feature', tier: 2,
    title: 'Split the Beat', blurb: 'Eighths (ta-di) woven into the long-note mix.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S2_EIGHTHS, bars: 2, bpm: 66,
    scaffold: full(true), spiral: [], opponent: OPP.echoCat,
  },
  {
    id: '2.2', stage: 2, kind: 'practice', tier: 2,
    title: 'Double Time', blurb: 'Denser eighths against the quarters.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S2_EIGHTHS, bars: 2, bpm: 78,
    scaffold: practice(true), spiral: [], opponent: OPP.echoCat,
  },
  {
    id: '2.3', stage: 2, kind: 'practice', tier: 2,
    title: 'Across the Bar', blurb: 'Eighths flowing across the bar line.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S2_EIGHTHS, bars: 4, bpm: 84,
    scaffold: practice(true), spiral: [], opponent: OPP.echoCat,
  },
  {
    id: '2.4', stage: 2, kind: 'remix', tier: 2,
    title: '★ Eighths Remix', blurb: 'Spiral review of Stages 1–2.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S2_EIGHTHS, bars: 4, bpm: 86,
    scaffold: remix(true), spiral: [1, 2], opponent: OPP.echoCat,
  },

  // ── Stage 3 — Sixteenth Notes · 4/4 · 🦊 DJ Fox ─────────────────────────────
  {
    id: '3.1', stage: 3, kind: 'feature', tier: 4,
    title: 'Sixteenth Spark', blurb: 'Straight sixteenths (ta-ka-di-mi) featured.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S3_SIXTEENTHS, bars: 2, bpm: 60,
    scaffold: full(true), spiral: [], opponent: OPP.djFox,
  },
  {
    id: '3.2', stage: 3, kind: 'practice', tier: 4,
    title: 'Mixed Subdivisions', blurb: '16ths, 8ths & quarters interleaved.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S3_SIXTEENTHS, bars: 2, bpm: 70,
    scaffold: practice(true), spiral: [], opponent: OPP.djFox,
  },
  {
    id: '3.3', stage: 3, kind: 'practice', tier: 4,
    title: 'Denser & Longer', blurb: 'More sixteenths over a longer phrase.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S3_SIXTEENTHS, bars: 4, bpm: 76,
    scaffold: practice(true), spiral: [], opponent: OPP.djFox,
  },
  {
    id: '3.4', stage: 3, kind: 'remix', tier: 4,
    title: '★ Sixteenth Remix', blurb: 'Spiral review of Stages 1–3.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S3_SIXTEENTHS, bars: 4, bpm: 80,
    scaffold: remix(true), spiral: [1, 2, 3], opponent: OPP.djFox,
  },

  // ── Stage 4 — Rests · 4/4 · 🦉 Funk Owl ─────────────────────────────────────
  {
    id: '4.1', stage: 4, kind: 'feature', tier: 4,
    title: 'Funk Pockets', blurb: 'Half & whole rests open up the groove.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: [...S3_SIXTEENTHS, CELLS.halfRest, CELLS.wholeRest], bars: 2, bpm: 76,
    scaffold: full(true), spiral: [], opponent: OPP.funkOwl,
  },
  {
    id: '4.2', stage: 4, kind: 'practice', tier: 4,
    title: 'Off & On', blurb: 'The eighth rest sneaks in.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S4_RESTS, bars: 2, bpm: 80,
    scaffold: full(true), spiral: [], opponent: OPP.funkOwl,
  },
  {
    id: '4.3', stage: 4, kind: 'practice', tier: 4,
    title: 'Holes & Hits', blurb: 'Rests against 8ths & 16ths, longer phrase.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S4_RESTS, bars: 4, bpm: 86,
    scaffold: practice(true), spiral: [], opponent: OPP.funkOwl,
  },
  {
    id: '4.4', stage: 4, kind: 'remix', tier: 4,
    title: '★ Rests Remix', blurb: 'Spiral review of Stages 1–4.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S4_RESTS, bars: 4, bpm: 88,
    scaffold: remix(true), spiral: [1, 2, 3, 4], opponent: OPP.funkOwl,
  },

  // ── Stage 5 — Eighth & Sixteenth Groups · 4/4 · 🐯 Tempo Tiger ───────────────
  {
    id: '5.1', stage: 5, kind: 'feature', tier: 5,
    title: 'Group Cells', blurb: 'ta-ka-di, ta . di-mi & dotted-8th+16th featured.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S5_GROUPS, bars: 2, bpm: 72,
    scaffold: full(true), spiral: [], opponent: OPP.tempoTiger,
  },
  {
    id: '5.2', stage: 5, kind: 'practice', tier: 5,
    title: 'Mixed In', blurb: 'Group cells woven through the running mix.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S5_GROUPS, bars: 2, bpm: 80,
    scaffold: practice(true), spiral: [], opponent: OPP.tempoTiger,
  },
  {
    id: '5.3', stage: 5, kind: 'practice', tier: 5,
    title: 'Denser & Longer', blurb: 'Dense group cells over four bars.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S5_GROUPS, bars: 4, bpm: 86,
    scaffold: practice(true), spiral: [], opponent: OPP.tempoTiger,
  },
  {
    id: '5.4', stage: 5, kind: 'remix', tier: 5,
    title: '★ Groups Remix', blurb: 'Spiral review of Stages 2–5.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S5_GROUPS, bars: 4, bpm: 88,
    scaffold: remix(true), spiral: [2, 3, 4, 5], opponent: OPP.tempoTiger,
  },

  // ── Stage 6 — Triplets · 4/4 · 🐺 Waltz Wolf ────────────────────────────────
  {
    id: '6.1', stage: 6, kind: 'feature', tier: 5,
    title: 'Triplet Roll', blurb: 'Eighth-note triplets (ta-ki-da) featured.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S6_TRIPLETS, bars: 2, bpm: 72,
    scaffold: full(true), spiral: [], opponent: OPP.waltzWolf,
  },
  {
    id: '6.2', stage: 6, kind: 'practice', tier: 5,
    title: 'Three vs Four', blurb: 'Triplets against straight subdivisions.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S6_TRIPLETS, bars: 2, bpm: 80,
    scaffold: practice(true), spiral: [], opponent: OPP.waltzWolf,
  },
  {
    id: '6.3', stage: 6, kind: 'remix', tier: 5,
    title: '★ Triplet Remix', blurb: 'Spiral review of Stages 3–6.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S6_TRIPLETS, bars: 4, bpm: 84,
    scaffold: remix(true), spiral: [3, 4, 5, 6], opponent: OPP.waltzWolf,
  },

  // ── Stage 7 — Dotted & Syncopation · 4/4 · 🤖 Metro Gnome ────────────────────
  {
    id: '7.1', stage: 7, kind: 'feature', tier: 5,
    title: 'Long-Short', blurb: 'Dotted-quarter + eighth (ta . . di).',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: [...S6_TRIPLETS, CELLS.dottedQuarterEighth], bars: 2, bpm: 80,
    scaffold: full(true), spiral: [], opponent: OPP.metroGnome,
  },
  {
    id: '7.2', stage: 7, kind: 'practice', tier: 5,
    title: 'Tied & Tipsy', blurb: 'Ties & syncopation push the off-beats.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S7_DOTTED_SYNC, bars: 2, bpm: 84,
    scaffold: full(true), spiral: [], opponent: OPP.metroGnome,
  },
  {
    id: '7.3', stage: 7, kind: 'practice', tier: 5,
    title: 'Syncopation Stew', blurb: 'Dotted rhythms & syncopation mixed long.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S7_DOTTED_SYNC, bars: 4, bpm: 90,
    scaffold: practice(true), spiral: [], opponent: OPP.metroGnome,
  },
  {
    id: '7.4', stage: 7, kind: 'remix', tier: 5,
    title: '★ Simple-Meter Remix', blurb: 'Spiral across all simple meters (S1–7).',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S7_DOTTED_SYNC, bars: 4, bpm: 92,
    scaffold: remix(true), spiral: [1, 2, 3, 4, 5, 6, 7], opponent: OPP.metroGnome,
  },

  // ── Stage 8 — Compound 6/8 · 🐸 Jig Frog · felt beats ───────────────────────
  {
    id: '8.1', stage: 8, kind: 'feature', tier: 5,
    title: 'Two Big Beats', blurb: '6/8 felt as two dotted-quarter beats (ta-ki-da).',
    timeSig: { beats: 6, unit: 8 }, meter: 'compound',
    cells: [CELLS.compoundFeltBeat, CELLS.compoundDivision], bars: 2, bpm: 58,
    scaffold: full(true), spiral: [], opponent: OPP.jigFrog,
  },
  {
    id: '8.2', stage: 8, kind: 'practice', tier: 5,
    title: 'Jig Divisions', blurb: 'Dotted-quarter pulse with eighth divisions.',
    timeSig: { beats: 6, unit: 8 }, meter: 'compound',
    cells: [CELLS.compoundFeltBeat, CELLS.compoundDivision, CELLS.compoundQuarterEighth, CELLS.compoundEighthQuarter],
    bars: 2, bpm: 66,
    scaffold: full(true), spiral: [], opponent: OPP.jigFrog,
  },
  {
    id: '8.3', stage: 8, kind: 'practice', tier: 5,
    title: 'Within the Three', blurb: 'Quarter+eighth in the 3-group, plus the eighth rest.',
    timeSig: { beats: 6, unit: 8 }, meter: 'compound',
    cells: COMPOUND_BASE, bars: 2, bpm: 76,
    scaffold: practice(true), spiral: [], opponent: OPP.jigFrog,
  },
  {
    id: '8.4', stage: 8, kind: 'remix', tier: 5,
    title: '★ 6/8 Remix', blurb: '6/8 consolidation from memory.',
    timeSig: { beats: 6, unit: 8 }, meter: 'compound',
    cells: COMPOUND_BASE, bars: 4, bpm: 80,
    scaffold: remix(true), spiral: [8], opponent: OPP.jigFrog,
  },

  // ── Stage 9 — Compound 9/8 & 12/8 · 🐲 Blitz Dragon ─────────────────────────
  {
    id: '9.1', stage: 9, kind: 'feature', tier: 5,
    title: 'Three in Nine', blurb: '9/8 felt as three dotted-quarter beats.',
    timeSig: { beats: 9, unit: 8 }, meter: 'compound',
    cells: COMPOUND_BASE, bars: 2, bpm: 64,
    scaffold: full(true), spiral: [], opponent: OPP.blitzDragon,
  },
  {
    id: '9.2', stage: 9, kind: 'feature', tier: 5,
    title: 'Four in Twelve', blurb: '12/8 felt as four dotted-quarter beats.',
    timeSig: { beats: 12, unit: 8 }, meter: 'compound',
    cells: COMPOUND_BASE, bars: 2, bpm: 72,
    scaffold: full(true), spiral: [], opponent: OPP.blitzDragon,
  },
  {
    id: '9.3', stage: 9, kind: 'practice', tier: 5,
    title: 'Nine & Twelve', blurb: '9/8 and 12/8 phrases mixed, longer.',
    timeSig: { beats: 9, unit: 8 }, meter: 'compound',
    cells: COMPOUND_BASE, bars: 4, bpm: 80,
    scaffold: practice(true), spiral: [], opponent: OPP.blitzDragon,
  },
  {
    id: '9.4', stage: 9, kind: 'remix', tier: 5,
    title: '★ Compound Remix', blurb: 'All compound meters (6/8·9/8·12/8).',
    timeSig: { beats: 12, unit: 8 }, meter: 'compound',
    cells: COMPOUND_BASE, bars: 4, bpm: 82,
    scaffold: remix(true), spiral: [8, 9], opponent: OPP.blitzDragon,
  },

  // ── Stage 10 (optional / expert) — Odd Meters · 🎼 The Maestro ───────────────
  {
    id: '10.1', stage: 10, kind: 'feature', tier: 5,
    title: 'Five-Eight', blurb: '5/8 groupings (2+3, 3+2).',
    timeSig: { beats: 5, unit: 8 }, meter: 'compound',
    cells: COMPOUND_BASE, bars: 2, bpm: 80,
    scaffold: full(true), spiral: [], opponent: OPP.maestro,
  },
  {
    id: '10.2', stage: 10, kind: 'feature', tier: 5,
    title: 'Seven-Eight', blurb: '7/8 — odd-meter swagger.',
    timeSig: { beats: 7, unit: 8 }, meter: 'compound',
    cells: COMPOUND_BASE, bars: 2, bpm: 84,
    scaffold: full(true), spiral: [], opponent: OPP.maestro,
  },
  {
    id: '10.3', stage: 10, kind: 'remix', tier: 5,
    title: '★ BOSS — The Maestro', blurb: 'Everything — spiral across all stages.',
    timeSig: { beats: 4, unit: 4 }, meter: 'simple',
    cells: S7_DOTTED_SYNC, bars: 4, bpm: 86,
    scaffold: remix(true), spiral: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], opponent: OPP.maestro,
  },
]

// ── Derive the full level list (num, rounds, difficulty, feltBeats, chain) ─────

/** Rounds-to-clear ramps gently with stage; Remixes ask for a couple extra. */
function roundsFor(spec: LevelSpec): number {
  const base = 3 + Math.floor((spec.stage - 1) / 3) // 3 → 4 → 5 as stages deepen
  return spec.kind === 'remix' ? base + 1 : base
}

/**
 * Judging difficulty 0..1 → tightenWindows. Ramps across the whole ladder and
 * nudges up for Practice/Remix within a stage; clamped to [0.1, 0.95].
 */
function difficultyFor(spec: LevelSpec, indexInTable: number): number {
  const ladder = 0.1 + (indexInTable / (SPECS.length - 1)) * 0.75
  const kindBump = spec.kind === 'remix' ? 0.06 : spec.kind === 'practice' ? 0.03 : 0
  return Math.max(0.1, Math.min(0.95, Number((ladder + kindBump).toFixed(3))))
}

export const LEVELS: EchoLevel[] = SPECS.map((spec, i) => ({
  id: spec.id,
  num: i + 1,
  stage: spec.stage,
  kind: spec.kind,
  title: spec.title,
  blurb: spec.blurb,
  timeSig: spec.timeSig,
  meter: spec.meter,
  feltBeats: computeFeltBeats(spec.timeSig.beats, spec.timeSig.unit),
  cells: spec.cells,
  bars: spec.bars,
  bpm: spec.bpm,
  scaffold: spec.scaffold,
  spiral: spec.spiral,
  opponent: spec.opponent,
  // Linear unlock chain: each level unlocks the next; last is the end of ladder.
  unlockNext: i + 1 < SPECS.length ? SPECS[i + 1].id : null,
  tier: spec.tier,
  rounds: roundsFor(spec),
  difficulty: difficultyFor(spec, i),
}))

export function levelById(id: string): EchoLevel | undefined {
  return LEVELS.find((l) => l.id === id)
}

/** Per-stage display metadata for the world-map menu (doc §3 stage headers). */
export interface EchoStageInfo {
  /** Stage number (1–10). */
  stage: number
  /** Stage title (the new element / theme). */
  title: string
  /** Short flavor line — what this stage teaches. */
  blurb: string
  /** Meter(s) shown in the doc header. */
  meters: string
  /** The opponent that fronts this stage. */
  opponent: { name: string; emoji: string }
}

export const STAGE_INFO: EchoStageInfo[] = [
  { stage: 1, title: 'Long Notes', blurb: 'Quarters, halves, dotted-halves, wholes & the quarter rest.', meters: '4/4 · 3/4', opponent: OPP.bongo },
  { stage: 2, title: 'Eighth Notes', blurb: 'Split the beat — beamed eighths (ta-di).', meters: '4/4', opponent: OPP.echoCat },
  { stage: 3, title: 'Sixteenth Notes', blurb: 'Straight sixteenths — ta-ka-di-mi, four to a beat.', meters: '4/4', opponent: OPP.djFox },
  { stage: 4, title: 'Rests', blurb: 'Half, whole & eighth rests open up the groove.', meters: '4/4', opponent: OPP.funkOwl },
  { stage: 5, title: 'Eighth & Sixteenth Groups', blurb: 'Mixed-subdivision cells — ta-ka-di, ta . di-mi, dotted-8th+16th.', meters: '4/4', opponent: OPP.tempoTiger },
  { stage: 6, title: 'Triplets', blurb: 'Eighth-note triplets — three to a beat.', meters: '4/4', opponent: OPP.waltzWolf },
  { stage: 7, title: 'Dotted & Syncopation', blurb: 'Dotted-quarter+eighth, ties & syncopation.', meters: '4/4', opponent: OPP.metroGnome },
  { stage: 8, title: 'Compound 6/8', blurb: '6/8 felt as two dotted-quarter beats.', meters: '6/8', opponent: OPP.jigFrog },
  { stage: 9, title: 'Compound 9/8 & 12/8', blurb: 'Three & four felt beats in compound time.', meters: '9/8 · 12/8', opponent: OPP.blitzDragon },
  { stage: 10, title: 'Odd Meters', blurb: 'Expert — 5/8, 7/8 & a final boss spiral.', meters: '5/8 · 7/8 · mixed', opponent: OPP.maestro },
]

export function stageInfo(stage: number): EchoStageInfo | undefined {
  return STAGE_INFO.find((s) => s.stage === stage)
}

/**
 * The allowed beat-cell VOCABULARY for a level — the growing per-stage set.
 * Replaces the old `tierCells(level.tier)` usage at generation sites. Falls back
 * to the legacy CELL_TIERS for a level that (defensively) has no authored cells.
 */
export function cellsForLevel(level: EchoLevel): BeatCell[] {
  if (level.cells && level.cells.length > 0) return level.cells
  return tierCells(level.tier)
}

/**
 * Legacy tier → cells lookup. Retained for backward compatibility (existing call
 * sites / consumers); new code should prefer `cellsForLevel`.
 */
export function tierCells(tier: number): BeatCell[] {
  return CELL_TIERS[Math.max(0, Math.min(CELL_TIERS.length - 1, tier))]
}

// A musical pentatonic-ish scale (Hz) for Simon mode pitched hits, so the
// growing sequence sounds like a melody, not random beeps. C major pentatonic
// across ~1.5 octaves.
export const SIMON_SCALE: number[] = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.0, // G4
  440.0, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
]
