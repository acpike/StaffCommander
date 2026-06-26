// SVG rhythmic-notation renderer for Beat Builder's REVEAL phase.
//
// Renders a Pattern as a single-line rhythm staff: stems, filled/open noteheads,
// flags-or-beams, dots, and rests — beamed BY BEAT so eighths/sixteenths group
// the way they're read. Takadimi syllables are drawn under each sounding note.
//
// This is hand-rolled SVG (no VexFlow). It aims for clean, readable notation:
// noteheads are ellipses, stems thin rects, beams thick slanted bars, sixteenth
// beams doubled. Bar lines separate measures. Not engraving-grade, but tidy.

import { flatten, type Pattern } from '../../shared/audio/patterns'

interface NoteToken {
  /** Absolute beat position from pattern start. */
  beat: number
  /** Duration in beats. */
  beats: number
  isRest: boolean
  syllable: string
  /** Index within its containing beat-group (for beaming). */
}

// Classify a duration (in beats, quarter = 1) into a note "kind".
type NoteKind = 'whole' | 'dottedHalf' | 'half' | 'dottedQuarter' | 'quarter' | 'dottedEighth' | 'eighth' | 'sixteenth' | 'other'

function classify(beats: number): { kind: NoteKind; dotted: boolean; flags: number } {
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.02
  if (eq(beats, 4)) return { kind: 'whole', dotted: false, flags: 0 }
  if (eq(beats, 3)) return { kind: 'dottedHalf', dotted: true, flags: 0 }
  if (eq(beats, 2)) return { kind: 'half', dotted: false, flags: 0 }
  if (eq(beats, 1.5)) return { kind: 'dottedQuarter', dotted: true, flags: 0 }
  if (eq(beats, 1)) return { kind: 'quarter', dotted: false, flags: 0 }
  if (eq(beats, 0.75)) return { kind: 'dottedEighth', dotted: true, flags: 1 }
  if (eq(beats, 0.5)) return { kind: 'eighth', dotted: false, flags: 1 }
  if (eq(beats, 0.25)) return { kind: 'sixteenth', dotted: false, flags: 2 }
  return { kind: 'other', dotted: false, flags: 0 }
}

interface NotationProps {
  pattern: Pattern
  /** Show Takadimi syllables under notes. Default true. */
  showSyllables?: boolean
  /** Accent color for the staff line + syllables. */
  accent?: string
  /** 0..1 normalized playhead position over the notation (or null = hidden). */
  playhead?: number | null
  height?: number
}

