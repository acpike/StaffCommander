// useEchoRound — the heart of Echo's call-and-response loop, framework-agnostic
// orchestration over the shared RhythmEngine.
//
// A "round" has two phases driven by the engine:
//   1) CALL  — the game plays the rhythm so the player hears it (engine.preview,
//              audible + metronome, NO judging).
//   2) RESPONSE — the player taps it back. We schedule SILENT target onsets plus
//              a steady metronome (engine.playPattern with playPattern:false,
//              metronomeThroughout:true) so taps are judged against the remembered
//              rhythm while a click keeps time.
//
// The hook exposes phase, live judging tallies, and per-round resolution. It
// reads engine.songTime() / collectMisses() in a rAF loop (never React state),
// surfacing only discrete events (a tap landed, a note was missed, phase changed)
// up to React.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RhythmEngine, Rating } from '../../shared/audio/engine'
import { onsetCount, type Pattern } from '../../shared/audio/patterns'

export type RoundPhase = 'idle' | 'call' | 'gap' | 'response' | 'scored'

export interface RoundTally {
  perfect: number
  great: number
  good: number
  miss: number
  /** Onsets that should be tapped this round. */
  total: number
  /** Onsets judged so far (hits + misses). */
  judged: number
}

export interface RoundResult {
  tally: RoundTally
  /** 0..1 onset accuracy (perfect=1, great=.85, good=.6, miss=0 weighted). */
  accuracy: number
  /** True if the player got at least "good" on every onset (no misses). */
  clean: boolean
  /** Hits (any non-miss). */
  hits: number
}

interface RoundCallbacks {
  /**
   * BPM in the PATTERN's beat-unit space (what the engine schedules against).
   * For simple meters this is the quarter-note BPM; for COMPOUND meters the
   * cells are in eighth-units, so this is the eighth-note BPM (= felt
   * dotted-quarter BPM × 3). The caller does that conversion.
   */
  bpm: number
  beatsPerBar: number
  /**
   * FELT-beat click stride for the metronome / count-in (passed to the engine):
   * 1 for simple, 3 for compound (click the dotted-quarter pulse, not eighths).
   */
  feltStride?: number
  /** Pitched melody for the CALL (Simon mode). Undefined = claps. */
  pitches?: number[]
  /** Called per judged tap (live feedback). */
  onTap?: (rating: Rating, error_ms: number, noteIndex: number) => void
  /** Called per dropped/missed onset (live feedback). */
  onMiss?: (noteIndex: number) => void
  /** Called when the round is fully scored. */
  onScored?: (result: RoundResult) => void
  /** Phase transitions (for UI cueing). */
  onPhase?: (phase: RoundPhase) => void
}

const emptyTally = (total: number): RoundTally => ({
  perfect: 0,
  great: 0,
  good: 0,
  miss: 0,
  total,
  judged: 0,
})

function scoreTally(t: RoundTally): RoundResult {
  const weighted = t.perfect * 1 + t.great * 0.85 + t.good * 0.6
  const accuracy = t.total > 0 ? Math.min(1, weighted / t.total) : 0
  const hits = t.perfect + t.great + t.good
  return { tally: t, accuracy, clean: t.miss === 0 && t.judged >= t.total, hits }
}

