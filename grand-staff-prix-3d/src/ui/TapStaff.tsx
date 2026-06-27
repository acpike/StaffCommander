import { useMemo, useRef } from 'react'
import { bottomLineDiatonic, diatonicOfName, grandClefFor, type Clef } from '../data/notes'

export type StaffKind = Clef | 'grand'

// SMuFL codepoints (Bravura) + clef registration lines.
const CLEF_GLYPH: Record<Clef, number> = { treble: 0xe050, bass: 0xe062, alto: 0xe05c, tenor: 0xe05c }
const CLEF_LINE_STEP: Record<Clef, number> = { treble: 2, bass: 6, alto: 4, tenor: 6 } // step (from bottom) the glyph sits on
const CLEF_REG_FROM_TOP: Record<Clef, number> = { treble: 3, bass: 1, alto: 2, tenor: 1 } // line index from top (icon)

const G = 16 // staff space, px
const COLW = 27
const NOTES_START = 58
const INK = '#14121c' // clefs, noteheads, ledgers, barline/brace — the dark focus elements
const LINE = '#c8cdd7' // the 5 staff lines: faint + thin (matches RangePreview's clean look)

/**
 * Interactive staff picker. Notes sit at their true positions (diatonic math).
 * Tap a note to toggle it, or DRAG across the staff to paint a run of notes.
 * Supports a single clef or a full grand staff (treble+bass, braced).
 */
