// ──────────────────────────────────────────────────────────────────────────
// Music theory core. This is the educational heart of the game, so every value
// here is derived from first principles rather than hand-placed, to guarantee
// notes render on the staff in the correct position and play the correct pitch.
// ──────────────────────────────────────────────────────────────────────────

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'

export const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

// Diatonic letter index within an octave (C = 0 … B = 6).
const LETTER_INDEX: Record<Letter, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }
// Semitones above C for each natural letter, used to compute MIDI / pitch.
const LETTER_SEMITONE: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export interface GameNote {
  letter: Letter
  octave: number
  /** -1 flat, 0 natural, +1 sharp. Reserved for advanced levels. */
  accidental: -1 | 0 | 1
  clef: Clef
  /** Diatonic position = octave * 7 + letterIndex. Monotonic with staff height. */
  diatonic: number
  /** MIDI note number (middle C = C4 = 60). */
  midi: number
}

/** Parse a note name like "C4", "G2" plus the clef it should be drawn on. */
export function makeNote(name: string, clef: Clef): GameNote {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(name)
  if (!m) throw new Error(`Bad note name: ${name}`)
  const letter = m[1] as Letter
  const accidental: -1 | 0 | 1 = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  const octave = parseInt(m[3], 10)
  const diatonic = octave * 7 + LETTER_INDEX[letter]
  const midi = (octave + 1) * 12 + LETTER_SEMITONE[letter] + accidental
  return { letter, octave, accidental, clef, diatonic, midi }
}

/** Concert pitch frequency in Hz (A4 = 440). */
export function noteFrequency(note: GameNote): number {
  return 440 * Math.pow(2, (note.midi - 69) / 12)
}

// Diatonic value of the bottom line of each clef's five-line staff.
// Treble bottom line = E4; Bass = G2; Alto (C-clef, middle line C4) = F3;
// Tenor (C-clef, 4th line C4) = D3.
const BOTTOM_LINE_DIATONIC: Record<Clef, number> = {
  treble: makeNote('E4', 'treble').diatonic,
  bass: makeNote('G2', 'bass').diatonic,
  alto: makeNote('F3', 'alto').diatonic,
  tenor: makeNote('D3', 'tenor').diatonic,
}

/**
 * Vertical staff step of a note measured from the bottom line.
 * 0 = bottom line, 1 = first space, 2 = second line … 8 = top line.
 * Negative / >8 values fall on ledger lines below / above the staff.
 */
export function staffStep(note: GameNote): number {
  return note.diatonic - BOTTOM_LINE_DIATONIC[note.clef]
}

// ──────────────────────────────────────────────────────────────────────────
// Curriculum types. The NOTE_SETS array is built near the bottom of this file —
// it depends on the grand-staff helpers defined further down.
// ──────────────────────────────────────────────────────────────────────────

/** 'name' = staff shown, pick the letter. 'find' = letter shown, pick the staff
 *  note. 'mix' = each wave is randomly one or the other (the curriculum default). */
export type NoteMode = 'name' | 'find' | 'mix'

/** Which clef "track" a level belongs to (drives the grouped level menu). The
 *  'journey' group is the new primary Learning-Mode chain (grand staff, 21
 *  region×mode stages); the clef groups now back the Side Quests (§10). */
export type ClefGroup = 'treble' | 'bass' | 'grand' | 'alto' | 'tenor' | 'journey'

/** Learning-Mode journey stages vs. optional Side Quests (position/custom drills). */
export type LevelKind = 'learning' | 'sidequest'

/** Difficulty band within a clef track. */
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
]

export interface NoteSet {
  id: string
  name: string
  /** Short hint shown beside the level. */
  blurb: string
  notes: GameNote[]
  mode?: NoteMode
  /**
   * Ordered note names (e.g. ['C4','D4','E4']) for the adaptive ladder. The
   * active pool grows along this list as the mastery meter climbs. Parallel to
   * `notes` (same order). Absent on custom levels (the whole pool is active).
   * @see ladder.ts
   */
  ladder?: string[]
  /** How many ladder notes are active at meter 0 (the starting pool size). */
  startCount?: number
  /** Clef track + difficulty tier (1 = first), for the curriculum. */
  group?: ClefGroup
  tier?: number
  band?: Difficulty
  /** 'learning' = part of the main journey chain, 'sidequest' = optional drill
   *  (position levels + custom levels). Lets Phase D split the menu (§10/§13). */
  kind?: LevelKind
}

