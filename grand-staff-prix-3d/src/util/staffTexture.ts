// Renders a single note on a five-line staff with a real SMuFL clef + notehead
// (Bravura font, vendored in /public/fonts). Used by the HUD note card. Drawing
// is derived from staffStep() so every note lands in the musically correct spot.

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
) {
  const cssW = canvas.clientWidth || 240
  const cssH = canvas.clientHeight || 150
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  // Staff geometry. gap = distance between adjacent staff lines (one staff space).
  const gap = Math.round(Math.min(cssH / 7.5, cssW / 11))
  const staffSpace = gap // one space = one gap
  const staffWidth = gap * 7.2
  const left = (cssW - staffWidth) / 2
  const right = left + staffWidth
  // Vertically center the 4-gap staff in the card.
  const middleY = cssH / 2
  const bottomLineY = middleY + 2 * gap // bottom line is 2 gaps below the middle line

  const yOfStep = (step: number) => bottomLineY - step * (gap / 2)

  // ── staff lines (steps 0,2,4,6,8) ──
  ctx.strokeStyle = colors.staff
  ctx.lineWidth = Math.max(1, gap * 0.07)
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
  } else {
    // fClef registration sits on the F line = staff step 6.
    ctx.fillText(GLYPH.fClef, clefX, yOfStep(6))
  }

  // ── notehead ──
  const step = staffStep(note)
  const noteX = left + staffWidth * 0.62
  const noteY = yOfStep(step)

  // Ledger lines for notes outside the staff.
  ctx.strokeStyle = colors.staff
  ctx.lineWidth = Math.max(1, gap * 0.08)
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
  ctx.lineWidth = Math.max(1.4, gap * 0.11)
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
