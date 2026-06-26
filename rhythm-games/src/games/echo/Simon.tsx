// Rhythm Simon — the memory ladder. The pattern GROWS by one beat-cell each
// round; the CALL replays the whole grown sequence (pitched hits, Simon-style),
// then the player taps the full sequence back. One full break (a missed onset or
// a weak round) ends the run; score = sequence length reached.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore, activeProfile, type RunOutcome } from '../../shared/store'
import { useRhythmEngine } from '../../shared/audio/useRhythmEngine'
import { tightenWindows, type Rating } from '../../shared/audio/engine'
import {
  pattern as makePattern,
  onsetCount,
  patternBeats,
  CELLS,
  type BeatCell,
  type Pattern,
} from '../../shared/audio/patterns'
import { Button, Hud, RatingPopup } from '../../shared/ui'
import { Stage } from './Stage'
import { TapPad } from './TapPad'
import { BeatTrack, type PipState } from './BeatTrack'
import { Results, type ResultsData } from './Results'
import { useEchoRound, type RoundResult } from './useEchoRound'
import { SIMON_SCALE } from './levels'

interface Props {
  onExit: () => void
}

type Screen = 'intro' | 'play' | 'results'

const SIMON_BPM = 92
const SIMON_DIFFICULTY = 0.35

// Cells the ladder draws from — single-beat, musical, easy to remember at first.
const SIMON_CELLS: BeatCell[] = [
  CELLS.quarter,
  CELLS.quarter,
  CELLS.twoEighths,
  CELLS.half,
  CELLS.quarter,
  CELLS.twoEighths,
]

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// Onset beat positions (for opponent clap timing during the CALL).
function onsetBeats(p: Pattern): number[] {
  const out: number[] = []
  let cursor = 0
  for (const c of p.cells) {
    for (const note of c.notes) {
      if (!note.isRest) out.push(cursor + note.beat)
    }
    cursor += c.beats
  }
  return out
}

// Pitches for the whole pattern's onsets — a wandering pentatonic melody so the
// growing sequence sounds musical, stable across regrowth (seeded by length).
function melodyFor(count: number, seed: number): number[] {
  const rng = makeRng(seed)
  const out: number[] = []
  let idx = 2
  for (let i = 0; i < count; i++) {
    out.push(SIMON_SCALE[Math.max(0, Math.min(SIMON_SCALE.length - 1, idx))])
    // step up/down the scale gently
    idx += Math.floor(rng() * 3) - 1
    if (idx < 0) idx = 1
    if (idx >= SIMON_SCALE.length) idx = SIMON_SCALE.length - 2
  }
  return out
}

