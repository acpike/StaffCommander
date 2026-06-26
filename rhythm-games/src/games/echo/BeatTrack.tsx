// Horizontal rhythm strip laid out like notation: a TIME SIGNATURE, then equal-
// width MEASURES separated by BARLINES, with a BEAT-NUMBER row (1 2 3 4 ...) along
// the top as a steady pulse reference, and each onset shown as a pip INSIDE its
// measure (never on a barline). Pips light up during the CALL and color by
// judgement during the RESPONSE. A playhead sweeps across in time.
//
// Beat numbers use the FELT beats: 4/4 -> 1 2 3 4; 3/4 -> 1 2 3; 6/8 -> 1 2 (the
// two dotted-quarter felt beats). `showGrid` adds dashed dividers at each felt beat.

import { useMemo } from 'react'
import { feltBeats, onsets, patternBeats, type Pattern } from '../../shared/audio/patterns'
import type { Rating } from '../../shared/audio/engine'

export type PipState = 'idle' | 'call' | Rating

interface Props {
  pattern: Pattern
  /** Per-onset visual state, indexed by onset index. */
  states: PipState[]
  /** Playhead position 0..1 across the pattern, or null to hide. */
  progress: number | null
  /** Show pips at all (scaffold; fades after a clean round on some levels). */
  showPips?: boolean
  /** Draw dashed dividers at each felt beat within a bar. */
  showGrid?: boolean
  /** Accepted for compatibility; syllables are intentionally NOT rendered. */
  showSyllables?: boolean
}

// Map a within-measure position (0..1) to an x inside the measure cell: a fixed
// left gap so the downbeat clears the barline, and a compressed range so late
// notes never reach the next barline.
const noteX = (posInBar: number) => `calc(${posInBar * 84}% + 14px)`
const gridX = (posInBar: number) => `calc(${posInBar * 84}% + 6px)`

export function BeatTrack({ pattern, states, progress, showPips = true, showGrid = false }: Props) {
  const bpb = pattern.beatsPerBar
  const total = useMemo(() => patternBeats(pattern) || 1, [pattern])
  const bars = useMemo(() => Math.max(1, Math.round(total / bpb)), [total, bpb])
  // Felt-beat positions within a bar (incl. beat 1 at 0). Numbers use all; the
  // dashed grid skips beat 1 (that edge is the barline).
  const beatPositions = useMemo(() => feltBeats(bpb, pattern.beatUnit), [bpb, pattern.beatUnit])
  const feltDivs = useMemo(() => beatPositions.filter((fb) => fb > 0), [beatPositions])

  // Bucket onsets into measures, each with its within-measure position (0..1).
  const measures = useMemo(() => {
    const ms: { index: number; posInBar: number }[][] = Array.from({ length: bars }, () => [])
    for (const o of onsets(pattern)) {
      const bar = Math.min(bars - 1, Math.floor(o.beat / bpb))
      ms[bar].push({ index: o.index, posInBar: (o.beat - bar * bpb) / bpb })
    }
    return ms
  }, [pattern, bars, bpb])

  return (
    <div className="echo-track" aria-hidden>
      <div className="echo-track__timesig">
        <span>{bpb}</span>
        <span>{pattern.beatUnit}</span>
      </div>
      <div className="echo-track__measures">
        {measures.map((onsetsInBar, bar) => (
          <div className={`echo-track__measure${bar > 0 ? ' has-barline' : ''}`} key={bar}>
            {beatPositions.map((fb, i) => (
              <span key={`n${fb}`} className="echo-track__beatnum" style={{ left: noteX(fb / bpb) }}>
                {i + 1}
              </span>
            ))}
            {showGrid &&
              feltDivs.map((fb) => (
                <div key={fb} className="echo-track__grid" style={{ left: gridX(fb / bpb) }} />
              ))}
            {showPips &&
              onsetsInBar.map((p) => (
                <div key={p.index} className="echo-pip-wrap" style={{ left: noteX(p.posInBar) }}>
                  <div
                    className="echo-pip"
                    data-state={states[p.index] && states[p.index] !== 'idle' ? states[p.index] : undefined}
                  />
                </div>
              ))}
          </div>
        ))}
        <div
          className={`echo-track__playhead ${progress !== null ? 'is-on' : ''}`}
          style={progress !== null ? { left: `${Math.max(0, Math.min(1, progress)) * 100}%` } : undefined}
        />
      </div>
    </div>
  )
}
