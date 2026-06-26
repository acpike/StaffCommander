// RHYTHM DETECTIVE — "The Impostor Beat".
//
// A rhythmic IDENTIFICATION game: the player HEARS rhythms and recognizes them.
// Three rotating mechanics across eight "case files":
//   - Spot-the-Difference : hear A then A', tap which beat changed.
//   - Catch the Impostor  : hear a target, pick the matching suspect from a lineup.
//   - Forbidden Rhythm    : memorize a wanted pattern, sound the alarm when it appears.
//
// Audio is driven entirely by the shared engine's `preview()` (no tap-timing
// judging — Detective answers are picks/taps, not in-time taps). Puzzle
// relationships are guaranteed with `comparePatterns`. Results go through
// `recordRun('detective', …)` and the outcome is celebrated on a results screen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameMeta, GameProps } from '../../shared/gameModule'
import { useStore, activeProfile, START_LIVES } from '../../shared/store'
import { MASTERY_STAGE, MASTERY_ACCURACY } from '../../shared/progression'
import { useRhythmEngine } from '../../shared/audio/useRhythmEngine'
import { patternBeats, type Pattern } from '../../shared/audio/patterns'
import { sound } from '../../shared/audio/sound'
import { Button, Hud } from '../../shared/ui'
import { LEVELS, FIRST_LEVEL_ID, nextLevelId, type LevelDef } from './levels'
import {
  makePuzzle,
  type Puzzle,
  type SpotPuzzle,
  type LineupPuzzle,
  type AlarmPuzzle,
} from './puzzles'
import { RhythmStrip } from './RhythmStrip'
import './detective.css'

export const meta: GameMeta = {
  id: 'detective',
  title: 'Rhythm Detective',
  tagline: 'Catch the impostor beat. Spot what changed. Trust your ears.',
  description:
    'Hear a rhythm, then identify it: spot-the-difference, catch the impostor from a lineup, or freeze on the forbidden pattern. Pure ear ID — no notation.',
  accent: '#38bdf8',
  accent2: '#818cf8',
  icon: '🕵️',
}

const ACCENT = meta.accent
const POINTS_CORRECT = 100
const STREAK_BONUS = 25

type Screen = 'select' | 'play' | 'results'

interface RunStats {
  correct: number
  total: number
  score: number
  streak: number
  bestStreak: number
  lives: number
}

interface FinishedOutcome {
  xpGained: number
  gemsGained: number
  newAchievements: string[]
  leveledUp: boolean
  rankName: string
  masteredNow: boolean
  unlockedLevel: string | null
  newBest: boolean
}

