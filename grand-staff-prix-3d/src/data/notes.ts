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

export interface NoteSet {
  id: string
  name: string
  /** Short hint shown beside the level. */
  blurb: string
  notes: GameNote[]
  mode?: NoteMode
  /** Clef track + difficulty tier (1 = first), for the curriculum. */
  group?: ClefGroup
  tier?: number
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
 * Build the labels for one gate wave: `count` distinct letters that always
 * include the answer, shuffled. Distractors are drawn from the set's letters.
 */
export function buildGateLetters(set: NoteSet, answer: Letter, count: number): Letter[] {
  const pool = lettersOf(set).filter((l) => l !== answer)
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
// The curriculum. Each clef track ramps: hand positions → whole staff → + ledgers.
// Every level uses 'mix' mode (name + find alternate wave to wave).
// ──────────────────────────────────────────────────────────────────────────

/** Clef tracks in menu order. Optional tracks (alto/tenor) are hidden until enabled. */
export const CLEF_GROUPS: { id: ClefGroup; label: string; optional?: boolean }[] = [
  { id: 'treble', label: 'Treble' },
  { id: 'bass', label: 'Bass' },
  { id: 'grand', label: 'Grand Staff' },
  { id: 'alto', label: 'Alto', optional: true },
  { id: 'tenor', label: 'Tenor', optional: true },
]

/** Inclusive pitch range → note names (naturals). */
function spread(low: string, high: string): string[] {
  const out: string[] = []
  for (let d = diatonicOfName(low); d <= diatonicOfName(high); d++) out.push(diatonicToName(d))
  return out
}

function level(group: ClefGroup, tier: number, name: string, blurb: string, clef: Clef | 'grand', names: string[]): NoteSet {
  const notes = clef === 'grand' ? names.map((n) => makeNote(n, grandClefFor(n))) : names.map((n) => makeNote(n, clef))
  return { id: `${group}-${tier}`, name, blurb, notes, mode: 'mix', group, tier }
}

export const NOTE_SETS: NoteSet[] = [
  // Treble
  level('treble', 1, 'Middle C Position', 'C–G (right hand)', 'treble', ['C4', 'D4', 'E4', 'F4', 'G4']),
  level('treble', 2, 'C Position', 'C–G', 'treble', ['C4', 'D4', 'E4', 'F4', 'G4']),
  level('treble', 3, 'G Position', 'G–D', 'treble', ['G4', 'A4', 'B4', 'C5', 'D5']),
  level('treble', 4, 'Treble Staff', 'All lines & spaces', 'treble', spread('E4', 'F5')),
  level('treble', 5, 'Treble + Ledgers', '3 ledgers each way', 'treble', spread('F3', 'E6')),
  // Bass
  level('bass', 1, 'Middle C Position', 'F–C (left hand)', 'bass', ['F3', 'G3', 'A3', 'B3', 'C4']),
  level('bass', 2, 'C Position', 'C–G', 'bass', ['C3', 'D3', 'E3', 'F3', 'G3']),
  level('bass', 3, 'G Position', 'G–D', 'bass', ['G2', 'A2', 'B2', 'C3', 'D3']),
  level('bass', 4, 'Bass Staff', 'All lines & spaces', 'bass', spread('G2', 'A3')),
  level('bass', 5, 'Bass + Ledgers', '3 ledgers each way', 'bass', spread('A1', 'G4')),
  // Grand staff
  level('grand', 1, 'Middle C Position', 'Both hands at middle C', 'grand', spread('F3', 'G4')),
  level('grand', 2, 'C Position', 'Hands apart', 'grand', ['C3', 'D3', 'E3', 'F3', 'G3', 'C4', 'D4', 'E4', 'F4', 'G4']),
  level('grand', 3, 'G Position', 'Hands far apart', 'grand', ['G2', 'A2', 'B2', 'C3', 'D3', 'G4', 'A4', 'B4', 'C5', 'D5']),
  level('grand', 4, 'Grand Staff', 'Both staves', 'grand', [...spread('C3', 'C4'), ...spread('D4', 'C5')]),
  level('grand', 5, 'Grand + Ledgers', '+ ledger lines', 'grand', [...spread('A2', 'B3'), ...spread('C4', 'A5')]),
  // Alto (optional)
  level('alto', 1, 'Alto Basics', 'Around middle C', 'alto', ['A3', 'B3', 'C4', 'D4', 'E4']),
  level('alto', 2, 'Alto Staff', 'All lines & spaces', 'alto', spread('F3', 'G4')),
  level('alto', 3, 'Alto + Ledgers', 'With ledgers', 'alto', spread('C3', 'C5')),
  // Tenor (optional)
  level('tenor', 1, 'Tenor Basics', 'Around middle C', 'tenor', ['A3', 'B3', 'C4', 'D4', 'E4']),
  level('tenor', 2, 'Tenor Staff', 'All lines & spaces', 'tenor', spread('D3', 'E4')),
  level('tenor', 3, 'Tenor + Ledgers', 'With ledgers', 'tenor', spread('A2', 'A4')),
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