export function Simon({ onExit }: Props) {
  const engine = useRhythmEngine()
  const profile = useStore(activeProfile)
  const recordRun = useStore((s) => s.recordRun)

  const [screen, setScreen] = useState<Screen>('intro')
  const [length, setLength] = useState(1) // cells in the sequence
  const [pattern, setPattern] = useState<Pattern>(() => makePattern([SIMON_CELLS[0]]))
  const [pipStates, setPipStates] = useState<PipState[]>([])
  const [countNum, setCountNum] = useState<number | null>(null)
  const [oppClap, setOppClap] = useState(0)
  const [youClap, setYouClap] = useState(0)
  const [results, setResults] = useState<ResultsData | null>(null)

  const [rating, setRating] = useState<Rating | null>(null)
  const [ratingErr, setRatingErr] = useState(0)
  const [ratingTick, setRatingTick] = useState(0)

  const cellsRef = useRef<BeatCell[]>([])
  const seedRef = useRef(Math.floor(Math.random() * 1e9))
  const lengthRef = useRef(1)
  const aggRef = useRef({ notes: 0, weighted: 0, bestStreak: 0 })
  const streakRef = useRef(0)
  const [streak, setStreak] = useState(0)

  const { phase, startRound, abort } = useEchoRound(engine)
  const callTimers = useRef<number[]>([])

  const clearCallTimers = useCallback(() => {
    callTimers.current.forEach((id) => window.clearTimeout(id))
    callTimers.current = []
  }, [])

  const scheduleCountIn = useCallback(() => {
    const cs = (4 * 60) / SIMON_BPM
    for (let b = 0; b < 4; b++) {
      callTimers.current.push(window.setTimeout(() => setCountNum(b + 1), b * (cs / 4) * 1000))
    }
    callTimers.current.push(window.setTimeout(() => setCountNum(null), cs * 1000))
  }, [])

  const endRun = useCallback(() => {
    const reached = lengthRef.current
    const agg = aggRef.current
    const accuracy = agg.notes > 0 ? Math.min(1, agg.weighted / agg.notes) : 0
    // Score scales with sequence length reached (the headline metric) + accuracy.
    const score = Math.round(reached * 250 + accuracy * 500)
    const outcome: RunOutcome = recordRun('echo', {
      levelId: 'simon',
      score,
      accuracy,
      notes: agg.notes,
      mastered: false,
      unlockNext: null,
      bestStreak: agg.bestStreak,
      stageReached: reached,
      wrong: 0,
    })
    setResults({
      title: 'Run Over',
      subtitle: `You echoed a ${reached}-cell sequence!`,
      crown: reached >= 8 ? '👑' : reached >= 5 ? '🥁' : '🎵',
      score,
      accuracy,
      outcome,
      win: reached >= 3,
    })
    setScreen('results')
  }, [recordRun])

  const resolveRound = useCallback(
    (res: RoundResult) => {
      const agg = aggRef.current
      agg.notes += res.tally.total
      agg.weighted += res.tally.perfect * 1 + res.tally.great * 0.85 + res.tally.good * 0.6
      agg.bestStreak = Math.max(agg.bestStreak, streakRef.current)

      // One full break ends the run: any miss this round fails it.
      const failed = res.tally.miss > 0
      window.setTimeout(() => {
        if (failed) {
          endRun()
        } else {
          // grow the sequence by one cell
          lengthRef.current += 1
          setLength(lengthRef.current)
          window.setTimeout(() => beginRound(), 500)
        }
      }, 1000)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endRun],
  )

  const beginRound = useCallback(() => {
    // grow the cell list to the current length (stable prefix)
    const rng = makeRng(seedRef.current)
    const cells: BeatCell[] = []
    for (let i = 0; i < lengthRef.current; i++) {
      cells.push(SIMON_CELLS[Math.floor(rng() * SIMON_CELLS.length)])
    }
    cellsRef.current = cells
    const p = makePattern(cells)
    setPattern(p)
    const n = onsetCount(p)
    setPipStates(new Array(n).fill('idle'))
    setCountNum(null)

    const pitches = melodyFor(n, seedRef.current)

    clearCallTimers()
    const countInSec = (4 * 60) / SIMON_BPM
    const totalBeats = patternBeats(p)
    const beatSec = 60 / SIMON_BPM

    scheduleCountIn()

    // opponent claps + pip lights aligned to CALL onsets
    onsetBeats(p).forEach((beat, i) => {
      const tMs = (countInSec + beat * beatSec) * 1000
      callTimers.current.push(
        window.setTimeout(() => {
          setOppClap((x) => x + 1)
          setPipStates((prev) => {
            const next = [...prev]
            next[i] = 'call'
            return next
          })
        }, tMs),
      )
    })
    callTimers.current.push(
      window.setTimeout(
        () => setPipStates(new Array(n).fill('idle')),
        (countInSec + totalBeats * beatSec) * 1000 + 250,
      ),
    )

    startRound(p, {
      bpm: SIMON_BPM,
      beatsPerBar: 4,
      pitches,
      onTap: (r, err, noteIndex) => {
        setRating(r)
        setRatingErr(err)
        setRatingTick((t) => t + 1)
        setYouClap((x) => x + 1)
        setPipStates((prev) => {
          const next = [...prev]
          if (noteIndex >= 0) next[noteIndex] = r
          return next
        })
        if (r === 'miss') {
          streakRef.current = 0
          setStreak(0)
        } else {
          streakRef.current += 1
          setStreak(streakRef.current)
        }
      },
      onMiss: (noteIndex) => {
        streakRef.current = 0
        setStreak(0)
        setRating('miss')
        setRatingErr(0)
        setRatingTick((t) => t + 1)
        setPipStates((prev) => {
          const next = [...prev]
          if (noteIndex >= 0) next[noteIndex] = 'miss'
          return next
        })
      },
      onPhase: (ph) => {
        if (ph === 'response') {
          setCountNum(null)
          scheduleCountIn()
        }
      },
      onScored: (res) => {
        setCountNum(null)
        resolveRound(res)
      },
    })
  }, [clearCallTimers, scheduleCountIn, startRound, resolveRound])

  const start = useCallback(async () => {
    await engine.resume()
    engine.setWindows(tightenWindows(SIMON_DIFFICULTY))
    seedRef.current = Math.floor(Math.random() * 1e9)
    lengthRef.current = 1
    streakRef.current = 0
    aggRef.current = { notes: 0, weighted: 0, bestStreak: 0 }
    setLength(1)
    setStreak(0)
    setScreen('play')
    window.setTimeout(() => beginRound(), 250)
  }, [engine, beginRound])

  useEffect(() => {
    return () => {
      clearCallTimers()
      abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const replay = useCallback(() => {
    abort()
    clearCallTimers()
    setResults(null)
    void start()
  }, [abort, clearCallTimers, start])

  const onPadTap = useCallback((): string | null => engine.judgeTap().rating, [engine])

  const opponent = { name: 'Simon', emoji: '🤖' }
  const turn = phase === 'call' ? 'opponent' : phase === 'response' ? 'you' : 'none'
  const banner =
    phase === 'call'
      ? '🤖 Simon plays the sequence...'
      : phase === 'gap'
        ? 'Remember it...'
        : phase === 'response'
          ? '🎤 Echo the whole sequence!'
          : ''
  const bannerKind = phase === 'call' ? 'call' : phase === 'response' ? 'response' : 'gap'
  const padBig =
    phase === 'call' ? 'Listen' : phase === 'gap' ? 'Recall...' : phase === 'response' ? 'TAP!' : '...'
  const padHint =
    phase === 'response' ? 'Tap the full sequence back' : phase === 'call' ? 'Memorize the melody' : ''

  if (screen === 'results' && results) {
    return <Results data={results} onReplay={replay} onMenu={onExit} />
  }

  return (
    <>
      {screen === 'intro' && (
        <div className="echo-startover">
          <div className="echo-startover__inner">
            <div style={{ fontSize: 60 }}>🤖</div>
            <h2>Rhythm Simon</h2>
            <p>
              Simon plays a melody-rhythm and it grows by one note every round. Echo the{' '}
              <strong>whole</strong> sequence back. One slip ends the run — how long can you
              remember?
            </p>
            <Button variant="primary" accent="var(--echo)" size="lg" onClick={() => void start()}>
              Start Run
            </Button>
          </div>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        {banner && (
          <div className="echo-banner" data-kind={bannerKind} key={phase}>
            {banner}
          </div>
        )}
        <Stage opponent={opponent} turn={turn} oppClapTick={oppClap} youClapTick={youClap} />
      </div>

      <div className="echo-simon-len">
        <span className="echo-simon-len__n">{length}</span>{' '}
        <span className="echo-simon-len__label">{length === 1 ? 'cell' : 'cells'} in sequence</span>
      </div>

      <BeatTrack pattern={pattern} states={pipStates} progress={null} />

      <div className="echo-padwrap">
        <div className="echo-rating-mount">
          <RatingPopup rating={rating} error_ms={ratingErr} tick={ratingTick} />
        </div>
        <TapPad
          armed={phase === 'response'}
          disabled={phase !== 'response'}
          bigLabel={padBig}
          hint={padHint}
          count={countNum}
          onTap={onPadTap}
        />
      </div>

      <Hud
        name={profile?.name}
        xp={profile?.xp ?? 0}
        gems={profile?.gems ?? 0}
        score={length * 250}
        streak={streak}
        accent="var(--echo)"
        compact
      />
    </>
  )
}
