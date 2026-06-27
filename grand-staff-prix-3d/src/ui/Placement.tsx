import { useMemo } from 'react'
import { useGame } from '../state/store'
import { REGIONS, diatonicOfName, bottomLineDiatonic, grandClefFor } from '../data/notes'
import { MenuBackground } from './MenuBackground'
import { Icon } from './icons'

// Bravura clef codepoints + the step (from the staff's bottom line) the glyph registers on.
const CLEF_GLYPH = { bass: 0xe062, treble: 0xe050 } as const
const CLEF_STEP = { bass: 6, treble: 2 } as const
const PG = 14 // staff space (px) in the preview viewBox
const PINK = '#1a1726' // staff/note ink
const PLINE = '#c8cdd7' // faint staff lines

/**
 * Grand-staff RANGE preview: just the region's LOWEST and HIGHEST notes, joined
 * by a dashed connector that reads "…and everything in between." Scales to any
 * region (a wider range is simply a longer connector). Beats showing a "middle"
 * note (always lands on Middle C since the regions are centred there) or showing
 * every note (Region 7 has 37 — far too many to fit).
 */
function RangePreview({ ladder }: { ladder: string[] }) {
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
  // Split the grand staff at middle C and push the two staves apart by GAP each, so
  // treble + bass read as clearly separate (middle C sits alone in the widened gap).
  const GAP = PG * 1.5
  const dMid = diatonicOfName('C4')
  const splitOf = (d: number) => (d > dMid ? -GAP : d < dMid ? GAP : 0)
  const yOf = (d: number) => 12 + GAP + (topD - d) * yStep + splitOf(d)
  const height = yOf(botD) + 12
  // Keep a consistent WIDE aspect (≈ the tile) for every region so the staff fills
  // the tile instead of floating small in the centre; all x-positions scale with it.
  const width = height * 3.8
  const xL = 28 // staff left
  const xR = width * 0.93 // staff right
  const xLow = 96 // low note sits just after the clef — natural, not floating
  const xHigh = width * 0.82 // high note out to the right (wide, readable span)
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

  // Solid span connector, inset off both noteheads so it leaves a little space.
  const cy1 = yOf(dLow)
  const cy2 = yOf(dHigh)
  const cLen = Math.hypot(xHigh - xLow, cy2 - cy1) || 1
  const cInset = PG * 1.25
  const cdx = ((xHigh - xLow) / cLen) * cInset
  const cdy = ((cy2 - cy1) / cLen) * cInset

  return (
    <div className="placePrev">
      <svg viewBox={`0 0 ${width} ${height}`} className="tapStaff" preserveAspectRatio="xMidYMid meet" aria-label={`range ${low} to ${high}`}>
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
        {/* solid span connector: low (left) → high (right), inset off the noteheads */}
        <line x1={xLow + cdx} y1={cy1 + cdy} x2={xHigh - cdx} y2={cy2 - cdy} stroke="#00a88f" strokeWidth={2.6} strokeLinecap="round" />
        <Note name={low} d={dLow} x={xLow} />
        <Note name={high} d={dHigh} x={xHigh} />
      </svg>
    </div>
  )
}

// ───────────────────────── milestone-ladder picker ─────────────────────────
function Picker() {
  const startPlacement = useGame((s) => s.startPlacement)
  const placeNewStudent = useGame((s) => s.placeNewStudent)
  return (
    <div className="sheet placeSheet">
      <div className="topbar">
        <button className="chip ghost" onClick={placeNewStudent}>
          {Icon.back} Skip
        </button>
        <div className="chip head">Find your level</div>
      </div>

      <div className="card sec">
        <div className="secLabel">Brand new?</div>
        <p className="tiny">
          Not sure where you fit yet? Start at the very beginning — we'll grow from there.
        </p>
        <button className="btn" onClick={placeNewStudent} style={{ marginTop: 8 }}>
          {Icon.play} I'm brand new — start at the beginning
        </button>
      </div>

      <div className="card sec">
        <div className="secLabel">Already read some notes?</div>
        <p className="tiny">
          Pick the range you think you can read — we'll give you a quick check and start you in the right place.
        </p>
        <div className="placeGrid">
          {REGIONS.map((r) => (
            <button
              key={r.n}
              className="placeCard"
              onClick={() => (r.n === 1 ? placeNewStudent() : startPlacement(r.n))}
            >
              <div className="placeHead">
                <span className="placeNum">{r.n}</span>
                <span className="placeName">{r.name}</span>
                <span className="placeRange">{r.range}</span>
              </div>
              <RangePreview ladder={r.ladder} />
              <span className="placeGo">{r.n === 1 ? 'Start here' : 'Check this →'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── result (pass / step-down / floor) ─────────────────────────
function Result() {
  const placement = useGame((s) => s.placement)
  const startPlacement = useGame((s) => s.startPlacement)
  const placeNewStudent = useGame((s) => s.placeNewStudent)
  const endPlacement = useGame((s) => s.endPlacement)
  if (!placement) return null

  const pct = Math.round(placement.accuracy * 100)
  const region = REGIONS.find((r) => r.n === placement.region)
  const placedRegion = placement.placedStageId
    ? REGIONS.find((r) => placement.placedStageId!.startsWith(`r${r.n}-`))
    : undefined

  // Passed → placed at this region's Find stage.
  if (placement.passed) {
    return (
      <div className="sheet placeSheet">
        <div className="card sec placeResult win">
          <div className="secLabel">Nice reading!</div>
          <div className="placeBig">{pct}%</div>
          <p>
            You placed at <b>{region?.name}</b> — starting on <b>Find</b>. Everything below it is already in
            the bag.
          </p>
          <button className="btn" onClick={endPlacement} style={{ marginTop: 10 }}>
            {Icon.play} Let's race
          </button>
        </div>
      </div>
    )
  }

  // Missed but there's a lower region to try — offer the step-down.
  if (placement.nextRegion != null) {
    const next = REGIONS.find((r) => r.n === placement.nextRegion)
    return (
      <div className="sheet placeSheet">
        <div className="card sec placeResult">
          <div className="secLabel">Let's try a little lower</div>
          <div className="placeBig">{pct}%</div>
          <p>
            <b>{region?.name}</b> was a stretch. Let's check <b>{next?.name}</b> ({next?.range}) instead.
          </p>
          <button className="btn" onClick={() => startPlacement(placement.nextRegion!)} style={{ marginTop: 10 }}>
            {Icon.play} Check {next?.name}
          </button>
          <button className="btn ghost" onClick={placeNewStudent} style={{ marginTop: 8 }}>
            Just start at the beginning
          </button>
        </div>
      </div>
    )
  }

  // Stepped all the way down to the floor — start at the beginning.
  return (
    <div className="sheet placeSheet">
      <div className="card sec placeResult">
        <div className="secLabel">We'll start at the beginning</div>
        <p>
          No problem — everyone starts somewhere. You'll begin at <b>{placedRegion?.name ?? 'Middle C'}</b> and
          build up from there.
        </p>
        <button className="btn" onClick={endPlacement} style={{ marginTop: 10 }}>
          {Icon.play} Let's race
        </button>
      </div>
    </div>
  )
}

/** New-student placement flow (spec §9): the milestone-ladder picker + result. */
export function Placement() {
  const phase = useGame((s) => s.placement?.phase)
  return (
    <div className="overlay">
      <MenuBackground />
      {phase === 'result' ? <Result /> : <Picker />}
    </div>
  )
}