/** The ordered ladder note names for a set; custom levels ladder over their whole pool. */
export function ladderOf(set: NoteSet): string[] {
  return set.ladder ?? set.notes.map((n) => `${n.letter}${n.octave}`)
}

/** Starting active-pool size; custom levels start with every note active. */
export function startCountOf(set: NoteSet): number {
  return set.startCount ?? set.notes.length
}

/** The first `count` notes of a set — the active pool for a given meter state. */
export function activeNotes(set: NoteSet, count: number): GameNote[] {
  return set.notes.slice(0, Math.max(1, Math.min(count, set.notes.length)))
}

/** Pick a random note from an explicit pool (the active ladder subset). */
export function pickNoteFrom(notes: GameNote[]): GameNote {
  return notes[rand(notes.length)]
}

/** Distinct letters present in an explicit note pool (for gate distractors). */
export function lettersOfNotes(notes: GameNote[]): Letter[] {
  const seen = new Set<Letter>()
  for (const n of notes) seen.add(n.letter)
  return LETTERS.filter((l) => seen.has(l))
}

/** Distinct letters that appear in a note set (used to build gate options). */
export function lettersOf(set: NoteSet): Letter[] {
  const seen = new Set<Letter>()
  for (const n of set.notes) seen.add(n.letter)
  return LETTERS.filter((l) => seen.has(l))
}

// Small seedable RNG so spawned waves are deterministic per seed if desired,
// but here we simply wrap Math.random behind one place for easy testing.
function rand(n: number): number {
  return Math.floor(Math.random() * n)
}

/** Pick a random note from a set. */
export function pickNote(set: NoteSet): GameNote {
  return set.notes[rand(set.notes.length)]
}

/**
 * Build the labels for one gate wave from an explicit letter pool: up to `count`
 * distinct letters that always include the answer, shuffled. Distractors are
 * drawn from `letterPool`. With a small pool (e.g. the 2-note beginner start) the
 * wave naturally has fewer gates — which is exactly the easier beginner case.
 */
function buildGateLabels(letterPool: Letter[], answer: Letter, count: number): Letter[] {
  const pool = letterPool.filter((l) => l !== answer)
  // shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const chosen = pool.slice(0, Math.max(0, count - 1))
  chosen.push(answer)
  // shuffle final lane order
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[chosen[i], chosen[j]] = [chosen[j], chosen[i]]
  }
  return chosen
}

/** Gate labels drawn from a whole note set's letters. */
export function buildGateLetters(set: NoteSet, answer: Letter, count: number): Letter[] {
  return buildGateLabels(lettersOf(set), answer, count)
}

/** Gate labels drawn from an explicit (active-ladder) note pool. */
export function buildGateLettersFrom(pool: GameNote[], answer: Letter, count: number): Letter[] {
  return buildGateLabels(lettersOfNotes(pool), answer, count)
}

// ──────────────────────────────────────────────────────────────────────────
// Custom levels: students pick the notes they want to practice. These helpers
// expose a sensible candidate range per clef and build a NoteSet from a pick.
// ──────────────────────────────────────────────────────────────────────────

/** Note name (naturals only) for a diatonic value. C4 = 28. */
function diatonicToName(diatonic: number): string {
  const octave = Math.floor(diatonic / 7)
  return `${LETTERS[diatonic - octave * 7]}${octave}`
}

// Staff spans steps 0–8; ledger lines sit at ±2, ±4, ±6. The range stops ON the
// 3rd ledger line: step -6 below the bottom line, +14 above the top line.
export const LEDGER_MIN_STEP = -6 // note on the 3rd ledger line below
export const LEDGER_MAX_STEP = 14 // note on the 3rd ledger line above

/** Selectable notes for a clef: the staff plus 3 ledger lines above & below. */
export function candidateNoteNames(clef: Clef): string[] {
  const bottom = BOTTOM_LINE_DIATONIC[clef]
  const names: string[] = []
  for (let step = LEDGER_MIN_STEP; step <= LEDGER_MAX_STEP; step++) names.push(diatonicToName(bottom + step))
  return names
}

// ── Grand staff (treble + bass, one pitch axis) ─────────────────────────────
const MIDDLE_C_DIATONIC = makeNote('C4', 'treble').diatonic // 28

/** Bottom-line diatonic of a clef (for the staff picker geometry). */
export function bottomLineDiatonic(clef: Clef): number {
  return BOTTOM_LINE_DIATONIC[clef]
}

/** Diatonic value of a note name (clef-independent). */
export function diatonicOfName(name: string): number {
  return makeNote(name, 'treble').diatonic
}

