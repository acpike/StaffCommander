// Beat Battle — the standard level mode. Several call-and-response rounds at a
// level's tier/bpm, traded with an animated opponent. Lives, streak/combo
// multiplier, then recordRun on finish.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore, activeProfile, START_LIVES, type RunOutcome } from '../../shared/store'
import { MASTERY_ACCURACY, MASTERY_MIN_NOTES, MASTERY_STAGE } from '../../shared/progression'
import { useRhythmEngine } from '../../shared/audio/useRhythmEngine'
import { tightenWindows, tightenHold, type HoldRelease, type Rating } from '../../shared/audio/engine'
import { generatePattern, isCompound, onsetCount, patternBeats, type Pattern } from '../../shared/audio/patterns'
import { Button, Hud, RatingPopup } from '../../shared/ui'
import { Stage } from './Stage'
import { TapPad, type PressResult } from './TapPad'
import { BeatTrack, type PipState } from './BeatTrack'
import { Results, type ResultsData } from './Results'
import { useEchoRound, type RoundResult } from './useEchoRound'
import { cellsForLevel, type EchoLevel } from './levels'

interface Props {
  level: EchoLevel
  onExit: () => void
  /** Go to the next level (already unlocked); undefined if none. */
  onNextLevel?: () => void
}

type Screen = 'intro' | 'battle' | 'results'

// Simple LCG RNG seeded per round.
function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// True if a level's vocabulary contains any HOLD note (a sounding note longer
// than one beat: half / dotted-half / whole / dotted-quarter / compound holds).
// Holds need press-and-release judging; tap-only levels keep the simpler path.
function levelUsesHolds(cells: { notes: { beats: number; isRest: boolean }[] }[]): boolean {
  return cells.some((c) => c.notes.some((nt) => !nt.isRest && nt.beats > 1))
}

// Onset beat positions for timing the opponent's "clap" flashes.
function onsetBeats(p: Pattern): { index: number; beat: number }[] {
  const out: { index: number; beat: number }[] = []
  let cursor = 0
  let oi = 0
  for (const c of p.cells) {
    for (const note of c.notes) {
      if (!note.isRest) {
        out.push({ index: oi, beat: cursor + note.beat })
        oi++
      }
    }
    cursor += c.beats
  }
  return out
}

