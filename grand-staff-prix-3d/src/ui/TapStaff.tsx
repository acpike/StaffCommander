import { useMemo } from 'react'
import { makeNote, staffStep, type Clef } from '../data/notes'

// SMuFL codepoints (Bravura, vendored in /public/fonts).
const CLEF_GLYPH: Record<Clef, string> = {
  treble: '', // gClef
  bass: '', // fClef
  alto: '', // cClef
  tenor: '', // cClef
}
// Staff step the clef glyph registers on (treble G line = 2, bass F line = 6,
// alto middle-C line = 4, tenor middle-C line = 6).
const CLEF_LINE: Record<Clef, number> = { treble: 2, bass: 6, alto: 4, tenor: 6 }

/**
 * Interactive staff: every candidate note is drawn as a tappable notehead at its
 * true staff position (via staffStep). Tap to include/exclude it in the level.
 * This is the inverse of drawNoteCard — same position math, made selectable.
 */
export function TapStaff({
  clef,
  notes,
  selected,
  onToggle,
}: {
  clef: Clef
  notes: string[] // candidate note names, low → high
  selected: Set<string>
  onToggle: (n: string) => void
}) {
  const G = 16 // one staff space, px
  const colW = 34 // horizontal spacing per note
  const steps = useMemo(() => notes.map((n) => staffStep(makeNote(n, clef))), [notes, clef])

  const maxStep = Math.max(8, ...steps)
  const minStep = Math.min(0, ...steps)
  const topPad = 30
  const botPad = 26
  const clefPad = 52
  const yOf = (step: number) => topPad + (maxStep - step) * (G / 2)
  const height = yOf(minStep) + botPad
  const width = clefPad + notes.length * colW + 16
  const lineSteps = [0, 2, 4, 6, 8]
  const ink = '#14121c'

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="tapStaff"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={`${clef} staff note picker`}
    >
      {/* staff lines */}
      {lineSteps.map((s) => (
        <line key={s} x1={8} y1={yOf(s)} x2={width - 8} y2={yOf(s)} stroke={ink} strokeWidth={1.7} strokeLinecap="round" />
      ))}
      {/* clef */}
      <text x={12} y={yOf(CLEF_LINE[clef])} fontFamily="Bravura" fontSize={4 * G} fill={ink}>
        {CLEF_GLYPH[clef]}
      </text>
      {/* notes */}
      {notes.map((n, i) => {
        const step = steps[i]
        const x = clefPad + i * colW + colW / 2
        const y = yOf(step)
        const on = selected.has(n)
        const ledgers: number[] = []
        if (step < 0) for (let s = -2; s >= step; s -= 2) ledgers.push(s)
        if (step > 8) for (let s = 10; s <= step; s += 2) ledgers.push(s)
        return (
          <g key={n} onClick={() => onToggle(n)} style={{ cursor: 'pointer' }}>
            {/* finger-friendly tap target spanning the full column height */}
            <rect x={x - colW / 2} y={4} width={colW} height={height - 8} fill="transparent" />
            {ledgers.map((s) => (
              <line key={s} x1={x - G * 0.95} y1={yOf(s)} x2={x + G * 0.95} y2={yOf(s)} stroke={ink} strokeWidth={1.7} strokeLinecap="round" />
            ))}
            <ellipse
              cx={x}
              cy={y}
              rx={G * 0.64}
              ry={G * 0.5}
              transform={`rotate(-20 ${x} ${y})`}
              fill={on ? ink : 'rgba(20,18,28,0.08)'}
              stroke={on ? ink : 'rgba(20,18,28,0.45)'}
              strokeWidth={1.6}
            />
          </g>
        )
      })}
    </svg>
  )
}
