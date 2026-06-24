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
// Curriculum: five progressive note sets, matching the original game's levels.
// ──────────────────────────────────────────────────────────────────────────

/** 'name' = staff shown, pick the letter block (default). 'find' = letter shown,
 *  pick the block whose staff-note matches. */
export type NoteMode = 'name' | 'find'

export interface NoteSet {
  id: string
  name: string
  /** Short hint shown beside the level, e.g. "C D E · A B C". */
  blurb: string
  notes: GameNote[]
  mode?: NoteMode
}

function set(id: string, name: string, blurb: string, specs: [string, Clef][]): NoteSet {
  return { id, name, blurb, notes: specs.map(([n, c]) => makeNote(n, c)) }
}

export const NOTE_SETS: NoteSet[] = [
  set('mid-c', 'Middle C & Friends', 'C D E · A B C', [
    ['C4', 'treble'], ['D4', 'treble'], ['E4', 'treble'],
    ['A3', 'bass'], ['B3', 'bass'], ['C4', 'bass'],
  ]),
  set('c-position', 'C Position', 'C to G', [
    ['C4', 'treble'], ['D4', 'treble'], ['E4', 'treble'], ['F4', 'treble'], ['G4', 'treble'],
    ['C3', 'bass'], ['D3', 'bass'], ['E3', 'bass'], ['F3', 'bass'], ['G3', 'bass'],
  ]),
  set('treble', 'Treble Staff', 'Lines & spaces', [
    ['E4', 'treble'], ['F4', 'treble'], ['G4', 'treble'], ['A4', 'treble'], ['B4', 'treble'],
    ['C5', 'treble'], ['D5', 'treble'], ['E5', 'treble'], ['F5', 'treble'],
  ]),
  set('bass', 'Bass Staff', 'Lines & spaces', [
    ['G2', 'bass'], ['A2', 'bass'], ['B2', 'bass'], ['C3', 'bass'], ['D3', 'bass'],
    ['E3', 'bass'], ['F3', 'bass'], ['G3', 'bass'], ['A3', 'bass'],
  ]),
  set('grand', 'Grand Staff', 'Both clefs + ledgers', [
    ['C4', 'treble'], ['E4', 'treble'], ['G4', 'treble'], ['B4', 'treble'], ['D5', 'treble'], ['F5', 'treble'], ['A5', 'treble'],
    ['C3', 'bass'], ['E3', 'bass'], ['G3', 'bass'], ['B3', 'bass'], ['D3', 'bass'], ['F2', 'bass'], ['A2', 'bass'],
  ]),
]

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

const TREBLE_RANGE = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5']
const BASS_RANGE = ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4']

/** Selectable note names for the level creator, per clef. */
export function candidateNoteNames(clef: Clef): string[] {
  return clef === 'treble' ? TREBLE_RANGE : BASS_RANGE
}

/** Build a custom NoteSet from chosen note names. */
export function customSet(
  id: string,
  name: string,
  clef: Clef,
  noteNames: string[],
  mode: NoteMode = 'name',
): NoteSet {
  return {
    id,
    name: name.trim().slice(0, 20) || 'My Level',
    blurb: `Custom · ${clef}${mode === 'find' ? ' · find' : ''}`,
    notes: noteNames.map((n) => makeNote(n, clef)),
    mode,
  }
}
