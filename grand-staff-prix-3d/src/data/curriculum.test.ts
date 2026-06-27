import { describe, it, expect } from 'vitest'
import { NOTE_SETS, CLEF_GROUPS, JOURNEY_STAGES, makeNote, frontierNoteNames, type NoteSet } from './notes'
import { masterThreshold } from './ladder'

const curriculum = NOTE_SETS.filter((s) => s.group && s.tier)

describe('curriculum data integrity', () => {
  it('every level defines a ladder, startCount, mode and band', () => {
    for (const s of curriculum) {
      expect(s.ladder, `${s.id} ladder`).toBeTruthy()
      expect(s.startCount, `${s.id} startCount`).toBeTypeOf('number')
      expect(s.mode, `${s.id} mode`).toBeTruthy()
      expect(s.band, `${s.id} band`).toBeTruthy()
    }
  })

  it('notes and ladder line up one-to-one', () => {
    for (const s of curriculum) {
      expect(s.notes.length, `${s.id}`).toBe(s.ladder!.length)
    }
  })

  it('startCount is within [1, ladder length]', () => {
    for (const s of curriculum) {
      expect(s.startCount!, `${s.id} startCount lower`).toBeGreaterThanOrEqual(1)
      expect(s.startCount!, `${s.id} startCount upper`).toBeLessThanOrEqual(s.ladder!.length)
    }
  })

  it('every ladder note name is parseable', () => {
    for (const s of curriculum) {
      for (const n of s.ladder!) {
        expect(() => makeNote(n, 'treble'), `${s.id}: ${n}`).not.toThrow()
      }
    }
  })

  it('keeps mastery effort consistent across levels (~45–90 correct notes)', () => {
    for (const s of curriculum) {
      const m = masterThreshold(s.ladder!.length, s.startCount!)
      expect(m, `${s.id} mastery=${m}`).toBeGreaterThanOrEqual(45)
      expect(m, `${s.id} mastery=${m}`).toBeLessThanOrEqual(90)
    }
  })

  it('each clef track starts identify-only (name mode), Find never first', () => {
    for (const g of CLEF_GROUPS) {
      const first = curriculum.find((s) => s.group === g.id && s.tier === 1)
      if (!first) continue
      expect(first.mode, `${g.id} tier 1`).toBe('name')
    }
  })

  it('Find appears only after at least one identify level in each track', () => {
    for (const g of CLEF_GROUPS) {
      const track = curriculum.filter((s) => s.group === g.id).sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))
      const firstFind = track.findIndex((s) => s.mode === 'find')
      if (firstFind === -1) continue
      // everything before the first find level must be a name level
      for (let i = 0; i < firstFind; i++) {
        expect(track[i].mode, `${track[i].id} before find`).toBe('name')
      }
    }
  })

  it('beginner-band levels are all identify-only (no-fail name practice)', () => {
    for (const s of curriculum) {
      if (s.band === 'beginner') expect(s.mode, `${s.id}`).toBe('name')
    }
  })

  it('frontier = a journey region’s NEW notes, including pre-loaded-new (dilution fix §4.2)', () => {
    const r3name = JOURNEY_STAGES.find((s) => s.id === 'r3-name')!
    const frontier = frontierNoteNames(r3name)
    // Region 3 adds A4 (pre-loaded) + E3 D3 C3 B4 C5 (laddered). All must be frontier.
    expect(frontier.sort()).toEqual(['A4', 'B4', 'C3', 'C5', 'D3', 'E3'].sort())
    // The pre-loaded-new note (A4) sits BELOW startCount, so a position-only rule
    // would miss it — this is exactly the note the gate/weighting must not skip.
    expect(frontier).toContain('A4')
    // It does NOT include carried-over already-known notes (e.g. C4 from Region 1).
    expect(frontier).not.toContain('C4')
  })

  it('frontier for a sidequest = the notes that ladder in above startCount', () => {
    const sq = NOTE_SETS.find((s) => s.id === 'sq-treble-4')! // whole treble staff
    // startCount 5 (line notes pre-loaded), ladder adds the 4 space notes.
    expect(frontierNoteNames(sq).sort()).toEqual(['A4', 'C5', 'E5', 'F4'].sort())
  })

  const ids = new Set<string>()
  it('level ids are unique', () => {
    for (const s of curriculum as NoteSet[]) {
      expect(ids.has(s.id), `dup ${s.id}`).toBe(false)
      ids.add(s.id)
    }
  })
})
