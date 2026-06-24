import { useMemo } from 'react'
import { bottomLineDiatonic, diatonicOfName, grandClefFor, type Clef } from '../data/notes'

export type StaffKind = Clef | 'grand'

// SMuFL codepoints (Bravura) + the staff step each clef glyph registers on.
const CLEF_GLYPH: Record<Clef, number> = { treble: 0xe050, bass: 0xe062, alto: 0xe05c, tenor: 0xe05c }
const CLEF_LINE_STEP: Record<Clef, number> = { treble: 2, bass: 6, alto: 4, tenor: 6 }

/**
 * Interactive staff picker. Every candidate note is a tappable notehead at its
 * true staff position (positions derived from diatonic value, the same math the
 * game uses). Supports a single clef or a full grand staff (treble + bass), with
 * notes auto-placed on the correct stave and ledger lines drawn as needed.
 */
export function TapStaff({
  clef,
  notes,
  selected,
  onToggle,
}: {
  clef: StaffKind
  notes: string[] // candidate note names, low → high
  selected: Set<string>
  onToggle: (n: string) => void
}) {
  const G = 16 // one staff space, px
  const yStep = G / 2 // px per diatonic step
  const colW = 27
  const ink = '#14121c'
  const notesStart = 58

  const clefs: Clef[] = clef === 'grand' ? ['bass', 'treble'] : [clef]

  const lines = useMemo(() => {
    const out: { clef: Clef; d: number }[] = []
    for (const c of clefs) {
      const b = bottomLineDiatonic(c)
      for (const s of [0, 2, 4, 6, 8]) out.push({ clef: c, d: b + s })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clef])

  const noteDs = useMemo(() => notes.map((n) => diatonicOfName(n)), [notes])
  const lineDs = lines.map((l) => l.d)
  const topD = Math.max(...lineDs, ...noteDs) + 1
  const botD = Math.min(...lineDs, ...noteDs) - 1
  const topY = 18
  const yOf = (d: number) => topY + (topD - d) * yStep
  const height = yOf(botD) + 18
  const width = notesStart + notes.length * colW + 16
  const staffTopY = yOf(Math.max(...lineDs))
  const staffBotY = yOf(Math.min(...lineDs))

  const staffOf = (name: string): Clef => (clef === 'grand' ? grandClefFor(name) : (clef as Clef))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="tapStaff" preserveAspectRatio="xMidYMid meet" role="group" aria-label={`${clef} staff picker`}>
      {/* staff lines */}
      {lines.map((l, i) => (
        <line key={i} x1={8} y1={yOf(l.d)} x2={width - 8} y2={yOf(l.d)} stroke={ink} strokeWidth={1.7} strokeLinecap="round" />
      ))}
      {/* left barline joining the staves */}
      <line x1={8} y1={staffTopY} x2={8} y2={staffBotY} stroke={ink} strokeWidth={2.2} />
      {/* grand-staff brace bracket */}
      {clef === 'grand' && <rect x={2} y={staffTopY} width={4} height={staffBotY - staffTopY} rx={2} fill={ink} />}
      {/* clef(s) */}
      {clefs.map((c) => (
        <text key={c} x={14} y={yOf(bottomLineDiatonic(c) + CLEF_LINE_STEP[c])} fontFamily="Bravura" fontSize={4 * G} fill={ink}>
          {String.fromCharCode(CLEF_GLYPH[c])}
        </text>
      ))}
      {/* notes */}
      {notes.map((n, i) => {
        const d = noteDs[i]
        const st = staffOf(n)
        const lo = bottomLineDiatonic(st)
        const hi = lo + 8
        const x = notesStart + i * colW + colW / 2
        const y = yOf(d)
        const on = selected.has(n)
        const ledgers: number[] = []
        if (d < lo) for (let L = lo - 2; L >= d; L -= 2) ledgers.push(L)
        else if (d > hi) for (let L = hi + 2; L <= d; L += 2) ledgers.push(L)
        return (
          <g key={n} onClick={() => onToggle(n)} style={{ cursor: 'pointer' }}>
            <rect x={x - colW / 2} y={4} width={colW} height={height - 8} fill="transparent" />
            {ledgers.map((L) => (
              <line key={L} x1={x - G * 0.95} y1={yOf(L)} x2={x + G * 0.95} y2={yOf(L)} stroke={ink} strokeWidth={1.7} strokeLinecap="round" />
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
