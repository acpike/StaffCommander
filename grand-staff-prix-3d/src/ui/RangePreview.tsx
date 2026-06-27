import { useMemo } from 'react'
import { diatonicOfName, bottomLineDiatonic, grandClefFor } from '../data/notes'

// Bravura clef codepoints + the step (from the staff's bottom line) the glyph registers on.
const CLEF_GLYPH = { bass: 0xe062, treble: 0xe050 } as const
const CLEF_STEP = { bass: 6, treble: 2 } as const
const PG = 14 // staff space (px) in the preview viewBox
const PINK = '#1a1726' // staff/note ink
const PLINE = '#c8cdd7' // faint staff lines

/**
 * Grand-staff RANGE preview: a region's LOWEST and HIGHEST notes, spread low-left →
 * high-right and joined by a solid connector ("…and everything in between"). Shared by
 * the placement picker AND the learning-journey cards so kids recognise the range
 * visually instead of decoding "A3–E4". Renders just the <svg> — wrap it in a sized,
 * light-background container (the SVG fits via preserveAspectRatio="meet").
 */
export function RangePreview({ ladder }: { ladder: string[] }) {
  const { low, high } = useMemo(() => {
    const sorted = Array.from(new Set(ladder)).sort((a, b) => diatonicOfName(a) - diatonicOfName(b))
    return { low: sorted[0], high: sorted[sorted.length - 1] }
  }, [ladder])

  const clefs = ['bass', 'treble'] as const
  const lines: number[] = []
  for (const c of clefs) {
    const b = bottomLineDiatonic(c)
    for (const s of [0, 2, 4, 6, 8]) lines.push(b + s)
  }
  const dLow = diatonicOfName(low)
  const dHigh = diatonicOfName(high)
  const topD = Math.max(...lines, dHigh) + 2
  const botD = Math.min(...lines, dLow) - 2
  const yStep = PG / 2
  // split the grand staff at middle C so treble + bass read as clearly separate
  const GAP = PG * 1.5
  const dMid = diatonicOfName('C4')
  const splitOf = (d: number) => (d > dMid ? -GAP : d < dMid ? GAP : 0)
  const yOf = (d: number) => 12 + GAP + (topD - d) * yStep + splitOf(d)
  const height = yOf(botD) + 12
  // keep a consistent WIDE aspect so the staff fills its tile (low note just after
  // the clef, high note out to the right)
  const width = height * 3.8
  const xL = 28
  const xR = width * 0.93
  const xLow = 96
  const xHigh = width * 0.82
  const staffTopY = yOf(Math.max(...lines))
  const staffBotY = yOf(Math.min(...lines))

  const ledgersFor = (name: string, d: number): number[] => {
    const lo = bottomLineDiatonic(grandClefFor(name))
    const hi = lo + 8
    const out: number[] = []
    if (d < lo) for (let L = lo - 2; L >= d; L -= 2) out.push(L)
    else if (d > hi) for (let L = hi + 2; L <= d; L += 2) out.push(L)
    return out
  }
  const Note = ({ name, d, x }: { name: string; d: number; x: number }) => (
    <g>
      {ledgersFor(name, d).map((L) => (
        <line key={L} x1={x - PG * 0.95} y1={yOf(L)} x2={x + PG * 0.95} y2={yOf(L)} stroke={PINK} strokeWidth={1.5} strokeLinecap="round" />
      ))}
      <ellipse cx={x} cy={yOf(d)} rx={PG * 0.62} ry={PG * 0.48} transform={`rotate(-20 ${x} ${yOf(d)})`} fill={PINK} />
    </g>
  )

  // solid connector, inset off both noteheads so it leaves a little space
  const cy1 = yOf(dLow)
  const cy2 = yOf(dHigh)
  const cLen = Math.hypot(xHigh - xLow, cy2 - cy1) || 1
  const cInset = PG * 1.25
  const cdx = ((xHigh - xLow) / cLen) * cInset
  const cdy = ((cy2 - cy1) / cLen) * cInset

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="rangeStaff" preserveAspectRatio="xMidYMid meet" aria-label={`range ${low} to ${high}`}>
      {lines.map((d, i) => (
        <line key={i} x1={xL} y1={yOf(d)} x2={xR} y2={yOf(d)} stroke={PLINE} strokeWidth={1.4} />
      ))}
      <rect x={xL - 6} y={staffTopY} width={3} height={staffBotY - staffTopY} rx={1.5} fill={PINK} />
      <line x1={xL} y1={staffTopY} x2={xL} y2={staffBotY} stroke={PINK} strokeWidth={1.6} />
      {clefs.map((c) => (
        <text key={c} x={xL + 5} y={yOf(bottomLineDiatonic(c) + CLEF_STEP[c])} fontFamily="Bravura" fontSize={4 * PG} fill={PINK}>
          {String.fromCharCode(CLEF_GLYPH[c])}
        </text>
      ))}
      <line x1={xLow + cdx} y1={cy1 + cdy} x2={xHigh - cdx} y2={cy2 - cdy} stroke="#00a88f" strokeWidth={2.6} strokeLinecap="round" />
      <Note name={low} d={dLow} x={xLow} />
      <Note name={high} d={dHigh} x={xHigh} />
    </svg>
  )
}