export function useEchoRound(engine: RhythmEngine) {
  const [phase, setPhase] = useState<RoundPhase>('idle')
  const [tally, setTally] = useState<RoundTally>(emptyTally(0))

  // Mutable refs (per-frame work never re-renders).
  const tallyRef = useRef<RoundTally>(emptyTally(0))
  const cbRef = useRef<RoundCallbacks | null>(null)
  const rafRef = useRef<number | null>(null)
  const phaseRef = useRef<RoundPhase>('idle')
  const timersRef = useRef<number[]>([])
  const respondingRef = useRef(false)

  const setPhaseBoth = useCallback((p: RoundPhase) => {
    phaseRef.current = p
    setPhase(p)
    cbRef.current?.onPhase?.(p)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []
  }, [])

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const finishRound = useCallback(() => {
    respondingRef.current = false
    stopRaf()
    engine.stop()
    const result = scoreTally({ ...tallyRef.current })
    setTally({ ...tallyRef.current })
    setPhaseBoth('scored')
    cbRef.current?.onScored?.(result)
  }, [engine, setPhaseBoth, stopRaf])

  // rAF loop active during the RESPONSE phase: harvest misses, detect end.
  const loop = useCallback(() => {
    if (!respondingRef.current) return
    const missed = engine.collectMisses()
    if (missed.length) {
      const t = tallyRef.current
      for (const m of missed) {
        t.miss++
        t.judged++
        cbRef.current?.onMiss?.(m.index)
      }
      setTally({ ...t })
    }
    if (tallyRef.current.judged >= tallyRef.current.total) {
      finishRound()
      return
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [engine, finishRound])

  // Engine tap subscription: only count taps during RESPONSE.
  useEffect(() => {
    const off = engine.onTap(({ rating, error_ms, noteIndex }) => {
      if (!respondingRef.current) return
      if (noteIndex < 0) return // stray ghost tap — don't penalize against onsets
      const t = tallyRef.current
      t[rating]++
      t.judged++
      setTally({ ...t })
      cbRef.current?.onTap?.(rating, error_ms, noteIndex)
    })
    return off
  }, [engine])

  /**
   * Play one call-and-response round on `pattern`. Resolves the round through the
   * provided callbacks; the response phase auto-ends when every onset is judged.
   */
  const startRound = useCallback(
    (pattern: Pattern, cb: RoundCallbacks) => {
      clearTimers()
      stopRaf()
      respondingRef.current = false
      cbRef.current = cb
      const total = onsetCount(pattern)
      tallyRef.current = emptyTally(total)
      setTally(emptyTally(total))

      // ── Phase 1: CALL (audible, no judging) ──
      setPhaseBoth('call')
      const call = engine.preview(pattern, {
        bpm: cb.bpm,
        beatsPerBar: cb.beatsPerBar,
        countInBars: 1,
        metronomeThroughout: true,
        feltStride: cb.feltStride,
        pitches: cb.pitches,
      })
      // call.duration is the pattern body; the count-in adds one bar.
      const countInSec = (cb.beatsPerBar * 60) / cb.bpm
      const callTotalMs = (countInSec + call.duration) * 1000

      // ── brief GAP so the player can breathe before responding ──
      const gapMs = 450
      timersRef.current.push(
        window.setTimeout(() => {
          setPhaseBoth('gap')
        }, callTotalMs),
      )

      // ── Phase 2: RESPONSE (silent targets + metronome, judged) ──
      timersRef.current.push(
        window.setTimeout(() => {
          respondingRef.current = true
          setPhaseBoth('response')
          engine.playPattern(pattern, {
            bpm: cb.bpm,
            beatsPerBar: cb.beatsPerBar,
            countInBars: 1,
            playPattern: false, // silent targets — the PLAYER provides the sound
            metronomeThroughout: true,
            feltStride: cb.feltStride,
            onComplete: () => {
              // Safety net: if rAF somehow hasn't ended it, finish here.
              if (respondingRef.current) {
                // give one extra frame for late misses then finish
                window.setTimeout(() => {
                  if (respondingRef.current) finishRound()
                }, 120)
              }
            },
          })
          rafRef.current = requestAnimationFrame(loop)
        }, callTotalMs + gapMs),
      )
    },
    [clearTimers, engine, finishRound, loop, setPhaseBoth, stopRaf],
  )

  const abort = useCallback(() => {
    clearTimers()
    stopRaf()
    respondingRef.current = false
    engine.stop()
    setPhaseBoth('idle')
  }, [clearTimers, engine, setPhaseBoth, stopRaf])

  useEffect(() => {
    return () => {
      clearTimers()
      stopRaf()
    }
  }, [clearTimers, stopRaf])

  return { phase, tally, startRound, abort }
}
