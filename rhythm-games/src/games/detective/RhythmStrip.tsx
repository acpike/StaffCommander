// A compact "evidence strip" visualization of a rhythm pattern — onset blips on
// a beat-gridded timeline. Purely decorative/illustrative; the real test is the
// AUDIO. Used on suspect cards, the spot-the-difference timeline, and the alarm
// queue so the player has something to look at while listening.

import { flatten, patternBeats, type Pattern } from '../../shared/audio/patterns'

interface Props {
  pattern: Pattern
  accent?: string
  /** Optional play progress 0..1 to draw a sweeping playhead. */
  progress?: number
  /** Visually mute (e.g. a suspect not currently playing). */
  dim?: boolean
  height?: number
}

export function RhythmStrip({ pattern, accent = 'var(--detective)', progress, dim, height = 44 }: Props) {
  const total = Math.max(1, patternBeats(pattern))
  const events = flatten(pattern).filter((e) => !e.isRest)
  const beats = Math.round(total)

  return (
    <div className={`rd-strip ${dim ? 'is-dim' : ''}`} style={{ height }} aria-hidden>
      {/* beat grid */}
      {Array.from({ length: beats + 1 }).map((_, i) => (
        <span key={`g${i}`} className="rd-strip__grid" style={{ left: `${(i / total) * 100}%` }} />
      ))}
      {/* onsets */}
      {events.map((e, i) => {
        const left = (e.beat / total) * 100
        const w = Math.max(2.5, (e.beats / total) * 100 - 1.5)
        return (
          <span
            key={`o${i}`}
            className="rd-strip__onset"
            style={{ left: `${left}%`, width: `${w}%`, background: accent }}
          />
        )
      })}
      {/* playhead */}
      {progress != null && progress >= 0 && progress <= 1 && (
        <span className="rd-strip__head" style={{ left: `${progress * 100}%`, background: accent }} />
      )}
    </div>
  )
}
