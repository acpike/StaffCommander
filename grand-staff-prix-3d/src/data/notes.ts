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

/** Which clef "track" a level belongs to (drives the grouped level menu). */
export type ClefGroup = 'treble' | 'bass' | 'grand' | 'alto' | 'tenor'

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

/** Clef tracks in menu order. Optional tracks (alto/tenor) are hidden until enabled. */
export const CLEF_GROUPS: { id: ClefGroup; label: string; optional?: boolean }[] = [
  { id: 'treble', label: 'Treble' },
  { id: 'bass', label: 'Bass' },
  { id: 'grand', label: 'Grand Staff' },
  { id: 'alto', label: 'Alto', optional: true },
  { id: 'tenor', label: 'Tenor', optional: true },
]

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
  return { id: `${group}-${tier}`, name, blurb, notes, ladder, startCount, mode, group, tier, band }
}

export const NOTE_SETS: NoteSet[] = [
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