export function Battle({ level, onExit, onNextLevel }: Props) {
  const engine = useRhythmEngine()
  const profile = useStore(activeProfile)
  const recordRun = useStore((s) => s.recordRun)
  // "Show beat lines" setting: 'auto' follows the level default; 'on'/'off' override.
  const beatLines = useStore((s) => s.settings.beatLines)

  const [screen, setScreen] = useState<Screen>('intro')
  const [roundIdx, setRoundIdx] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [comboBump, setComboBump] = useState(0)
  const [results, setResults] = useState<ResultsData | null>(null)

  const [pipStates, setPipStates] = useState<PipState[]>([])
  // Scaffold-fade: once the player completes one clean (no-miss) round on a level
  // whose scaffold has `pipsFadeAfterClean`, the pips hide for the rest of the
  // level (ECHO-LEVEL-SYSTEM.md §2). Reset on (re)start of a level.
  const [pipsFaded, setPipsFaded] = useState(false)
  const [countNum, setCountNum] = useState<number | null>(null)
  const [oppClap, setOppClap] = useState(0)
  const [youClap, setYouClap] = useState(0)

  const [rating, setRating] = useState<Rating | null>(null)
  const [ratingErr, setRatingErr] = useState(0)
  const [ratingTick, setRatingTick] = useState(0)

  // Gentle hold-release cue: 'short' = "hold longer", 'long' = "hold shorter".
  // Never a harsh miss (ECHO-LEVEL-SYSTEM.md §5). Cleared on a clean release.
  const [holdCue, setHoldCue] = useState<HoldRelease | null>(null)
  const [holdCueTick, setHoldCueTick] = useState(0)
  const holdCueTimer = useRef<number | null>(null)

  // Run aggregates (across all rounds, for recordRun) + live mutable counters.
  const aggRef = useRef({ notes: 0, hits: 0, weighted: 0, wrong: 0, bestStreak: 0 })
  const bestStreakRef = useRef(0)
  const streakRef = useRef(0)
  const livesRef = useRef(START_LIVES)
  const scoreRef = useRef(0)

  const { phase, startRound, abort } = useEchoRound(engine)

  // Meter context for this level — drives generation, count-in and pulse. The
  // count-in pulses on the FELT beats of one bar (4 in 4/4, 2 in 6/8, …).
  const beatsPerBar = level.timeSig.beats
  const beatUnit = level.timeSig.unit
  // Felt beats per bar: 4 in 4/4, 2 in 6/8, 3 in 9/8, 4 in 12/8. Drives the
  // count-in NUMBER display (so 6/8 counts "1-2", not "1-2-3-4-5-6").
  const countBeats = level.feltBeats.length || beatsPerBar
  // COMPOUND meter (6/8, 9/8, 12/8): cells are authored in EIGHTH units and one
  // FELT beat (a dotted quarter) spans 3 of them. So the engine clicks every 3rd
  // unit (feltStride=3) and we feed it the EIGHTH-note BPM (level.bpm is the
  // felt dotted-quarter BPM → ×3). Simple meters: stride 1, bpm unchanged.
  const compound = isCompound(beatsPerBar, beatUnit)
  const feltStride = compound ? 3 : 1
  // BPM in the pattern's beat-unit space (what the engine schedules against).
  const unitBpm = compound ? level.bpm * feltStride : level.bpm
  // Does this level's vocabulary include hold notes? Drives press/release vs tap.
  const usesHolds = useMemo(() => levelUsesHolds(cellsForLevel(level)), [level])

  const [pattern, setPattern] = useState<Pattern>(() =>
    generatePattern(cellsForLevel(level), { bars: level.bars, beatsPerBar, beatUnit }),
  )

  const callTimers = useRef<number[]>([])

  useEffect(() => {
    engine.setWindows(tightenWindows(level.difficulty))
    engine.setHoldWindows(tightenHold(level.difficulty))
  }, [engine, level.difficulty])

  const clearCallTimers = useCallback(() => {
    callTimers.current.forEach((id) => window.clearTimeout(id))
    callTimers.current = []
  }, [])

  const scheduleCountIn = useCallback(() => {
    const cs = (countBeats * 60) / level.bpm
    for (let b = 0; b < countBeats; b++) {
      callTimers.current.push(window.setTimeout(() => setCountNum(b + 1), b * (cs / countBeats) * 1000))
    }
    callTimers.current.push(window.setTimeout(() => setCountNum(null), cs * 1000))
  }, [level.bpm, countBeats])

  // ── Resolve one round, update lives/score, advance or finish ──
  const resolveRound = useCallback(
    (idx: number, res: RoundResult) => {
      const agg = aggRef.current
      agg.notes += res.tally.total
      agg.hits += res.hits
      agg.weighted += res.tally.perfect * 1 + res.tally.great * 0.85 + res.tally.good * 0.6
      agg.wrong += res.tally.miss
      agg.bestStreak = bestStreakRef.current

      const roundHitRate = res.tally.total > 0 ? res.hits / res.tally.total : 1
      if (roundHitRate < 0.6) {
        livesRef.current -= 1
        setLives(livesRef.current)
      } else if (res.clean && res.tally.total > 0) {
        scoreRef.current += 150
        setScore(scoreRef.current)
        // Fade the pips after the first clean (no-miss) round, if this level's
        // scaffold opts into it. Once faded, stays faded for the rest of the level.
        if (level.scaffold.pipsFadeAfterClean) setPipsFaded(true)
      }

      const isLast = idx + 1 >= level.rounds
      const dead = livesRef.current <= 0

      window.setTimeout(() => {
        if (dead || isLast) {
          finishLevel(!dead && isLast)
        } else {
          setRoundIdx(idx + 1)
          window.setTimeout(() => beginRound(idx + 1), 400)
        }
      }, 1100)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level.rounds],
  )

  // ── Build & run a fresh round ──
  const beginRound = useCallback(
    (idx: number) => {
      const rng = makeRng(Date.now() + idx * 7919 + Math.floor(Math.random() * 9999))
      const p = generatePattern(cellsForLevel(level), { bars: level.bars, beatsPerBar, beatUnit, rng })
      setPattern(p)
      const n = onsetCount(p)
      setPipStates(new Array(n).fill('idle'))
      setCountNum(null)
      setHoldCue(null)

      clearCallTimers()
      // Count-in offset MUST match the engine's internal count-in (one bar of
      // unit-beats at the UNIT bpm) so the opponent-clap visuals align with audio.
      // For compound the unit is the eighth and unitBpm = felt bpm × 3.
      const countInSec = (beatsPerBar * 60) / unitBpm
      const totalBeats = patternBeats(p)
      const beatSec = 60 / unitBpm

      // count-in numbers for the CALL
      scheduleCountIn()

      // opponent claps + pip lights aligned to CALL onsets
      for (const o of onsetBeats(p)) {
        const tMs = (countInSec + o.beat * beatSec) * 1000
        callTimers.current.push(
          window.setTimeout(() => {
            setOppClap((x) => x + 1)
            setPipStates((prev) => {
              const next = [...prev]
              next[o.index] = 'call'
              return next
            })
          }, tMs),
        )
      }
      // clear pips after the call, before the response
      callTimers.current.push(
        window.setTimeout(
          () => setPipStates(new Array(n).fill('idle')),
          (countInSec + totalBeats * beatSec) * 1000 + 250,
        ),
      )

      startRound(p, {
        bpm: unitBpm,
        beatsPerBar,
        feltStride,
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
            bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current)
            setComboBump((c) => c + 1)
            const base = r === 'perfect' ? 100 : r === 'great' ? 70 : 40
            const mult = 1 + Math.floor(streakRef.current / 5) * 0.5
            scoreRef.current += Math.round(base * mult)
            setScore(scoreRef.current)
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
          resolveRound(idx, res)
        },
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, startRound, clearCallTimers, scheduleCountIn, resolveRound],
  )

  // ── Finish the level → recordRun ──
  const finishLevel = useCallback(
    (won: boolean) => {
      const agg = aggRef.current
      const accuracy = agg.notes > 0 ? Math.min(1, agg.weighted / agg.notes) : 0
      const mastered =
        won &&
        level.tier >= MASTERY_STAGE - 1 &&
        accuracy >= MASTERY_ACCURACY &&
        agg.notes >= MASTERY_MIN_NOTES
      const outcome: RunOutcome = recordRun('echo', {
        levelId: level.id,
        score: scoreRef.current,
        accuracy,
        notes: agg.notes,
        mastered,
        unlockNext: level.unlockNext,
        bestStreak: agg.bestStreak,
        stageReached: level.num,
        wrong: agg.wrong,
      })
      setResults({
        title: won ? 'Level Cleared!' : 'Out of Lives',
        subtitle: won
          ? `You out-clapped ${level.opponent.name}!`
          : `${level.opponent.name} got the better of you — try again!`,
        crown: won ? '🏆' : level.opponent.emoji,
        score: scoreRef.current,
        accuracy,
        outcome,
        win: won,
      })
      setScreen('results')
    },
    [level, recordRun],
  )

  // ── Start (user gesture) ──
  const start = useCallback(async () => {
    await engine.resume()
    engine.setWindows(tightenWindows(level.difficulty))
    engine.setHoldWindows(tightenHold(level.difficulty))
    aggRef.current = { notes: 0, hits: 0, weighted: 0, wrong: 0, bestStreak: 0 }
    bestStreakRef.current = 0
    streakRef.current = 0
    livesRef.current = START_LIVES
    scoreRef.current = 0
    setLives(START_LIVES)
    setScore(0)
    setStreak(0)
    setRoundIdx(0)
    setPipsFaded(false)
    setScreen('battle')
    window.setTimeout(() => beginRound(0), 250)
  }, [engine, level.difficulty, beginRound])

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

  // ── HOLD-aware note-ON: judge the attack (drives the tally via the engine tap
  // handler, exactly like a tap) and tell the pad whether/how long to hold. ──
  const onPadPress = useCallback((): PressResult | null => {
    const a = engine.judgeHoldOn()
    return { rating: a.rating, holdSec: a.isHold ? a.expectedSec : 0 }
  }, [engine])

  const showHoldCue = useCallback((rel: HoldRelease) => {
    if (rel === 'good') {
      setHoldCue(null)
      return
    }
    setHoldCue(rel)
    setHoldCueTick((t) => t + 1)
    if (holdCueTimer.current) window.clearTimeout(holdCueTimer.current)
    holdCueTimer.current = window.setTimeout(() => setHoldCue(null), 900)
  }, [])

  // ── HOLD-aware note-OFF: grade the held duration; a too-short/long release is
  // a GENTLE cue, never a harsh miss (no tally change, no life lost). ──
  const onPadRelease = useCallback(() => {
    const j = engine.judgeHoldOff()
    if (j) showHoldCue(j.release)
  }, [engine, showHoldCue])

  useEffect(() => {
    return () => {
      if (holdCueTimer.current) window.clearTimeout(holdCueTimer.current)
    }
  }, [])

  // ── Scaffold-derived flags for the beat track ──
  // Pips: on per the level's scaffold, unless they've faded after a clean round.
  const showPips = level.scaffold.pips && !pipsFaded
  // Beat-grid: the global "Show beat lines" setting overrides the level default
  // when set to 'on'/'off'; 'auto' follows the level's scaffold.beatGrid.
  const showGrid =
    beatLines === 'on' ? true : beatLines === 'off' ? false : level.scaffold.beatGrid
  // Syllables: only on the Feature level of a new element (scaffold.syllables).
  const showSyllables = level.scaffold.syllables

  // ── Phase-derived UI ──
  const turn = phase === 'call' ? 'opponent' : phase === 'response' ? 'you' : 'none'
  const banner =
    phase === 'call'
      ? `${level.opponent.emoji} ${level.opponent.name} claps...`
      : phase === 'gap'
        ? 'Get ready...'
        : phase === 'response'
          ? '🎤 Your turn — clap it back!'
          : ''
  const bannerKind = phase === 'call' ? 'call' : phase === 'response' ? 'response' : 'gap'
  const padBig =
    phase === 'call' ? 'Listen' : phase === 'gap' ? 'Ready...' : phase === 'response' ? 'TAP!' : '...'
  const padHint =
    phase === 'response' ? 'Space or tap the pad' : phase === 'call' ? 'Hear the rhythm' : ''

  if (screen === 'results' && results) {
    return (
      <Results
        data={results}
        onReplay={replay}
        onNext={
          results.win && results.outcome.unlockedLevel && onNextLevel ? onNextLevel : undefined
        }
        nextLabel="Next Level"
        onMenu={onExit}
      />
    )
  }

  return (
    <>
      {screen === 'intro' && (
        <div className="echo-startover">
          <div className="echo-startover__inner">
            <div style={{ fontSize: 60 }}>{level.opponent.emoji}</div>
            <h2>
              Level {level.num}: {level.title}
            </h2>
            <p>
              {level.blurb}
              <br />
              Trade fours with <strong>{level.opponent.name}</strong> over {level.rounds} rounds at{' '}
              {level.bpm} BPM. {START_LIVES} lives.
            </p>
            <Button variant="primary" accent="var(--echo)" size="lg" onClick={() => void start()}>
              Start Battle
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
        <Stage opponent={level.opponent} turn={turn} oppClapTick={oppClap} youClapTick={youClap} />
      </div>

      <BeatTrack
        pattern={pattern}
        states={pipStates}
        progress={null}
        showPips={showPips}
        showGrid={showGrid}
        showSyllables={showSyllables}
      />

      <div className="echo-rounds" aria-label="round progress">
        {Array.from({ length: level.rounds }).map((_, i) => (
          <span
            key={i}
            className={`echo-rounds__dot ${i < roundIdx ? 'is-done' : ''} ${
              i === roundIdx ? 'is-now' : ''
            }`}
          />
        ))}
      </div>

      <div className="echo-padwrap">
        {streak >= 5 && (
          <div className={`echo-combo ${comboBump ? 'is-bump' : ''}`} key={comboBump}>
            ×{(1 + Math.floor(streak / 5) * 0.5).toFixed(1)}
          </div>
        )}
        <div className="echo-rating-mount">
          <RatingPopup rating={rating} error_ms={ratingErr} tick={ratingTick} />
        </div>
        {holdCue && (
          <div className="echo-holdcue" data-rel={holdCue} key={holdCueTick}>
            {holdCue === 'short' ? 'Hold longer' : 'Hold shorter'}
          </div>
        )}
        <TapPad
          armed={phase === 'response'}
          disabled={phase !== 'response'}
          bigLabel={padBig}
          hint={padHint}
          count={countNum}
          onTap={usesHolds ? undefined : onPadTap}
          onPress={usesHolds ? onPadPress : undefined}
          onRelease={usesHolds ? onPadRelease : undefined}
        />
      </div>

      <Hud
        name={profile?.name}
        xp={profile?.xp ?? 0}
        gems={profile?.gems ?? 0}
        score={score}
        lives={lives}
        maxLives={START_LIVES}
        streak={streak}
        accent="var(--echo)"
        compact
      />
    </>
  )
}