export function TapStaff({
  clef,
  notes,
  selected,
  onSet,
}: {
  clef: StaffKind
  notes: string[]
  selected: Set<string>
  onSet: (name: string, on: boolean) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const paint = useRef<boolean | null>(null)
  const lastCol = useRef(-1)

  const clefs: Clef[] = clef === 'grand' ? ['bass', 'treble'] : [clef]
  const lines = useMemo(() => {
    const out: number[] = []
    for (const c of clefs) {
      const b = bottomLineDiatonic(c)
      for (const s of [0, 2, 4, 6, 8]) out.push(b + s)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clef])
  const noteDs = useMemo(() => notes.map(diatonicOfName), [notes])

  const topD = Math.max(...lines, ...noteDs) + 1
  const botD = Math.min(...lines, ...noteDs) - 1
  const yStep = G / 2
  // grand staff: split treble + bass apart at middle C with a gap (the classic grand-staff
  // spacing, same as RangePreview) so the two staves + their clefs read clearly instead of
  // colliding into a jumble. Single-clef staves are unaffected (GAP = 0).
  const GAP = clef === 'grand' ? G * 1.5 : 0
  const dMid = diatonicOfName('C4')
  const splitOf = (d: number) => (GAP ? (d > dMid ? -GAP : d < dMid ? GAP : 0) : 0)
  const yOf = (d: number) => 18 + GAP + (topD - d) * yStep + splitOf(d)
  const height = yOf(botD) + 18
  const width = NOTES_START + notes.length * COLW + 16
  const staffTopY = yOf(Math.max(...lines))
  const staffBotY = yOf(Math.min(...lines))
  const staffOf = (name: string): Clef => (clef === 'grand' ? grandClefFor(name) : (clef as Clef))

  // ── tap + drag-to-paint ──
  const colAt = (clientX: number): number => {
    const svg = svgRef.current
    if (!svg) return -1
    const r = svg.getBoundingClientRect()
    const vbX = ((clientX - r.left) / r.width) * width
    const i = Math.floor((vbX - NOTES_START) / COLW)
    return i >= 0 && i < notes.length ? i : -1
  }
  const applyCol = (i: number) => {
    if (i < 0 || paint.current === null) return
    const from = lastCol.current
    if (from >= 0 && Math.abs(i - from) > 1) {
      const step = i > from ? 1 : -1
      for (let k = from + step; k !== i; k += step) onSet(notes[k], paint.current)
    }
    onSet(notes[i], paint.current)
    lastCol.current = i
  }
  const onDown = (e: React.PointerEvent) => {
    const i = colAt(e.clientX)
    if (i < 0) return
    paint.current = !selected.has(notes[i])
    lastCol.current = -1
    applyCol(i)
    svgRef.current?.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (paint.current !== null) applyCol(colAt(e.clientX))
  }
  const onUp = () => {
    paint.current = null
    lastCol.current = -1
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="tapStaff"
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="group"
      aria-label={`${clef} staff picker`}
    >
      {lines.map((d, i) => (
        <line key={i} x1={8} y1={yOf(d)} x2={width - 8} y2={yOf(d)} stroke={LINE} strokeWidth={1.4} />
      ))}
      <line x1={8} y1={staffTopY} x2={8} y2={staffBotY} stroke={INK} strokeWidth={1.8} />
      {clef === 'grand' && <rect x={2} y={staffTopY} width={4} height={staffBotY - staffTopY} rx={2} fill={INK} />}
      {clefs.map((c) => (
        <text key={c} x={14} y={yOf(bottomLineDiatonic(c) + CLEF_LINE_STEP[c])} fontFamily="Bravura" fontSize={4 * G} fill={INK}>
          {String.fromCharCode(CLEF_GLYPH[c])}
        </text>
      ))}
      {notes.map((n, i) => {
        const d = noteDs[i]
        const lo = bottomLineDiatonic(staffOf(n))
        const hi = lo + 8
        const x = NOTES_START + i * COLW + COLW / 2
        const y = yOf(d)
        const on = selected.has(n)
        const led: number[] = []
        if (d < lo) for (let L = lo - 2; L >= d; L -= 2) led.push(L)
        else if (d > hi) for (let L = hi + 2; L <= d; L += 2) led.push(L)
        return (
          <g key={n} style={{ pointerEvents: 'none' }}>
            {led.map((L) => (
              <line key={L} x1={x - G * 0.95} y1={yOf(L)} x2={x + G * 0.95} y2={yOf(L)} stroke={INK} strokeWidth={1.7} strokeLinecap="round" />
            ))}
            <ellipse
              cx={x}
              cy={y}
              rx={G * 0.64}
              ry={G * 0.5}
              transform={`rotate(-20 ${x} ${y})`}
              fill={on ? INK : 'rgba(20,18,28,0.07)'}
              stroke={on ? INK : 'rgba(20,18,28,0.4)'}
              strokeWidth={1.6}
            />
          </g>
        )
      })}
    </svg>
  )
}

/** Small clef-on-a-staff icon for the clef selector. The clef sits ON the staff (its
 *  baseline registers on the correct line) instead of floating off in the margin. */
export function ClefIcon({ kind }: { kind: StaffKind }) {
  const g = 6 // staff space
  const staffH = 4 * g // staff height = font em (SMuFL: 4 spaces = 1em)
  const staves: Clef[] = kind === 'grand' ? ['treble', 'bass'] : [kind]
  const between = kind === 'grand' ? g * 1.6 : 0
  const padY = g * 2 // room for the treble tail / clef extensions above + below
  const braceX = 3 // left barline for the grand staff
  const lineL = kind === 'grand' ? 7 : 4 // staff lines start here; the clef overlaps from here
  const width = 40
  const lineR = width - 4
  const height = staves.length * staffH + (staves.length - 1) * between + padY * 2
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="clefIconSvg" aria-hidden>
      {kind === 'grand' && (
        <line x1={braceX} y1={padY} x2={braceX} y2={height - padY} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      )}
      {staves.map((c, si) => {
        const top = padY + si * (staffH + between)
        return (
          <g key={c}>
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1={lineL} y1={top + i * g} x2={lineR} y2={top + i * g} stroke="currentColor" strokeWidth={0.9} />
            ))}
            <text x={lineL} y={top + CLEF_REG_FROM_TOP[c] * g} fontFamily="Bravura" fontSize={staffH} fill="currentColor">
              {String.fromCharCode(CLEF_GLYPH[c])}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