/** On a grand staff a note belongs to the treble clef at/above middle C, else bass. */
export function grandClefFor(name: string): Clef {
  return diatonicOfName(name) >= MIDDLE_C_DIATONIC ? 'treble' : 'bass'
}

/** Grand-staff pickable notes: 3 ledger lines below the bass staff (A1) through
 *  3 ledger lines above the treble staff (E6), each pitch once. */
export function grandCandidateNames(): string[] {
  const lo = bottomLineDiatonic('bass') + LEDGER_MIN_STEP // A1, 3 ledgers below bass
  const hi = bottomLineDiatonic('treble') + LEDGER_MAX_STEP // E6, 3 ledgers above treble
  const names: string[] = []
  for (let d = lo; d <= hi; d++) names.push(diatonicToName(d))
  return names
}

/** Build a custom NoteSet from chosen note names. `clef` may be 'grand', which
 *  assigns each note to treble or bass by pitch. */
export function customSet(
  id: string,
  name: string,
  clef: Clef | 'grand',
  noteNames: string[],
  mode: NoteMode = 'name',
): NoteSet {
  const notes =
    clef === 'grand'
      ? noteNames.map((n) => makeNote(n, grandClefFor(n)))
      : noteNames.map((n) => makeNote(n, clef))
  return {
    id,
    name: name.trim().slice(0, 20) || 'My Level',
    blurb: `Custom · ${clef}${mode === 'find' ? ' · find' : ''}`,
    notes,
    mode,
    kind: 'sidequest', // custom levels feed the Side Quests section (§10)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// The curriculum. Each clef track ramps through an adaptive note LADDER:
//
//   name (super-beginner, identify a shown note) → name again (next position)
//   → find (locate a named note, same notes) → whole staff (mix) → + ledgers (mix)
//
// Within a level, an ordered `ladder` of notes is revealed one at a time as the
// student proves accuracy (see ladder.ts). Beginner levels start at 2 notes and
// add one at a time. Advanced (whole-staff / ledger) levels pre-load the staff
// the student already knows via a larger `startCount`, then ladder-in only the
// last few stretch / ledger notes — keeping every level's mastery to a similar
// ~60–75 correct notes regardless of how many notes it ultimately contains.
// ──────────────────────────────────────────────────────────────────────────

/** Clef tracks in menu order. Optional tracks (alto/tenor) are hidden until enabled.
 *  'journey' leads — it is the primary Learning-Mode chain; the clef tracks below
 *  it are the Side Quests. */
export const CLEF_GROUPS: { id: ClefGroup; label: string; optional?: boolean }[] = [
  { id: 'journey', label: 'Journey' },
  { id: 'treble', label: 'Treble' },
  { id: 'bass', label: 'Bass' },
  { id: 'grand', label: 'Grand Staff' },
  { id: 'alto', label: 'Alto', optional: true },
  { id: 'tenor', label: 'Tenor', optional: true },
]

// A Side Quest level (the old "position levels": C/G position, whole-staff, ledgers).
// These moved OFF the main spine into the optional Side Quests section (§10); their
// ids are namespaced `sq-<clef>-<tier>` so old saved ids migrate onto the journey
// instead of colliding with these.
function level(
  group: ClefGroup,
  tier: number,
  name: string,
  blurb: string,
  clef: Clef | 'grand',
  mode: NoteMode,
  ladder: string[],
  startCount: number,
  band: Difficulty,
): NoteSet {
  const notes = clef === 'grand' ? ladder.map((n) => makeNote(n, grandClefFor(n))) : ladder.map((n) => makeNote(n, clef))
  return { id: `sq-${group}-${tier}`, name, blurb, notes, ladder, startCount, mode, group, tier, band, kind: 'sidequest' }
}

// ──────────────────────────────────────────────────────────────────────────
// LEARNING MODE — the primary journey (Levels Rework Phase A).
//
// Seven CUMULATIVE regions on the grand staff. Notes are only ever ADDED — each
// region = all previous notes + a few new ones (some higher, some lower), middle
// C outward to ~3 ledger lines each way (F1–G6 by Region 7). Each region is then
// played in three modes — Name → Find → Mix — for 7 × 3 = 21 stages in one linear
// chain (group 'journey', tiers 1…21): r1-name → r1-find → r1-mix → r2-name → …
//
// Per stage the ordered `ladder` keeps the FRONTIER notes last so they ladder in,
// while everything the student already knows is pre-loaded via `startCount`. To
// hold every stage to a consistent mastery effort (curriculum.test.ts keeps the
// mastery threshold in ~45–90 correct notes ⇒ 2–5 notes laddered in per stage),
// every stage ladders in ≤5 frontier notes: regions that add ≤5 new notes (1, 2,
// 6, 7) ladder them all; regions that add more (3, 4 add 6; 5 adds 8) pre-load the
// INNER overflow new notes — those nearest the already-known pool, which stay live
// from note one — and ladder the OUTER frontier. Frontier weighting + per-note
// mastery (spec §4.2) is Phase B.
//
// ── Phase A — final per-region note breakdown ──────────────────────────────
//  R  Region       Range   New this region            Pool  start  Pre-loaded new  Ladders in (frontier)
//  1  Middle C     A3–E4   A3 B3 C4 D4 E4 (start)       5     2     C4 D4           E4 B3 A3
//  2  Treble       F3–G4   F3 G3 F4 G4                  9     5     —               F4 G4 F3 G3
//  3  Both Hands   C3–C5   C3 D3 E3 A4 B4 C5           15    10     A4              E3 D3 C3 B4 C5
//  4  Wider Range  G2–F5   G2 A2 B2 D5 E5 F5           21    16     D5              B2 A2 G2 E5 F5
//  5  ±1 Ledger    C2–C6   C2 D2 E2 F2 G5 A5 B5 C6     29    24     F2 G5 A5        E2 D2 C2 B5 C6
//  6  ±2 Ledger    A1–E6   A1 B1 D6 E6                 33    29     —               B1 A1 D6 E6
//  7  Full Staff   F1–G6   F1 G1 F6 G6                 37    33     —               G1 F1 F6 G6
// (Pool = total cumulative notes; start = startCount; mastery threshold = 15·(pool−startCount+1).)
// ──────────────────────────────────────────────────────────────────────────

export interface Region {
  /** 1…7 */
  n: number
  /** Display name (the journey node label). */
  name: string
  /** Aaron's nominal range label for the region. */
  range: string
  /** Full cumulative note pool in ladder order: pre-loaded first, frontier last. */
  ladder: string[]
  /** Active pool size at meter 0 — everything except this region's frontier. */
  startCount: number
  /** Notes first introduced in this region (pre-loaded-new first, then frontier). */
  added: string[]
}

// Per region: the notes NEWLY added, split into the ones pre-loaded into the
// active pool (`preload`) and the FRONTIER ones that ladder in (`frontier`,
// always 2–5 of them). Region N's full ladder = Region (N-1)'s ladder + preload +
// frontier, and its startCount = (prev pool size) + preload count.
const REGION_DEFS: { n: number; name: string; range: string; preload: string[]; frontier: string[] }[] = [
  { n: 1, name: 'Middle C', range: 'A3–E4', preload: ['C4', 'D4'], frontier: ['E4', 'B3', 'A3'] },
  { n: 2, name: 'Treble', range: 'F3–G4', preload: [], frontier: ['F4', 'G4', 'F3', 'G3'] },
  { n: 3, name: 'Both Hands', range: 'C3–C5', preload: ['A4'], frontier: ['E3', 'D3', 'C3', 'B4', 'C5'] },
  { n: 4, name: 'Wider Range', range: 'G2–F5', preload: ['D5'], frontier: ['B2', 'A2', 'G2', 'E5', 'F5'] },
  { n: 5, name: '±1 Ledger', range: 'C2–C6', preload: ['F2', 'G5', 'A5'], frontier: ['E2', 'D2', 'C2', 'B5', 'C6'] },
  { n: 6, name: '±2 Ledger', range: 'A1–E6', preload: [], frontier: ['B1', 'A1', 'D6', 'E6'] },
  { n: 7, name: 'Full Staff', range: 'F1–G6', preload: [], frontier: ['G1', 'F1', 'F6', 'G6'] },
]

/** The seven cumulative regions, built by accumulating each region's new notes. */
export const REGIONS: Region[] = (() => {
  const out: Region[] = []
  let prev: string[] = []
  for (const d of REGION_DEFS) {
    const ladder = [...prev, ...d.preload, ...d.frontier]
    out.push({
      n: d.n,
      name: d.name,
      range: d.range,
      ladder,
      startCount: prev.length + d.preload.length,
      added: [...d.preload, ...d.frontier],
    })
    prev = ladder
  }
  return out
})()

// The three passes each region is played in, in chain order. Name is the Beginner
// pass (no-fail, gentle tempo), Find the Intermediate, Mix the Advanced — the band
// already drives lives + the per-band speed cap, so base speed steps up each mode
// (spec §5) with no engine change.
const JOURNEY_MODES: { suffix: string; label: string; mode: NoteMode; band: Difficulty }[] = [
  { suffix: 'name', label: 'Name', mode: 'name', band: 'beginner' },
  { suffix: 'find', label: 'Find', mode: 'find', band: 'intermediate' },
  { suffix: 'mix', label: 'Mix', mode: 'mix', band: 'advanced' },
]
const MODE_BLURB: Record<NoteMode, string> = {
  name: 'See the note, grab its letter',
  find: 'See the letter, find the note',
  mix: 'Name & Find, mixed',
}

function journeyStage(region: Region, m: (typeof JOURNEY_MODES)[number], tier: number): NoteSet {
  return {
    id: `r${region.n}-${m.suffix}`,
    name: `${region.name} · ${m.label}`,
    blurb: `${region.range} · ${MODE_BLURB[m.mode]}`,
    notes: region.ladder.map((n) => makeNote(n, grandClefFor(n))),
    ladder: region.ladder,
    startCount: region.startCount,
    mode: m.mode,
    group: 'journey',
    tier,
    band: m.band,
    kind: 'learning',
  }
}

/** The 21-stage Learning-Mode chain (7 regions × 3 modes), tiers 1…21. */
export const JOURNEY_STAGES: NoteSet[] = REGIONS.flatMap((region) =>
  JOURNEY_MODES.map((m, i) => journeyStage(region, m, (region.n - 1) * 3 + i + 1)),
)

/**
 * The "frontier" note names for a stage — the notes whose mastery this stage must
 * actually prove, so Phase B can weight them heavily and gate per-note mastery on
 * them (spec §4.2). For a journey stage that is the region's NEWLY-added notes
 * (BOTH the laddered-in frontier AND the pre-loaded-new ones — so R3–R5's
 * pre-loaded notes get drilled, not diluted). For any other level it's the notes
 * that ladder in above the pre-loaded pool (positions ≥ startCount). Custom
 * practice (whole pool active from note one) has no frontier — uniform play.
 */
export function frontierNoteNames(set: NoteSet): string[] {
  if (set.group === 'journey') {
    const m = /^r(\d+)-/.exec(set.id)
    const region = m ? REGIONS.find((r) => r.n === parseInt(m[1], 10)) : undefined
    if (region) return region.added
  }
  return ladderOf(set).slice(startCountOf(set))
}

export const NOTE_SETS: NoteSet[] = [
  // ── Learning Mode — the primary journey (group 'journey', tiers 1…21) ──
  ...JOURNEY_STAGES,

  // ── SIDE QUESTS (§10) ── the old position levels, now optional drills. Kept
  // intact (kind: 'sidequest', ids namespaced sq-*) so nothing is deleted; Phase D
  // pulls these into a dedicated Side Quests section.

  // ── Treble ──  identify C-position → identify G-position → find → whole staff → ledgers
  level('treble', 1, 'Middle C Steps', 'Name C–G', 'treble', 'name', ['C4', 'D4', 'E4', 'F4', 'G4'], 2, 'beginner'),
  level('treble', 2, 'Treble G Position', 'Name G–D', 'treble', 'name', ['G4', 'A4', 'B4', 'C5', 'D5'], 2, 'beginner'),
  level('treble', 3, 'Find: C Position', 'Find C–G', 'treble', 'find', ['C4', 'D4', 'E4', 'F4', 'G4'], 2, 'intermediate'),
  // Whole staff: 5 line notes (EGBDF) pre-loaded, ladder adds the 4 space notes (FACE).
  level('treble', 4, 'Whole Treble Staff', 'All lines & spaces', 'treble', 'mix',
    ['E4', 'G4', 'B4', 'D5', 'F5', 'F4', 'A4', 'C5', 'E5'], 5, 'intermediate'),
  // Ledgers: whole staff (9) pre-loaded, ladder adds 4 ledger notes near→far.
  level('treble', 5, 'Treble + Ledgers', 'Ledger lines', 'treble', 'mix',
    ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'D4', 'G5', 'C4', 'A5'], 9, 'advanced'),

  // ── Bass ──  identify (down from middle C) → identify C-position → find → whole staff → ledgers
  level('bass', 1, 'Middle C Steps', 'Name C down to F', 'bass', 'name', ['C4', 'B3', 'A3', 'G3', 'F3'], 2, 'beginner'),
  level('bass', 2, 'Bass C Position', 'Name C–G', 'bass', 'name', ['C3', 'D3', 'E3', 'F3', 'G3'], 2, 'beginner'),
  level('bass', 3, 'Find: Bass C Position', 'Find C down to F', 'bass', 'find', ['C4', 'B3', 'A3', 'G3', 'F3'], 2, 'intermediate'),
  // Whole staff: 5 line notes (GBDFA) pre-loaded, ladder adds the 4 space notes (ACEG).
  level('bass', 4, 'Whole Bass Staff', 'All lines & spaces', 'bass', 'mix',
    ['G2', 'B2', 'D3', 'F3', 'A3', 'A2', 'C3', 'E3', 'G3'], 5, 'intermediate'),
  // Ledgers: whole staff (9) pre-loaded, ladder adds 4 ledger notes near→far.
  level('bass', 5, 'Bass + Ledgers', 'Ledger lines', 'bass', 'mix',
    ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'F2', 'B3', 'E2', 'C4'], 9, 'advanced'),

  // ── Grand staff ──  both hands at middle C → both C-positions → find → whole → ledgers
  level('grand', 1, 'Grand Middle C', 'Both hands at middle C', 'grand', 'name',
    ['C4', 'B3', 'D4', 'A3', 'E4'], 2, 'intermediate'),
  // Treble C-position pre-loaded (5), ladder adds the bass C-position notes.
  level('grand', 2, 'Grand Positions', 'Both C positions', 'grand', 'name',
    ['C4', 'D4', 'E4', 'F4', 'G4', 'C3', 'D3', 'E3', 'F3', 'G3'], 6, 'intermediate'),
  level('grand', 3, 'Find: Grand', 'Find across both staves', 'grand', 'find',
    ['C4', 'B3', 'D4', 'A3', 'E4', 'G3', 'F4'], 3, 'intermediate'),
  // Whole grand staff (bass G2–A3, treble E4–F5); most pre-loaded, ladder adds the last stretch notes.
  level('grand', 4, 'Whole Grand Staff', 'Both full staves', 'grand', 'mix',
    ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'], 14, 'advanced'),
  // Grand + ledgers (bass F2–B3, treble C4–F5); staff pre-loaded, ladder adds ledger reaches.
  level('grand', 5, 'Grand + Ledgers', 'Ledger lines, both hands', 'grand', 'mix',
    ['F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
     'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'], 18, 'advanced'),

  // ── Alto (optional) ──  identify → find → whole staff
  level('alto', 1, 'Alto Steps', 'Name around middle C', 'alto', 'name', ['C4', 'B3', 'D4', 'A3', 'E4'], 2, 'beginner'),
  level('alto', 2, 'Find: Alto', 'Find around middle C', 'alto', 'find', ['C4', 'B3', 'D4', 'A3', 'E4'], 2, 'intermediate'),
  level('alto', 3, 'Whole Alto Staff', 'All lines & spaces', 'alto', 'mix',
    ['F3', 'A3', 'C4', 'E4', 'G4', 'G3', 'B3', 'D4', 'F4'], 5, 'advanced'),

  // ── Tenor (optional) ──  identify → find → whole staff
  level('tenor', 1, 'Tenor Steps', 'Name around middle C', 'tenor', 'name', ['C4', 'B3', 'D4', 'A3', 'E4'], 2, 'beginner'),
  level('tenor', 2, 'Find: Tenor', 'Find around middle C', 'tenor', 'find', ['C4', 'B3', 'D4', 'A3', 'E4'], 2, 'intermediate'),
  level('tenor', 3, 'Whole Tenor Staff', 'All lines & spaces', 'tenor', 'mix',
    ['D3', 'F3', 'A3', 'C4', 'E4', 'E3', 'G3', 'B3', 'D4'], 5, 'advanced'),
]

/** The next level in the same clef track (for the mastery unlock). */
export function nextLevel(set: NoteSet): NoteSet | undefined {
  if (set.group == null || set.tier == null) return undefined
  return NOTE_SETS.find((s) => s.group === set.group && s.tier === (set.tier ?? 0) + 1)
}

/** First (always-unlocked) level id of each clef track. */
export function starterLevelIds(includeOptional = false): string[] {
  return CLEF_GROUPS.filter((g) => includeOptional || !g.optional)
    .map((g) => NOTE_SETS.find((s) => s.group === g.id && s.tier === 1)?.id)
    .filter((id): id is string => !!id)
}