export function Notation({
  pattern,
  showSyllables = true,
  accent = '#34d399',
  playhead = null,
  height = 150,
}: NotationProps) {
  const { beatsPerBar } = pattern
  const events = flatten(pattern)
  const totalBeats = pattern.cells.reduce((s, c) => s + c.beats, 0)
  const bars = Math.max(1, Math.round(totalBeats / beatsPerBar))

  // Layout constants.
  const padX = 28
  const beatW = 64 // px per beat
  const width = padX * 2 + totalBeats * beatW
  const staffY = height * 0.52 // the single rhythm line
  const stemH = 34
  const headRx = 6.4
  const headRy = 5

  const xForBeat = (b: number) => padX + b * beatW

  // Build tokens.
  const tokens: NoteToken[] = events.map((e) => ({
    beat: e.beat,
    beats: e.beats,
    isRest: e.isRest,
    syllable: e.syllable,
  }))

  // Group SOUNDING notes by integer beat (for beaming). Only beam notes that are
  // eighths or smaller AND share the same beat AND there are 2+ of them.
  const beatGroups = new Map<number, NoteToken[]>()
  for (const t of tokens) {
    if (t.isRest) continue
    const c = classify(t.beats)
    if (c.flags === 0) continue
    const key = Math.floor(t.beat + 1e-6)
    if (!beatGroups.has(key)) beatGroups.set(key, [])
    beatGroups.get(key)!.push(t)
  }

  // Decide which tokens are beamed (in a group of 2+).
  const beamedSet = new Set<NoteToken>()
  const beams: { tokens: NoteToken[] }[] = []
  for (const group of beatGroups.values()) {
    if (group.length >= 2) {
      group.forEach((t) => beamedSet.add(t))
      beams.push({ tokens: group })
    }
  }

  // ── SVG pieces ──
  const elems: React.ReactNode[] = []

  // Staff baseline.
  elems.push(
    <line
      key="staffline"
      x1={padX - 10}
      x2={width - padX + 10}
      y1={staffY}
      y2={staffY}
      stroke="rgba(255,255,255,0.16)"
      strokeWidth={1.5}
    />,
  )

  // Bar lines + time signature.
  for (let b = 0; b <= bars; b++) {
    const x = xForBeat(b * beatsPerBar)
    elems.push(
      <line
        key={`bar-${b}`}
        x1={x}
        x2={x}
        y1={staffY - 26}
        y2={staffY + 26}
        stroke={b === 0 || b === bars ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.14)'}
        strokeWidth={b === bars ? 2.5 : 1.4}
      />,
    )
  }

  // Time signature at the front.
  elems.push(
    <text
      key="ts-top"
      x={padX - 19}
      y={staffY - 5}
      fill="rgba(255,255,255,0.7)"
      fontSize={20}
      fontWeight={800}
      textAnchor="middle"
      fontFamily="Georgia, 'Times New Roman', serif"
    >
      {beatsPerBar}
    </text>,
  )
  elems.push(
    <text
      key="ts-bot"
      x={padX - 19}
      y={staffY + 16}
      fill="rgba(255,255,255,0.7)"
      fontSize={20}
      fontWeight={800}
      textAnchor="middle"
      fontFamily="Georgia, 'Times New Roman', serif"
    >
      {pattern.beatUnit}
    </text>,
  )

  // Notes & rests.
  tokens.forEach((t, i) => {
    const x = xForBeat(t.beat)
    if (t.isRest) {
      elems.push(<Rest key={`rest-${i}`} x={x} y={staffY} beats={t.beats} />)
      return
    }
    const c = classify(t.beats)
    const isOpenHead = c.kind === 'whole' || c.kind === 'half' || c.kind === 'dottedHalf'
    const hasStem = c.kind !== 'whole'
    const headTop = staffY
    // notehead
    elems.push(
      <ellipse
        key={`head-${i}`}
        cx={x}
        cy={headTop}
        rx={headRx}
        ry={headRy}
        transform={`rotate(-18 ${x} ${headTop})`}
        fill={isOpenHead ? 'none' : '#f4f4fb'}
        stroke="#f4f4fb"
        strokeWidth={isOpenHead ? 2 : 0}
      />,
    )
    // stem (up, on the right side of the head)
    const stemX = x + headRx - 0.6
    if (hasStem) {
      elems.push(
        <line
          key={`stem-${i}`}
          x1={stemX}
          x2={stemX}
          y1={headTop - 1}
          y2={headTop - stemH}
          stroke="#f4f4fb"
          strokeWidth={1.8}
        />,
      )
    }
    // dot
    if (c.dotted) {
      elems.push(
        <circle key={`dot-${i}`} cx={x + headRx + 7} cy={headTop - 1} r={2.2} fill="#f4f4fb" />,
      )
    }
    // flag — only if NOT beamed and has flags
    if (c.flags > 0 && !beamedSet.has(t)) {
      for (let f = 0; f < c.flags; f++) {
        const fy = headTop - stemH + f * 8
        elems.push(
          <path
            key={`flag-${i}-${f}`}
            d={`M ${stemX} ${fy} q 12 4 11 16 q -2 -9 -11 -11 z`}
            fill="#f4f4fb"
          />,
        )
      }
    }
  })

  // Beams over grouped notes.
  beams.forEach((beam, bi) => {
    const ts = beam.tokens
    const xs = ts.map((t) => xForBeat(t.beat) + headRx - 0.6)
    const x1 = xs[0]
    const x2 = xs[xs.length - 1]
    const beamY = staffY - stemH
    const beamTh = 5
    // primary beam (all eighth-or-smaller share it)
    elems.push(
      <rect
        key={`beam-${bi}`}
        x={x1 - 0.9}
        y={beamY}
        width={x2 - x1 + 1.8}
        height={beamTh}
        fill="#f4f4fb"
        rx={1}
      />,
    )
    // secondary beams for sixteenths: draw a short stub under each sixteenth pair span
    // For simplicity, if a token is a sixteenth, draw a second beam segment between
    // it and its right neighbor (or left if last).
    ts.forEach((t, idx) => {
      const c = classify(t.beats)
      if (c.flags >= 2) {
        const xa = xForBeat(t.beat) + headRx - 0.6
        // span to next token in group if it's also a sixteenth, else a short left stub
        const next = ts[idx + 1]
        const prev = ts[idx - 1]
        let sx1 = xa
        let sx2 = xa + 9
        if (next) {
          sx2 = xForBeat(next.beat) + headRx - 0.6
        } else if (prev) {
          sx1 = xa - 9
          sx2 = xa
        }
        elems.push(
          <rect
            key={`beam2-${bi}-${idx}`}
            x={sx1 - 0.9}
            y={beamY + beamTh + 2.5}
            width={sx2 - sx1 + 1.8}
            height={beamTh}
            fill="#f4f4fb"
            rx={1}
          />,
        )
      }
    })
  })

  // Syllables.
  if (showSyllables) {
    tokens.forEach((t, i) => {
      if (t.isRest) return
      const x = xForBeat(t.beat)
      elems.push(
        <text
          key={`syl-${i}`}
          x={x}
          y={staffY + 48}
          fill={accent}
          fontSize={13}
          fontWeight={700}
          textAnchor="middle"
          fontFamily="var(--font, system-ui)"
        >
          {t.syllable}
        </text>,
      )
    })
  }

  // Playhead.
  if (playhead != null && playhead >= 0 && playhead <= 1) {
    const x = padX + playhead * totalBeats * beatW
    elems.push(
      <line
        key="playhead"
        x1={x}
        x2={x}
        y1={staffY - 44}
        y2={staffY + 56}
        stroke={accent}
        strokeWidth={2}
        opacity={0.85}
      />,
    )
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Rhythm notation"
      style={{ maxWidth: width, display: 'block', margin: '0 auto' }}
    >
      {elems}
    </svg>
  )
}

// ── Rest glyphs ──────────────────────────────────────────────────────────────
function Rest({ x, y, beats }: { x: number; y: number; beats: number }) {
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.02
  const fill = '#cfcfe0'
  if (eq(beats, 4)) {
    // whole rest: hanging block from a line above
    return <rect x={x - 7} y={y - 12} width={14} height={6} fill={fill} />
  }
  if (eq(beats, 2)) {
    // half rest: sitting block on a line
    return <rect x={x - 7} y={y - 6} width={14} height={6} fill={fill} />
  }
  if (eq(beats, 1)) {
    // quarter rest — squiggle approximation
    return (
      <path
        d={`M ${x - 4} ${y - 16}
            q 9 6 1 12 q -8 5 4 11
            q -10 -3 -3 -12 q 7 -5 -2 -11 z`}
        fill={fill}
        transform={`translate(0,0)`}
      />
    )
  }
  // eighth rest (and shorter) — a slash with a flag dot
  return (
    <g>
      <circle cx={x - 2} cy={y - 12} r={3} fill={fill} />
      <line x1={x + 0.5} y1={y - 13} x2={x - 4} y2={y + 2} stroke={fill} strokeWidth={2.2} />
    </g>
  )
}