export default function Detective({ onExit }: GameProps) {
  const engine = useRhythmEngine()
  const profile = useStore(activeProfile)
  const recordRun = useStore((s) => s.recordRun)
  const unlockLevel = useStore((s) => s.unlockLevel)

  const [screen, setScreen] = useState<Screen>('select')
  const [levelId, setLevelId] = useState<string | null>(null)
  const level = useMemo(() => LEVELS.find((l) => l.id === levelId) ?? null, [levelId])

  const [stats, setStats] = useState<RunStats>(emptyStats())
  const [outcome, setOutcome] = useState<FinishedOutcome | null>(null)

  // Which levels are playable: first one always; plus stored unlocks.
  const unlocked = useMemo(() => {
    const set = new Set<string>([FIRST_LEVEL_ID])
    const gp = profile?.games.detective
    gp?.unlocked.forEach((id) => set.add(id))
    return set
  }, [profile])

  const startLevel = useCallback(
    async (id: string) => {
      await engine.resume()
      setLevelId(id)
      setStats(emptyStats())
      setOutcome(null)
      setScreen('play')
    },
    [engine],
  )

  const finishLevel = useCallback(
    (final: RunStats) => {
      if (!level) return
      engine.stop()
      const accuracy = final.total > 0 ? final.correct / final.total : 0
      const mastered = level.stage >= MASTERY_STAGE && accuracy >= MASTERY_ACCURACY
      const unlock = nextLevelId(level.id)
      const res = recordRun('detective', {
        levelId: level.id,
        score: final.score,
        accuracy,
        notes: final.total,
        mastered,
        unlockNext: unlock,
        bestStreak: final.bestStreak,
        stageReached: level.stage,
        wrong: final.total - final.correct,
      })
      // Always allow forward progress once a case is cleared with decent accuracy,
      // even before stage-4 mastery (so early cases gate the next case).
      if (unlock && accuracy >= 0.6) unlockLevel('detective', unlock)
      setOutcome({
        xpGained: res.xpGained,
        gemsGained: res.gemsGained,
        newAchievements: res.newAchievements,
        leveledUp: res.leveledUp,
        rankName: res.rank.name,
        masteredNow: res.masteredNow,
        unlockedLevel: res.unlockedLevel ?? (unlock && accuracy >= 0.6 ? unlock : null),
        newBest: res.newBest,
      })
      setScreen('results')
    },
    [engine, level, recordRun, unlockLevel],
  )

  // Stop audio when leaving the game entirely.
  useEffect(() => () => engine.stop(), [engine])

  if (screen === 'select' || !level) {
    return (
      <LevelSelect
        profile={profile}
        unlocked={unlocked}
        onPick={startLevel}
        onExit={onExit}
      />
    )
  }

  if (screen === 'results' && outcome) {
    return (
      <Results
        level={level}
        stats={stats}
        outcome={outcome}
        onReplay={() => startLevel(level.id)}
        onNext={() => {
          const nxt = nextLevelId(level.id)
          if (nxt && unlocked.has(nxt)) startLevel(nxt)
          else setScreen('select')
        }}
        nextAvailable={(() => {
          const nxt = nextLevelId(level.id)
          return !!nxt && (unlocked.has(nxt) || outcome.unlockedLevel === nxt)
        })()}
        onMenu={() => setScreen('select')}
      />
    )
  }

  return (
    <PlaySession
      key={level.id}
      level={level}
      engine={engine}
      profile={profile}
      onUpdate={setStats}
      onFinish={finishLevel}
      onQuit={() => {
        engine.stop()
        setScreen('select')
      }}
    />
  )
}

function emptyStats(): RunStats {
  return { correct: 0, total: 0, score: 0, streak: 0, bestStreak: 0, lives: START_LIVES }
}

