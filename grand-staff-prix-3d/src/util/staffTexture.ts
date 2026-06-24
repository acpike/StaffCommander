// Renders a single note on a five-line staff with a real SMuFL clef + notehead
// (Bravura font, vendored in /public/fonts). Used by the HUD note card. Drawing
// is derived from staffStep() so every note lands in the musically correct spot.

import * as THREE from 'three'
import { staffStep, type GameNote } from '../data/notes'

// SMuFL codepoints (Bravura).
const GLYPH = {
  gClef: '',
  fClef: '',
  noteheadBlack: '',
}

export interface CardColors {
  bg: string
  staff: string
  note: string
  clef: string
}

/**
 * Draw the note card. `cssW`/`cssH` are layout pixels; the canvas backing store
 * is scaled by dpr for crispness. Call whenever the note changes.
 */
export function drawNoteCard(
  canvas: HTMLCanvasElement,
  note: GameNote,
  colors: CardColors,
  dpr = Math.min(window.devicePixelRatio || 1, 3),
  size?: { w: number; h: number },
  tight = false, // fill more of the canvas (used by the gate blocks)
) {
  const cssW = size?.w ?? (canvas.clientWidth || 240)
  const cssH = size?.h ?? (canvas.clientHeight || 150)
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)
  // optional opaque background (used by the gate-block texture; the HUD card
  // passes 'transparent' so its own frosted div shows through)
  if (colors.bg && colors.bg !== 'transparent') {
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, cssW, cssH)
  }

  // Staff geometry. gap = distance between adjacent staff lines (one staff space).
  const gap = Math.round(Math.min(cssH / (tight ? 5.2 : 7.5), cssW / (tight ? 8 : 11)))
  const boldF = tight ? 2.1 : 1 // much thicker lines on the gate blocks so they read at speed
  const staffSpace = gap // one space = one gap
  const staffWidth = gap * 7.2
  const left = (cssW - staffWidth) / 2
  const right = left + staffWidth
  // Center the staff, then nudge the whole thing up/down ONLY if the note would
  // fall off the card. Staff stays the same size; extreme ledger notes stay visible.
  const middleY = cssH / 2
  const naturalBottom = middleY + 2 * gap // bottom line is 2 gaps below the middle line
  const noteStep = staffStep(note)
  const naturalNoteY = naturalBottom - noteStep * (gap / 2)
  const edge = gap * 1.7 // keep the notehead + a ledger clear of the edge
  let shift = 0
  if (naturalNoteY < edge) shift = edge - naturalNoteY
  else if (naturalNoteY > cssH - edge) shift = cssH - edge - naturalNoteY
  const bottomLineY = naturalBottom + shift

  const yOfStep = (step: number) => bottomLineY - step * (gap / 2)

  // ── staff lines (steps 0,2,4,6,8) ──
  ctx.strokeStyle = colors.staff
  ctx.lineWidth = Math.max(1.5, gap * 0.07 * boldF)
  ctx.lineCap = 'round'
  for (let s = 0; s <= 8; s += 2) {
    const y = yOfStep(s)
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }

  // ── clef ──
  // Bravura is sized so 1 em = 4 staff spaces; set font size = 4 * staffSpace.
  const fontPx = 4 * staffSpace
  ctx.font = `${fontPx}px Bravura`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = colors.clef
  const clefX = left + gap * 0.35
  if (note.clef === 'treble') {
    // gClef registration sits on the G line = staff step 2.
    ctx.fillText(GLYPH.gClef, clefX, yOfStep(2))
  } else if (note.clef === 'bass') {
    // fClef registration sits on the F line = staff step 6.
    ctx.fillText(GLYPH.fClef, clefX, yOfStep(6))
  } else if (note.clef === 'alto') {
    // C-clef (U+E05C) centred on middle C — alto = middle line (step 4).
    ctx.fillText(String.fromCharCode(0xe05c), clefX, yOfStep(4))
  } else {
    // tenor C-clef centred on middle C = 4th line (step 6).
    ctx.fillText(String.fromCharCode(0xe05c), clefX, yOfStep(6))
  }

  // ── notehead ──
  const step = staffStep(note)
  const noteX = left + staffWidth * 0.62
  const noteY = yOfStep(step)

  // Ledger lines for notes outside the staff.
  ctx.strokeStyle = colors.staff
  ctx.lineWidth = Math.max(1.5, gap * 0.08 * boldF)
  const ledgerHalf = gap * 0.9
  if (step < 0) {
    for (let s = -2; s >= step; s -= 2) {
      const y = yOfStep(s)
      ctx.beginPath()
      ctx.moveTo(noteX - ledgerHalf, y)
      ctx.lineTo(noteX + ledgerHalf, y)
      ctx.stroke()
    }
  } else if (step > 8) {
    for (let s = 10; s <= step; s += 2) {
      const y = yOfStep(s)
      ctx.beginPath()
      ctx.moveTo(noteX - ledgerHalf, y)
      ctx.lineTo(noteX + ledgerHalf, y)
      ctx.stroke()
    }
  }

  // Stem: up (right side) for notes below the middle line, else down (left side).
  const stemUp = step < 4
  const stemLen = gap * 3.3
  ctx.strokeStyle = colors.note
  ctx.lineWidth = Math.max(1.8, gap * 0.11 * boldF)
  ctx.beginPath()
  if (stemUp) {
    const sx = noteX + staffSpace * 0.62
    ctx.moveTo(sx, noteY - gap * 0.05)
    ctx.lineTo(sx, noteY - stemLen)
  } else {
    const sx = noteX - staffSpace * 0.62
    ctx.moveTo(sx, noteY + gap * 0.05)
    ctx.lineTo(sx, noteY + stemLen)
  }
  ctx.stroke()

  // Notehead glyph (centered on its baseline).
  ctx.font = `${fontPx}px Bravura`
  ctx.fillStyle = colors.note
  ctx.textAlign = 'center'
  ctx.fillText(GLYPH.noteheadBlack, noteX, noteY)
}

/** Ensure the Bravura font is loaded before first paint (avoids a blank glyph). */
export async function ensureMusicFont(): Promise<void> {
  if (!('fonts' in document)) return
  try {
    await (document as Document).fonts.load('48px Bravura')
    await (document as Document).fonts.ready
  } catch {
    /* fall back to whatever renders */
  }
}

/** Render a note's staff to a CanvasTexture — for the "find the note" gate blocks. */
export function noteToStaffTexture(note: GameNote, w = 384, h = 360): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  drawNoteCard(
    canvas,
    note,
    { bg: '#ffffff', staff: '#000000', note: '#000000', clef: '#000000' },
    Math.min(window.devicePixelRatio || 1, 2),
    { w, h },
    true,
  )
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}
