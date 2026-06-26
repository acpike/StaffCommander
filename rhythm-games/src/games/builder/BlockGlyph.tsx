// A small SVG rhythm glyph drawn inside a palette / grid BLOCK so the player can
// SEE the shape of the beat-cell (noteheads + beams + rests) at a glance, not
// just read its syllables. Compact, single-line, beat-relative layout.

import type { BeatCell } from '../../shared/audio/patterns'

interface Props {
  cell: BeatCell
  /** Pixel width available for the glyph. Height fixed. */
  width?: number
  color?: string
}

export function BlockGlyph({ cell, width = 96, color = '#0a0a12' }: Props) {
  const h = 34
  const padX = 8
  const innerW = width - padX * 2
  const beats = cell.beats
  const xFor = (b: number) => padX + (b / beats) * innerW
  const baseY = h * 0.56
  const stemH = 15
  const headRx = 4.2
  const headRy = 3.3

  const els: React.ReactNode[] = []
  // baseline
  els.push(<line key="bl" x1={padX} x2={width - padX} y1={baseY} y2={baseY} stroke="rgba(0,0,0,0.18)" strokeWidth={1} />)

  const eq = (a: number, b: number) => Math.abs(a - b) < 0.02

  // group beamable notes (eighth or smaller, non-rest)
  const beamNotes = cell.notes.filter((n) => !n.isRest && n.beats <= 0.5 + 1e-6)
  const beamable = beamNotes.length >= 2

  cell.notes.forEach((note, i) => {
    const x = xFor(note.beat)
    if (note.isRest) {
      els.push(<RestGlyph key={`r${i}`} x={x} y={baseY} beats={note.beats} color={color} />)
      return
    }
    const isOpen = note.beats >= 2 - 1e-6
    const hasStem = !eq(note.beats, 4)
    els.push(
      <ellipse
        key={`h${i}`}
        cx={x}
        cy={baseY}
        rx={headRx}
        ry={headRy}
        transform={`rotate(-18 ${x} ${baseY})`}
        fill={isOpen ? 'none' : color}
        stroke={color}
        strokeWidth={isOpen ? 1.4 : 0}
      />,
    )
    const stemX = x + headRx - 0.4
    if (hasStem) {
      els.push(<line key={`s${i}`} x1={stemX} x2={stemX} y1={baseY - 1} y2={baseY - stemH} stroke={color} strokeWidth={1.3} />)
    }
    if (note.beats === 0.75 || note.beats === 1.5 || note.beats === 3) {
      els.push(<circle key={`d${i}`} cx={x + headRx + 4} cy={baseY - 1} r={1.5} fill={color} />)
    }
    // single flag if eighth-ish and not beamed
    if (note.beats <= 0.5 + 1e-6 && !beamable) {
      els.push(<path key={`f${i}`} d={`M ${stemX} ${baseY - stemH} q 7 2 6 9 q -1 -5 -6 -6 z`} fill={color} />)
    }
  })

  if (beamable) {
    const xs = beamNotes.map((n) => xFor(n.beat) + headRx - 0.4)
    const x1 = Math.min(...xs)
    const x2 = Math.max(...xs)
    const by = baseY - stemH
    els.push(<rect key="beam" x={x1 - 0.6} y={by} width={x2 - x1 + 1.2} height={3} fill={color} rx={0.8} />)
    // secondary beam stubs for sixteenths
    beamNotes.forEach((n, idx) => {
      if (eq(n.beats, 0.25)) {
        const xa = xFor(n.beat) + headRx - 0.4
        const next = beamNotes[idx + 1]
        const prev = beamNotes[idx - 1]
        let sx1 = xa
        let sx2 = xa + 6
        if (next && eq(next.beats, 0.25) && next.beat - n.beat <= 0.25 + 1e-6) sx2 = xFor(next.beat) + headRx - 0.4
        else if (prev) {
          sx1 = xa - 6
          sx2 = xa
        }
        els.push(<rect key={`b2${idx}`} x={sx1 - 0.6} y={by + 4.5} width={sx2 - sx1 + 1.2} height={2.6} fill={color} rx={0.8} />)
      }
    })
  }

  return (
    <svg viewBox={`0 0 ${width} ${h}`} width={width} height={h} aria-hidden style={{ display: 'block' }}>
      {els}
    </svg>
  )
}

function RestGlyph({ x, y, beats, color }: { x: number; y: number; beats: number; color: string }) {
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.02
  if (eq(beats, 4)) return <rect x={x - 4} y={y - 8} width={8} height={3.4} fill={color} />
  if (eq(beats, 2)) return <rect x={x - 4} y={y - 4} width={8} height={3.4} fill={color} />
  if (eq(beats, 1))
    return (
      <path
        d={`M ${x - 2.4} ${y - 9} q 5 3.5 0.6 7 q -4.6 3 2.4 6.4 q -6 -2 -1.8 -7 q 4 -3 -1.2 -6.4 z`}
        fill={color}
      />
    )
  return (
    <g>
      <circle cx={x - 1.2} cy={y - 7} r={1.8} fill={color} />
      <line x1={x + 0.4} y1={y - 8} x2={x - 2.4} y2={y + 1.5} stroke={color} strokeWidth={1.4} />
    </g>
  )
}