// ════════════════════════════════════════════════════════════════════════════
// LEVEL SELECT
// ════════════════════════════════════════════════════════════════════════════
function LevelSelect({
  profile,
  unlocked,
  onPick,
  onExit,
}: {
  profile: ReturnType<typeof activeProfile> extends never ? never : ReturnType<typeof activeProfile>
  unlocked: Set<string>
  onPick: (id: string) => void
  onExit: () => void
}) {
  const gp = profile?.games.detective
  return (
    <div className="rd" style={{ ['--rd-accent' as string]: ACCENT, ['--rd-accent2' as string]: meta.accent2 }}>
      <div className="rd__noir" aria-hidden />
      <header className="rd__top">
        <Button variant="ghost" size="sm" onClick={onExit} icon="←">
          Menu
        </Button>
        <Hud
          name={profile?.name}
          xp={profile?.xp ?? 0}
          gems={profile?.gems ?? 0}
          accent={ACCENT}
          compact
        />
      </header>

      <div className="rd__hero">
        <div className="rd__badge" aria-hidden>
          {meta.icon}
        </div>
        <h1 className="rd__title">Rhythm Detective</h1>
        <p className="rd__tag">{meta.tagline}</p>
      </div>

      <div className="rd__cases">
        {LEVELS.map((lvl, i) => {
          const isUnlocked = unlocked.has(lvl.id)
          const mastered = gp?.mastered.includes(lvl.id)
          const best = gp?.best[lvl.id] ?? 0
          return (
            <button
              key={lvl.id}
              className={`rd-case ${isUnlocked ? '' : 'is-locked'} ${mastered ? 'is-mastered' : ''}`}
              style={{ animationDelay: `${i * 45}ms` }}
              disabled={!isUnlocked}
              onClick={() => isUnlocked && onPick(lvl.id)}
            >
              <div className="rd-case__num">CASE {String(i + 1).padStart(2, '0')}</div>
              <div className="rd-case__icon" aria-hidden>
                {isUnlocked ? lvl.icon : '🔒'}
              </div>
              <div className="rd-case__name">{lvl.name}</div>
              <div className="rd-case__brief">{lvl.brief}</div>
              <div className="rd-case__foot">
                <span className={`rd-tag rd-tag--${lvl.mechanic}`}>{mechanicLabel(lvl.mechanic)}</span>
                {best > 0 && <span className="rd-case__best">Best {best.toLocaleString()}</span>}
                {mastered && <span className="rd-case__stamp">SOLVED</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function mechanicLabel(m: LevelDef['mechanic']): string {
  return m === 'spot' ? 'Spot the Difference' : m === 'lineup' ? 'Catch the Impostor' : 'Forbidden Rhythm'
}

// ════════════════════════════════════════════════════════════════════════════
// PLAY SESSION — owns lives/streak/score, generates puzzles, routes to mechanic.
// ════════════════════════════════════════════════════════════════════════════
type Feedback = { ok: boolean; text: string } | null

function PlaySession({
  level,
  engine,
  profile,
  onUpdate,
  onFinish,
  onQuit,
}: {
  level: LevelDef
  engine: ReturnType<typeof useRhythmEngine>
  profile: ReturnType<typeof activeProfile>
  onUpdate: (s: RunStats) => void
  onFinish: (s: RunStats) => void
  onQuit: () => void
}) {
  const [stats, setStats] = useState<RunStats>(emptyStats)
  const [qIndex, setQIndex] = useState(0)
  const [puzzle, setPuzzle] = useState<Puzzle>(() => makePuzzle(level))
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [locked, setLocked] = useState(false) // input locked between Q's
  const statsRef = useRef(stats)
  statsRef.current = stats

  useEffect(() => onUpdate(stats), [stats, onUpdate])

  // Advance to the next question (or finish the case).
  const advance = useCallback(() => {
    const next = qIndex + 1
    if (next >= level.questions) {
      onFinish(statsRef.current)
      return
    }
    setFeedback(null)
    setLocked(false)
    setQIndex(next)
    setPuzzle(makePuzzle(level))
  }, [qIndex, level, onFinish])

  // Record an answer (correct/incorrect) and queue the next question.
  const answer = useCallback(
    (correct: boolean, customText?: string) => {
      if (locked) return
      setLocked(true)
      setStats((s) => {
        const streak = correct ? s.streak + 1 : 0
        const gained = correct ? POINTS_CORRECT + (s.streak >= 1 ? s.streak * STREAK_BONUS : 0) : 0
        const lives = correct ? s.lives : s.lives - 1
        return {
          correct: s.correct + (correct ? 1 : 0),
          total: s.total + 1,
          score: s.score + gained,
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
          lives,
        }
      })
      if (correct) sound.success()
      else sound.miss()
      setFeedback({
        ok: correct,
        text: customText ?? (correct ? randomPraise() : 'Not quite — trust your ears next time.'),
      })

      // out of lives? end the case after a beat.
      window.setTimeout(() => {
        const cur = statsRef.current
        if (cur.lives <= 0) onFinish(cur)
        else advance()
      }, 1150)
    },
    [locked, advance, onFinish],
  )

  const common = {
    level,
    engine,
    puzzle,
    locked,
    feedback,
    onAnswer: answer,
  }

  return (
    <div className="rd rd--play" style={{ ['--rd-accent' as string]: ACCENT, ['--rd-accent2' as string]: meta.accent2 }}>
      <div className="rd__noir" aria-hidden />
      <header className="rd__top">
        <Button variant="ghost" size="sm" onClick={onQuit} icon="←">
          Quit
        </Button>
        <Hud
          name={profile?.name}
          xp={profile?.xp ?? 0}
          gems={profile?.gems ?? 0}
          score={stats.score}
          lives={stats.lives}
          maxLives={START_LIVES}
          streak={stats.streak}
          accent={ACCENT}
          compact
        />
      </header>

      <div className="rd__progress">
        <div className="rd__progress-meta">
          <span className="rd__case-name">{level.name}</span>
          <span className="rd__qcount">
            Question {Math.min(qIndex + 1, level.questions)} / {level.questions}
          </span>
        </div>
        <div className="rd__progress-bar">
          <div
            className="rd__progress-fill"
            style={{ width: `${(qIndex / level.questions) * 100}%` }}
          />
        </div>
      </div>

      <main className="rd__stage">
        {puzzle.kind === 'spot' && <SpotRound {...common} puzzle={puzzle as SpotPuzzle} />}
        {puzzle.kind === 'lineup' && <LineupRound {...common} puzzle={puzzle as LineupPuzzle} />}
        {puzzle.kind === 'alarm' && <AlarmRound {...common} puzzle={puzzle as AlarmPuzzle} />}
      </main>
    </div>
  )
}

const PRAISE = ['Case cracked!', 'Sharp ears!', 'Nailed it.', 'Detective material.', 'Spot on!', 'Good catch!']
function randomPraise(): string {
  return PRAISE[Math.floor(Math.random() * PRAISE.length)]
}

// Shared props for each mechanic round.
interface RoundProps {
  level: LevelDef
  engine: ReturnType<typeof useRhythmEngine>
  locked: boolean
  feedback: Feedback
  onAnswer: (correct: boolean, customText?: string) => void
}

// ── A reusable hook to play a single pattern with playhead progress. ─────────
function usePreview(engine: ReturnType<typeof useRhythmEngine>, bpm: number) {
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const durRef = useRef(0)

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  const play = useCallback(
    (id: number, pattern: Pattern, countInBars = 0) => {
      engine.stop()
      stopRaf()
      const beats = patternBeats(pattern)
      durRef.current = (beats * 60) / bpm
      setPlayingId(id)
      setProgress(0)
      engine.preview(pattern, {
        bpm,
        countInBars,
        onComplete: () => {
          setPlayingId(null)
          setProgress(0)
          stopRaf()
        },
      })
      const loop = () => {
        const t = engine.songTime()
        if (!Number.isNaN(t)) {
          const p = Math.max(0, Math.min(1, t / durRef.current))
          setProgress(p)
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    },
    [engine, bpm, stopRaf],
  )

  useEffect(() => () => stopRaf(), [stopRaf])
  return { play, playingId, progress }
}

// ════════════════════════════════════════════════════════════════════════════
// MECHANIC 1 — SPOT THE DIFFERENCE
// ════════════════════════════════════════════════════════════════════════════
function SpotRound({ level, engine, puzzle, locked, feedback, onAnswer }: RoundProps & { puzzle: SpotPuzzle }) {
  const { play, playingId, progress } = usePreview(engine, level.bpm)
  const [selected, setSelected] = useState<number | null>(null)
  // Easier tiers (stage 1) let you answer start/middle/end instead of exact beat.
  const coarse = level.stage <= 1
  const slots = puzzle.beatSlots

  const playA = useCallback(() => play(0, puzzle.a, 1), [play, puzzle])
  const playB = useCallback(() => play(1, puzzle.b, 1), [play, puzzle])

  // Auto-play A then B on mount.
  useEffect(() => {
    const t = window.setTimeout(() => play(0, puzzle.a, 1), 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle])

  const region = (beat: number): 'start' | 'middle' | 'end' => {
    const third = slots / 3
    if (beat < third) return 'start'
    if (beat < 2 * third) return 'middle'
    return 'end'
  }

  const submit = useCallback(
    (choice: number) => {
      if (locked) return
      setSelected(choice)
      const correct = coarse
        ? region(choice) === region(puzzle.changedBeat)
        : choice === puzzle.changedBeat
      onAnswer(correct, correct ? 'You found the swapped beat!' : `It changed on beat ${puzzle.changedBeat + 1}.`)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locked, coarse, puzzle, onAnswer],
  )

  // keyboard: R replays, 1-8 picks a beat slot
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      if (k === 'r') playA()
      else if (k === 'b') playB()
      else if (!locked) {
        const n = parseInt(e.key, 10)
        if (!Number.isNaN(n) && n >= 1 && n <= slots) submit(n - 1)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [playA, playB, submit, slots, locked])

  return (
    <div className="rd-round rd-spot">
      <p className="rd-round__prompt">Two takes of the same phrase — one beat is different. Which one?</p>

      <div className="rd-spot__takes">
        <TakeButton label="Take A" hot={playingId === 0} onClick={playA} accent={ACCENT}>
          <RhythmStrip pattern={puzzle.a} accent={ACCENT} progress={playingId === 0 ? progress : undefined} />
        </TakeButton>
        <TakeButton label="Take B" hot={playingId === 1} onClick={playB} accent={meta.accent2!}>
          <RhythmStrip pattern={puzzle.b} accent={meta.accent2} progress={playingId === 1 ? progress : undefined} />
        </TakeButton>
      </div>

      {coarse ? (
        <div className="rd-spot__regions">
          <p className="rd-round__sub">Where did the change happen?</p>
          <div className="rd-spot__regionrow">
            {(['start', 'middle', 'end'] as const).map((reg, i) => {
              const repBeat = i === 0 ? 0 : i === 1 ? Math.floor(slots / 2) : slots - 1
              const isSel = selected != null && region(selected) === reg
              const isAns = locked && region(puzzle.changedBeat) === reg
              return (
                <button
                  key={reg}
                  className={`rd-region ${isSel ? 'is-sel' : ''} ${isAns ? 'is-answer' : ''}`}
                  disabled={locked}
                  onClick={() => submit(repBeat)}
                >
                  {reg.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rd-spot__slots">
          <p className="rd-round__sub">Tap the beat that changed</p>
          <div className="rd-slotrow" style={{ ['--slots' as string]: slots }}>
            {Array.from({ length: slots }).map((_, i) => {
              const isSel = selected === i
              const isAns = locked && i === puzzle.changedBeat
              return (
                <button
                  key={i}
                  className={`rd-slot ${isSel ? 'is-sel' : ''} ${isAns ? 'is-answer' : ''}`}
                  disabled={locked}
                  onClick={() => submit(i)}
                  aria-label={`Beat ${i + 1}`}
                >
                  <span className="rd-slot__n">{i + 1}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <FeedbackBar feedback={feedback} />
      <div className="rd-round__controls">
        <Button variant="outline" size="sm" onClick={playA} icon="↻">
          Replay A (R)
        </Button>
        <Button variant="outline" size="sm" onClick={playB} icon="↻">
          Replay B (B)
        </Button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MECHANIC 2 — CATCH THE IMPOSTOR (lineup)
// ════════════════════════════════════════════════════════════════════════════
const FACES = ['🕴️', '🧑‍🎤', '👮', '🦹', '🧙', '🧛']

function LineupRound({ level, engine, puzzle, locked, feedback, onAnswer }: RoundProps & { puzzle: LineupPuzzle }) {
  const { play, playingId, progress } = usePreview(engine, level.bpm)
  const [selected, setSelected] = useState<number | null>(null)
  const TARGET_ID = -1

  const playTarget = useCallback(() => play(TARGET_ID, puzzle.target, 1), [play, puzzle])

  useEffect(() => {
    const t = window.setTimeout(() => play(TARGET_ID, puzzle.target, 1), 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle])

  const submit = useCallback(
    (i: number) => {
      if (locked) return
      setSelected(i)
      const correct = i === puzzle.answerIndex
      onAnswer(
        correct,
        correct ? 'That suspect matches the wanted rhythm!' : 'Wrong suspect — listen to the target again.',
      )
    },
    [locked, puzzle, onAnswer],
  )

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      if (k === 'r') playTarget()
      else if (!locked) {
        const n = parseInt(e.key, 10)
        if (!Number.isNaN(n) && n >= 1 && n <= puzzle.suspects.length) submit(n - 1)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [playTarget, submit, puzzle.suspects.length, locked])

  return (
    <div className="rd-round rd-lineup">
      <p className="rd-round__prompt">Here's the wanted rhythm. Which suspect matches it?</p>

      <button className={`rd-target ${playingId === TARGET_ID ? 'is-hot' : ''}`} onClick={playTarget}>
        <span className="rd-target__icon" aria-hidden>
          🎯
        </span>
        <div className="rd-target__body">
          <span className="rd-target__label">WANTED RHYTHM · tap to replay (R)</span>
          <RhythmStrip
            pattern={puzzle.target}
            accent={ACCENT}
            progress={playingId === TARGET_ID ? progress : undefined}
            height={38}
          />
        </div>
      </button>

      <div className={`rd-lineup__grid n${puzzle.suspects.length}`}>
        {puzzle.suspects.map((s, i) => {
          const isSel = selected === i
          const isAns = locked && i === puzzle.answerIndex
          const isWrong = locked && isSel && i !== puzzle.answerIndex
          return (
            <div key={s.id} className={`rd-suspect ${isAns ? 'is-answer' : ''} ${isWrong ? 'is-wrong' : ''}`}>
              <div className="rd-suspect__face" aria-hidden>
                {FACES[i % FACES.length]}
              </div>
              <div className="rd-suspect__num">#{i + 1}</div>
              <button
                className={`rd-suspect__play ${playingId === i ? 'is-hot' : ''}`}
                onClick={() => play(i, s.pattern, 0)}
                aria-label={`Play suspect ${i + 1}`}
              >
                ▶ Hear
              </button>
              <RhythmStrip
                pattern={s.pattern}
                accent={meta.accent2}
                progress={playingId === i ? progress : undefined}
                height={34}
                dim={locked && !isAns && !isSel}
              />
              <Button
                variant={isSel ? 'primary' : 'outline'}
                size="sm"
                accent={ACCENT}
                block
                disabled={locked}
                onClick={() => submit(i)}
              >
                {isAns ? 'MATCH ✓' : isWrong ? 'Impostor ✗' : `Accuse (${i + 1})`}
              </Button>
            </div>
          )
        })}
      </div>

      <FeedbackBar feedback={feedback} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MECHANIC 3 — FORBIDDEN RHYTHM (alarm)
// ════════════════════════════════════════════════════════════════════════════
function AlarmRound({ level, engine, puzzle, locked, feedback, onAnswer }: RoundProps & { puzzle: AlarmPuzzle }) {
  const { play, playingId, progress } = usePreview(engine, level.bpm)
  // phase: 'learn' (memorize wanted) → 'hunt' (classify current step)
  const [phase, setPhase] = useState<'learn' | 'hunt'>('learn')
  const [stepIdx, setStepIdx] = useState(0)
  const [caught, setCaught] = useState(0) // forbidden ones correctly caught
  const [decision, setDecision] = useState<null | { correct: boolean; alarm: boolean }>(null)
  const stepRef = useRef(0)
  stepRef.current = stepIdx

  const totalForbidden = useMemo(() => puzzle.steps.filter((s) => s.forbidden).length, [puzzle])

  const playWanted = useCallback(() => play(-1, puzzle.wanted, 1), [play, puzzle])

  // Auto-preview wanted on entering learn.
  useEffect(() => {
    if (phase === 'learn') {
      const t = window.setTimeout(() => play(-1, puzzle.wanted, 1), 300)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, puzzle])

  const playStep = useCallback(
    (i: number) => {
      play(i, puzzle.steps[i].pattern, 0)
    },
    [play, puzzle],
  )

  const startHunt = useCallback(() => {
    setPhase('hunt')
    setStepIdx(0)
    setDecision(null)
    window.setTimeout(() => play(0, puzzle.steps[0].pattern, 0), 250)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, puzzle])

  // Decide on the current step: alarm = player thinks it's forbidden.
  const decide = useCallback(
    (alarm: boolean) => {
      if (locked || decision) return
      const step = puzzle.steps[stepRef.current]
      const correct = alarm === step.forbidden
      if (correct && step.forbidden) {
        setCaught((c) => c + 1)
        sound.success()
      } else if (correct) {
        sound.ratingPing('good')
      } else {
        sound.miss()
      }
      setDecision({ correct, alarm })

      window.setTimeout(() => {
        const next = stepRef.current + 1
        if (next >= puzzle.steps.length) {
          // Round done — score on whether MOST decisions were right.
          // We resolve the whole alarm round as a single question for the session:
          // correct if the player got every step right.
          const allRight = roundAllRight.current && correct
          onAnswer(allRight, allRight ? 'Every call correct — flawless stakeout!' : 'Some calls were off. Keep at it.')
          return
        }
        if (!correct) roundAllRight.current = false
        setStepIdx(next)
        setDecision(null)
        window.setTimeout(() => play(next, puzzle.steps[next].pattern, 0), 200)
      }, 950)
      if (!correct) roundAllRight.current = false
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locked, decision, puzzle, onAnswer, play],
  )

  const roundAllRight = useRef(true)
  useEffect(() => {
    roundAllRight.current = true
  }, [puzzle])

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      if (phase === 'learn') {
        if (k === 'r') playWanted()
        if (k === ' ' || k === 'enter') startHunt()
      } else {
        if (k === 'r') playStep(stepRef.current)
        if (k === ' ' || k === 'a') decide(true)
        if (k === 'p' || k === 'l') decide(false)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [phase, playWanted, startHunt, playStep, decide])

  if (phase === 'learn') {
    return (
      <div className="rd-round rd-alarm">
        <p className="rd-round__prompt">Memorize the WANTED rhythm. You'll sound the alarm when it returns.</p>
        <button className={`rd-wanted ${playingId === -1 ? 'is-hot' : ''}`} onClick={playWanted}>
          <span className="rd-wanted__poster">WANTED</span>
          <span className="rd-wanted__icon" aria-hidden>
            🚨
          </span>
          <RhythmStrip
            pattern={puzzle.wanted}
            accent={ACCENT}
            progress={playingId === -1 ? progress : undefined}
            height={50}
          />
          <span className="rd-wanted__hint">Tap / press R to hear it again</span>
        </button>
        <Button variant="primary" size="lg" accent={ACCENT} onClick={startHunt} icon="🔎">
          Start the Stakeout (Space)
        </Button>
      </div>
    )
  }

  // hunt phase
  return (
    <div className="rd-round rd-alarm">
      <p className="rd-round__prompt">
        Suspect {stepIdx + 1} of {puzzle.steps.length}. Is this the forbidden rhythm?
      </p>

      <div className="rd-alarm__queue" aria-hidden>
        {puzzle.steps.map((_, i) => (
          <span
            key={i}
            className={`rd-alarm__pip ${i < stepIdx ? 'is-done' : ''} ${i === stepIdx ? 'is-now' : ''}`}
          />
        ))}
      </div>

      <button className={`rd-alarm__current ${playingId === stepIdx ? 'is-hot' : ''}`} onClick={() => playStep(stepIdx)}>
        <span className="rd-alarm__cur-icon" aria-hidden>
          🎧
        </span>
        <RhythmStrip
          pattern={puzzle.steps[stepIdx].pattern}
          accent={ACCENT}
          progress={playingId === stepIdx ? progress : undefined}
          height={46}
        />
        <span className="rd-wanted__hint">Tap / R to replay this suspect</span>
      </button>

      <div className="rd-alarm__buttons">
        <button
          className={`rd-bigbtn rd-bigbtn--alarm ${decision?.alarm ? (decision.correct ? 'is-good' : 'is-bad') : ''}`}
          disabled={!!decision}
          onClick={() => decide(true)}
        >
          🚨 ALARM!
          <small>It's the one (A / Space)</small>
        </button>
        <button
          className={`rd-bigbtn rd-bigbtn--pass ${decision && !decision.alarm ? (decision.correct ? 'is-good' : 'is-bad') : ''}`}
          disabled={!!decision}
          onClick={() => decide(false)}
        >
          ✋ LET IT PASS
          <small>Not a match (P / L)</small>
        </button>
      </div>

      <div className="rd-alarm__score">
        Caught {caught} / {totalForbidden} forbidden
      </div>

      <FeedbackBar feedback={feedback} />
      {decision && (
        <div className={`rd-alarm__verdict ${decision.correct ? 'ok' : 'no'}`}>
          {decision.correct ? '✓ Good call' : '✗ Misjudged'}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={playWanted} icon="🚨">
        Remind me of the wanted rhythm
      </Button>
    </div>
  )
}

// ── shared little pieces ─────────────────────────────────────────────────────
function TakeButton({
  label,
  hot,
  onClick,
  accent,
  children,
}: {
  label: string
  hot: boolean
  onClick: () => void
  accent: string
  children: React.ReactNode
}) {
  return (
    <button className={`rd-take ${hot ? 'is-hot' : ''}`} onClick={onClick} style={{ ['--take' as string]: accent }}>
      <span className="rd-take__label">
        <span className="rd-take__play">▶</span> {label}
      </span>
      {children}
    </button>
  )
}

function FeedbackBar({ feedback }: { feedback: Feedback }) {
  if (!feedback) return <div className="rd-feedback rd-feedback--empty" />
  return <div className={`rd-feedback ${feedback.ok ? 'is-ok' : 'is-no'}`}>{feedback.text}</div>
}

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════
function Results({
  level,
  stats,
  outcome,
  onReplay,
  onNext,
  nextAvailable,
  onMenu,
}: {
  level: LevelDef
  stats: RunStats
  outcome: FinishedOutcome
  onReplay: () => void
  onNext: () => void
  nextAvailable: boolean
  onMenu: () => void
}) {
  const acc = stats.total > 0 ? stats.correct / stats.total : 0
  const pct = Math.round(acc * 100)
  const solved = acc >= 0.6
  const grade = pct >= 95 ? 'S' : pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : 'D'

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (outcome.masteredNow || outcome.leveledUp) sound.fanfare()
      else if (solved) sound.success()
    }, 250)
    return () => window.clearTimeout(t)
  }, [outcome, solved])

  return (
    <div className="rd rd--results" style={{ ['--rd-accent' as string]: ACCENT, ['--rd-accent2' as string]: meta.accent2 }}>
      <div className="rd__noir" aria-hidden />
      <div className="rd-results__card">
        <div className={`rd-results__stamp ${solved ? 'ok' : 'no'}`}>{solved ? 'CASE CLOSED' : 'COLD CASE'}</div>
        <h2 className="rd-results__title">{level.name}</h2>

        <div className={`rd-results__grade grade-${grade}`}>{grade}</div>

        <div className="rd-results__stats">
          <Stat label="Correct" value={`${stats.correct}/${stats.total}`} />
          <Stat label="Accuracy" value={`${pct}%`} />
          <Stat label="Score" value={stats.score.toLocaleString()} />
          <Stat label="Best streak" value={`🔥 ${stats.bestStreak}`} />
        </div>

        <div className="rd-results__rewards">
          <span className="rd-reward rd-reward--xp">+{outcome.xpGained} XP</span>
          <span className="rd-reward rd-reward--gems">◆ +{outcome.gemsGained}</span>
          {outcome.newBest && <span className="rd-reward rd-reward--best">New best!</span>}
        </div>

        {outcome.leveledUp && <Banner>⭐ Rank up — you're now {outcome.rankName}!</Banner>}
        {outcome.masteredNow && <Banner>🏆 Mastered! This case is fully solved.</Banner>}
        {outcome.unlockedLevel && !outcome.masteredNow && <Banner>🔓 New case file unlocked!</Banner>}
        {outcome.newAchievements.length > 0 && (
          <Banner>🎖 {outcome.newAchievements.length} new achievement{outcome.newAchievements.length > 1 ? 's' : ''}!</Banner>
        )}

        <div className="rd-results__actions">
          {nextAvailable && (
            <Button variant="primary" size="lg" accent={ACCENT} onClick={onNext} icon="→" block>
              Next Case
            </Button>
          )}
          <Button variant="outline" size="md" onClick={onReplay} icon="↻" block>
            Replay
          </Button>
          <Button variant="ghost" size="md" onClick={onMenu} block>
            Case Files
          </Button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rd-stat">
      <span className="rd-stat__v">{value}</span>
      <span className="rd-stat__l">{label}</span>
    </div>
  )
}

function Banner({ children }: { children: React.ReactNode }) {
  return <div className="rd-banner">{children}</div>
}
