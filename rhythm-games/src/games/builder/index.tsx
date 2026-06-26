// BEAT BUILDER — "Rhythm Factory / Loop Lab"
// Rhythmic DICTATION made fast & fun: hear a target rhythm, then RECONSTRUCT it
// by dragging Takadimi beat-cell BLOCKS from a palette onto a beat grid. Check
// with comparePatterns, then REVEAL the real SVG notation + syllables.
//
// Flow: level-select → listen (engine.preview) → drag-build (beat budget
// enforced) → CHECK (comparePatterns grades matched/total beats) → notation
// reveal (replay target vs your attempt) → results (recordRun celebration).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameMeta, GameProps } from '../../shared/gameModule'
import { useStore, activeProfile, START_LIVES } from '../../shared/store'
import type { RunOutcome } from '../../shared/store'
import { useRhythmEngine } from '../../shared/audio/useRhythmEngine'
import {
  pattern as makePattern,
  generatePattern,
  comparePatterns,
  onsetCount,
  patternBeats,
  type Pattern,
  type BeatCell,
} from '../../shared/audio/patterns'
import { MASTERY_ACCURACY, MASTERY_MIN_NOTES, MASTERY_STAGE } from '../../shared/progression'
import { Button, Hud } from '../../shared/ui'
import { LEVELS, FIRST_LEVEL_ID, levelById, type BuilderLevel } from './levels'
import { Notation } from './Notation'
import { BlockGlyph } from './BlockGlyph'
import { useBlockDrag } from './useBlockDrag'
import './builder.css'

export const meta: GameMeta = {
  id: 'builder',
  title: 'Beat Builder',
  tagline: 'Hear it, build it. Drag rhythm blocks to reconstruct the beat.',
  description:
    'Hear a rhythm and rebuild it by dragging named pattern blocks (Takadimi "words") onto a beat grid. Check it, then reveal the real notation + syllables.',
  accent: '#34d399',
  accent2: '#a3e635',
  icon: '🧱',
}

type Screen = 'menu' | 'play' | 'results'

// One placed block on the grid, with its absolute beat position.
interface Placed {
  uid: number
  cell: BeatCell
  startBeat: number
}

let UID = 1

export default function Builder({ onExit }: GameProps) {
  const engine = useRhythmEngine()
  const profile = useStore(activeProfile)
  const recordRun = useStore((s) => s.recordRun)
  const unlockLevel = useStore((s) => s.unlockLevel)

  const [screen, setScreen] = useState<Screen>('menu')
  const [levelId, setLevelId] = useState<string>(FIRST_LEVEL_ID)
  const [outcome, setOutcome] = useState<RunOutcome | null>(null)
  const [runStats, setRunStats] = useState<{ score: number; accuracy: number; notes: number; mastered: boolean } | null>(
    null,
  )

  const level = levelById(levelId)!

  // Which levels are unlocked: always l1, plus stored unlocks + anything mastered.
  const unlockedIds = useMemo(() => {
    const set = new Set<string>([FIRST_LEVEL_ID])
    const gp = profile?.games.builder
    gp?.unlocked.forEach((id) => set.add(id))
    gp?.mastered.forEach((id) => set.add(id))
    LEVELS.forEach((l) => {
      if (gp?.mastered.includes(l.id) && l.unlockNext) set.add(l.unlockNext)
    })
    return set
  }, [profile])

  const startLevel = useCallback(
    async (id: string) => {
      setLevelId(id)
      setScreen('play')
      try {
        await engine.resume()
      } catch {
        /* ignore */
      }
    },
    [engine],
  )

  const finishLevel = useCallback(
    (stats: { score: number; accuracy: number; notes: number; bestStreak: number; barsCleared: number }) => {
      const lvl = levelById(levelId)!
      const mastered =
        lvl.stage >= MASTERY_STAGE && stats.accuracy >= MASTERY_ACCURACY && stats.notes >= MASTERY_MIN_NOTES
      const out = recordRun('builder', {
        levelId: lvl.id,
        score: stats.score,
        accuracy: stats.accuracy,
        notes: stats.notes,
        mastered,
        unlockNext: lvl.unlockNext,
        bestStreak: stats.bestStreak,
        stageReached: lvl.stage,
      })
      // Unlock the next level on a solid clear (>=70%) so progression never
      // hard-stalls before mastery is reached.
      if (stats.accuracy >= 0.7 && lvl.unlockNext) unlockLevel('builder', lvl.unlockNext)
      setRunStats({ score: stats.score, accuracy: stats.accuracy, notes: stats.notes, mastered })
      setOutcome(out)
      setScreen('results')
    },
    [levelId, recordRun, unlockLevel],
  )

  return (
    <div className="bb" style={{ ['--bb' as string]: meta.accent, ['--bb2' as string]: meta.accent2 }}>
      <div className="bb__chrome">
        <Hud name={profile?.name} xp={profile?.xp ?? 0} gems={profile?.gems ?? 0} accent={meta.accent} compact />
      </div>

      {screen === 'menu' && (
        <LevelSelect
          unlocked={unlockedIds}
          masteredIds={new Set(profile?.games.builder?.mastered ?? [])}
          bestScores={profile?.games.builder?.best ?? {}}
          onPick={startLevel}
          onExit={onExit}
        />
      )}

      {screen === 'play' && (
        <PlaySession
          key={levelId + '-session'}
          level={level}
          engine={engine}
          onQuit={() => {
            engine.stop()
            setScreen('menu')
          }}
          onFinish={finishLevel}
        />
      )}

      {screen === 'results' && runStats && outcome && (
        <Results
          level={level}
          stats={runStats}
          outcome={outcome}
          onReplay={() => startLevel(levelId)}
          onNext={() => {
            const next = level.unlockNext
            if (next && unlockedIds.has(next)) startLevel(next)
            else setScreen('menu')
          }}
          hasNext={!!level.unlockNext && unlockedIds.has(level.unlockNext)}
          onMenu={() => setScreen('menu')}
        />
      )}
    </div>
  )
}

// ── LEVEL SELECT ─────────────────────────────────────────────────────────────
function LevelSelect({
  unlocked,
  masteredIds,
  bestScores,
  onPick,
  onExit,
}: {
  unlocked: Set<string>
  masteredIds: Set<string>
  bestScores: Record<string, number>
  onPick: (id: string) => void
  onExit: () => void
}) {
  return (
    <div className="bb__menu">
      <header className="bb__hero">
        <div className="bb__heroicon" aria-hidden>
          🧱
        </div>
        <div>
          <h1 className="bb__title">Beat Builder</h1>
          <p className="bb__tag">Hear the loop. Drag the blocks. Build the beat.</p>
        </div>
      </header>

      <div className="bb__levels">
        {LEVELS.map((l) => {
          const open = unlocked.has(l.id)
          const mastered = masteredIds.has(l.id)
          const best = bestScores[l.id]
          return (
            <button
              key={l.id}
              className={`bb__levelcard ${open ? '' : 'is-locked'} ${mastered ? 'is-mastered' : ''}`}
              disabled={!open}
              onClick={() => open && onPick(l.id)}
            >
              <div className="bb__levelnum">{open ? l.stage : '🔒'}</div>
              <div className="bb__levelbody">
                <div className="bb__levelname">{l.title}</div>
                <div className="bb__levelsub">{l.subtitle}</div>
                <div className="bb__levelmeta">
                  <span className="bb__chip">
                    {l.beatsPerBar}/{l.beatUnit}
                  </span>
                  <span className="bb__chip">
                    {l.bars} bar{l.bars > 1 ? 's' : ''}
                  </span>
                  <span className="bb__chip">{l.bpm} bpm</span>
                  {best != null && <span className="bb__chip bb__chip--best">★ {best}</span>}
                </div>
              </div>
              {mastered && (
                <div className="bb__mastered" aria-label="mastered">
                  ⭐
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="bb__menufoot">
        <Button variant="ghost" onClick={onExit} icon="←">
          Back to games
        </Button>
      </div>
    </div>
  )
}

// ── PLAY SESSION ─────────────────────────────────────────────────────────────
const PUZZLES_PER_LEVEL = 4

interface PlayProps {
  level: BuilderLevel
  engine: ReturnType<typeof useRhythmEngine>
  onQuit: () => void
  onFinish: (s: { score: number; accuracy: number; notes: number; bestStreak: number; barsCleared: number }) => void
}

function PlaySession({ level, engine, onQuit, onFinish }: PlayProps) {
  const [puzzleIdx, setPuzzleIdx] = useState(0)
  const [target, setTarget] = useState<Pattern>(() => genTarget(level))
  const [placed, setPlaced] = useState<Placed[]>([])
  const [phase, setPhase] = useState<'build' | 'graded'>('build')
  const [grade, setGrade] = useState<{ matched: number; total: number; equal: boolean } | null>(null)
  const [revealTarget, setRevealTarget] = useState(false)
  const [lives, setLives] = useState(START_LIVES)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const accRef = useRef({ matched: 0, total: 0, notes: 0 })
  const finishedRef = useRef(false)
  const drag = useBlockDrag()

  const totalBeats = level.bars * level.beatsPerBar
  const usedBeats = placed.reduce((s, p) => s + p.cell.beats, 0)
  const remaining = totalBeats - usedBeats

  const builtPattern: Pattern = useMemo(() => {
    const sorted = [...placed].sort((a, b) => a.startBeat - b.startBeat)
    return makePattern(
      sorted.map((p) => p.cell),
      level.beatsPerBar,
      level.beatUnit,
    )
  }, [placed, level.beatsPerBar, level.beatUnit])

  const reset = useCallback(() => {
    setPlaced([])
    setPhase('build')
    setGrade(null)
    setRevealTarget(false)
  }, [])

  const newPuzzle = useCallback(() => {
    setTarget(genTarget(level))
    reset()
  }, [level, reset])

  const listen = useCallback(() => {
    engine.preview(target, {
      bpm: level.bpm,
      countInBars: 1,
      beatsPerBar: level.beatsPerBar,
      metronomeThroughout: false,
    })
  }, [engine, target, level])

  // Auto-play the target shortly after a new puzzle appears.
  useEffect(() => {
    const t = setTimeout(() => listen(), 350)
    return () => {
      clearTimeout(t)
      engine.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleIdx])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1600)
  }

  const playBuilt = useCallback(() => {
    if (placed.length === 0) return
    engine.preview(builtPattern, {
      bpm: level.bpm,
      countInBars: 1,
      beatsPerBar: level.beatsPerBar,
    })
  }, [engine, builtPattern, level, placed.length])

  const onCheck = useCallback(() => {
    const cmp = comparePatterns(builtPattern, target)
    setGrade(cmp)
    setPhase('graded')
    setRevealTarget(true)
    engine.stop()

    const puzzleAcc = cmp.total > 0 ? cmp.matched / cmp.total : 0
    accRef.current.matched += cmp.matched
    accRef.current.total += cmp.total
    accRef.current.notes += onsetCount(builtPattern)

    const base = cmp.matched * 60
    const perfectBonus = cmp.equal ? 220 : 0
    const withStreak = Math.round((base + perfectBonus) * (1 + Math.min(streak, 8) * 0.06))
    setScore((s) => s + withStreak)

    if (cmp.equal) {
      const ns = streak + 1
      setStreak(ns)
      setBestStreak((b) => Math.max(b, ns))
      showToast(pick(['Perfect loop! 🎉', 'Nailed it! ✨', 'Flawless build! 🔥', 'Right on the beat! 🎯']))
    } else {
      setStreak(0)
      if (puzzleAcc >= 0.5) showToast(pick(['So close — nice work!', 'Almost there!', 'Good ear!']))
      else {
        setLives((l) => Math.max(0, l - 1))
        showToast(pick(['Keep listening — you got this!', 'Tricky one! Try the reveal.', 'Nice try!']))
      }
    }
  }, [builtPattern, target, engine, streak])

  const advance = useCallback(() => {
    const next = puzzleIdx + 1
    if (next >= PUZZLES_PER_LEVEL || lives <= 0) {
      if (finishedRef.current) return
      finishedRef.current = true
      const acc = accRef.current.total > 0 ? accRef.current.matched / accRef.current.total : 0
      onFinish({
        score: score + (lives > 0 ? lives * 50 : 0),
        accuracy: acc,
        notes: accRef.current.notes,
        bestStreak,
        barsCleared: next,
      })
      return
    }
    setPuzzleIdx(next)
    newPuzzle()
  }, [puzzleIdx, lives, score, bestStreak, onFinish, newPuzzle])

  // Append a cell to the build (used by both tap and drag-drop). Enforces budget.
  const addCell = useCallback(
    (cell: BeatCell) => {
      if (phase === 'graded') return
      if (cell.beats > totalBeats - usedBeats + 1e-6) {
        showToast("That block won't fit — not enough beats left!")
        return
      }
      setPlaced((prev) => {
        const used = prev.reduce((s, p) => s + p.cell.beats, 0)
        if (cell.beats > totalBeats - used + 1e-6) return prev
        return [...prev, { uid: UID++, cell, startBeat: used }]
      })
    },
    [phase, totalBeats, usedBeats],
  )

  const canCheck = Math.abs(remaining) < 1e-6 && placed.length > 0
  const isLastPuzzle = puzzleIdx + 1 >= PUZZLES_PER_LEVEL || lives <= 0

  return (
    <div className="bb__play">
      <div className="bb__playbar">
        <Button variant="ghost" size="sm" onClick={onQuit} icon="←">
          Quit
        </Button>
        <div className="bb__progress">
          {Array.from({ length: PUZZLES_PER_LEVEL }).map((_, i) => (
            <span key={i} className={`bb__pdot ${i < puzzleIdx ? 'is-done' : ''} ${i === puzzleIdx ? 'is-cur' : ''}`} />
          ))}
        </div>
        <div className="bb__playstats">
          <span className="bb__score">{score.toLocaleString()}</span>
          {streak > 1 && <span className="bb__streak">🔥 {streak}</span>}
          <span className="bb__lives" aria-label={`${lives} lives`}>
            {Array.from({ length: START_LIVES }).map((_, i) => (
              <span key={i} className={i < lives ? 'on' : 'off'}>
                ♥
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="bb__levelbanner">
        <strong>
          Stage {level.stage} · {level.title}
        </strong>
        <span>{level.subtitle}</span>
      </div>

      <div className="bb__listen">
        <Button accent="var(--bb)" onClick={listen} icon="▶">
          Listen to the loop
        </Button>
        <Button variant="outline" onClick={playBuilt} disabled={placed.length === 0} icon="🔁">
          Play my build
        </Button>
        <span className="bb__budget">
          Beats left: <strong className={remaining < 0 ? 'over' : ''}>{fmt(remaining)}</strong> / {totalBeats}
        </span>
      </div>

      <BeatGrid
        level={level}
        placed={placed}
        setPlaced={setPlaced}
        locked={phase === 'graded'}
        registerDrop={(el) => drag.register('grid', el, addCell)}
      />

      <Palette
        cells={level.palette}
        remaining={remaining}
        locked={phase === 'graded'}
        onAdd={addCell}
        drag={drag}
      />

      {drag.ghost}

      <div className="bb__actions">
        {phase === 'build' ? (
          <>
            <Button variant="ghost" onClick={() => setPlaced([])} disabled={placed.length === 0} icon="↺">
              Clear
            </Button>
            <Button accent="var(--bb)" size="lg" onClick={onCheck} disabled={!canCheck} icon="✓">
              Check it
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setRevealTarget((r) => !r)}>
              {revealTarget ? 'Hide answer' : 'Show answer'}
            </Button>
            <Button accent="var(--bb)" size="lg" onClick={advance} icon="→">
              {isLastPuzzle ? 'Finish' : 'Next loop'}
            </Button>
          </>
        )}
      </div>

      {phase === 'graded' && grade && (
        <Reveal
          grade={grade}
          target={target}
          built={builtPattern}
          showTarget={revealTarget}
          accent={meta.accent}
          onPlayTarget={listen}
          onPlayBuilt={playBuilt}
        />
      )}

      {toast && <div className="bb__toast">{toast}</div>}
    </div>
  )
}

// ── BEAT GRID (drop target) ─────────────────────────────────────────────────
function BeatGrid({
  level,
  placed,
  setPlaced,
  locked,
  registerDrop,
}: {
  level: BuilderLevel
  placed: Placed[]
  setPlaced: React.Dispatch<React.SetStateAction<Placed[]>>
  locked: boolean
  registerDrop: (el: HTMLElement | null) => void
}) {
  const totalBeats = level.bars * level.beatsPerBar
  const sorted = [...placed].sort((a, b) => a.startBeat - b.startBeat)
  const bars = level.bars

  return (
    <div className="bb__gridwrap" ref={(el) => registerDrop(locked ? null : el)}>
      {Array.from({ length: bars }).map((_, bar) => {
        const barStart = bar * level.beatsPerBar
        const barEnd = barStart + level.beatsPerBar
        const inBar = sorted.filter((p) => p.startBeat >= barStart - 1e-6 && p.startBeat < barEnd - 1e-6)
        return (
          <div className="bb__bar" key={bar}>
            <div className="bb__barlabel">{bar + 1}</div>
            <div className="bb__slots">
              {Array.from({ length: level.beatsPerBar }).map((_, b) => (
                <div className="bb__beatline" key={b} style={{ left: `${(b / level.beatsPerBar) * 100}%` }} />
              ))}
              {inBar.map((p) => {
                const left = ((p.startBeat - barStart) / level.beatsPerBar) * 100
                const w = (p.cell.beats / level.beatsPerBar) * 100
                return (
                  <div
                    key={p.uid}
                    className="bb__placed"
                    style={{ left: `${left}%`, width: `${w}%` }}
                    title={p.cell.name}
                  >
                    <BlockGlyph cell={p.cell} width={Math.max(40, w * 3)} />
                    <span className="bb__placedsyl">{p.cell.syllables.join('-') || 'rest'}</span>
                    {!locked && (
                      <button
                        className="bb__remove"
                        aria-label="remove block"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPlaced((prev) => prev.filter((x) => x.uid !== p.uid))
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
              {inBar.length === 0 && <div className="bb__emptyhint">tap blocks below ↓</div>}
            </div>
          </div>
        )
      })}
      <div className="bb__gridfoot">
        {totalBeats} beats · {level.beatsPerBar}/{level.beatUnit}
      </div>
    </div>
  )
}

// ── PALETTE (tappable / draggable source) ───────────────────────────────────
function Palette({
  cells,
  remaining,
  locked,
  onAdd,
  drag,
}: {
  cells: BeatCell[]
  remaining: number
  locked: boolean
  onAdd: (cell: BeatCell) => void
  drag: ReturnType<typeof useBlockDrag>
}) {
  return (
    <div className={`bb__palette ${locked ? 'is-locked' : ''}`}>
      {cells.map((cell) => {
        const fits = cell.beats <= remaining + 1e-6
        return (
          <button
            key={cell.id}
            className={`bb__block ${fits ? '' : 'is-toobig'}`}
            disabled={locked}
            onPointerDown={(e) => {
              if (!locked && fits) drag.startDrag(cell, e)
            }}
            onClick={() => {
              // Suppress the click that follows a real drag; allow plain taps.
              if (drag.consumedTap()) return
              onAdd(cell)
            }}
          >
            <BlockGlyph cell={cell} width={104} />
            <span className="bb__blocksyl">{cell.syllables.length ? cell.syllables.join('-') : 'rest'}</span>
            <span className="bb__blockbeats">
              {fmt(cell.beats)} {cell.beats === 1 ? 'beat' : 'beats'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── REVEAL ───────────────────────────────────────────────────────────────────
function Reveal({
  grade,
  target,
  built,
  showTarget,
  accent,
  onPlayTarget,
  onPlayBuilt,
}: {
  grade: { matched: number; total: number; equal: boolean }
  target: Pattern
  built: Pattern
  showTarget: boolean
  accent: string
  onPlayTarget: () => void
  onPlayBuilt: () => void
}) {
  const pct = grade.total > 0 ? Math.round((grade.matched / grade.total) * 100) : 0
  return (
    <div className={`bb__reveal ${grade.equal ? 'is-perfect' : ''}`}>
      <div className="bb__gradehead">
        {grade.equal ? (
          <span className="bb__gradeperfect">Perfect match!</span>
        ) : (
          <span className="bb__gradepartial">
            {grade.matched}/{grade.total} beats matched · {pct}%
          </span>
        )}
      </div>

      {showTarget && (
        <div className="bb__notationcard">
          <div className="bb__notlabel">Target rhythm</div>
          <Notation pattern={target} accent={accent} />
          <div className="bb__notbtns">
            <Button size="sm" variant="outline" onClick={onPlayTarget} icon="▶">
              Play target
            </Button>
          </div>
        </div>
      )}

      <div className="bb__notationcard bb__notationcard--mine">
        <div className="bb__notlabel">Your build</div>
        <Notation pattern={built} accent={grade.equal ? accent : '#fbbf24'} />
        <div className="bb__notbtns">
          <Button size="sm" variant="outline" onClick={onPlayBuilt} icon="🔁">
            Play mine
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── RESULTS ──────────────────────────────────────────────────────────────────
function Results({
  level,
  stats,
  outcome,
  onReplay,
  onNext,
  hasNext,
  onMenu,
}: {
  level: BuilderLevel
  stats: { score: number; accuracy: number; notes: number; mastered: boolean }
  outcome: RunOutcome
  onReplay: () => void
  onNext: () => void
  hasNext: boolean
  onMenu: () => void
}) {
  const pct = Math.round(stats.accuracy * 100)
  return (
    <div className="bb__results">
      <div className="bb__resultcard">
        <div className="bb__resulttop">
          <div className="bb__resulticon">{outcome.masteredNow ? '⭐' : stats.accuracy >= 0.8 ? '🎉' : '🎵'}</div>
          <h2 className="bb__resulttitle">
            {outcome.masteredNow ? 'Level Mastered!' : stats.accuracy >= 0.8 ? 'Great building!' : 'Loop complete'}
          </h2>
          <p className="bb__resultsub">
            Stage {level.stage} · {level.title}
          </p>
        </div>

        <div className="bb__resultstats">
          <Stat label="Score" value={stats.score.toLocaleString()} />
          <Stat label="Accuracy" value={`${pct}%`} />
          <Stat label="Notes" value={String(stats.notes)} />
        </div>

        <div className="bb__rewards">
          <span className="bb__reward">+{outcome.xpGained} XP</span>
          <span className="bb__reward bb__reward--gem">◆ +{outcome.gemsGained}</span>
          {outcome.newBest && <span className="bb__reward bb__reward--best">New best!</span>}
          {outcome.leveledUp && <span className="bb__reward bb__reward--rank">Rank up → {outcome.rank.name}!</span>}
          {outcome.unlockedLevel && <span className="bb__reward bb__reward--unlock">🔓 Next stage unlocked</span>}
        </div>

        {outcome.newAchievements.length > 0 && (
          <div className="bb__achs">
            {outcome.newAchievements.map((id) => (
              <span key={id} className="bb__ach">
                🏆 {id.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {!outcome.masteredNow && level.stage >= MASTERY_STAGE && (
          <p className="bb__masterhint">
            Master this stage: finish at {Math.round(MASTERY_ACCURACY * 100)}%+ with {MASTERY_MIN_NOTES}+ notes.
          </p>
        )}

        <div className="bb__resultbtns">
          <Button variant="ghost" onClick={onMenu}>
            Levels
          </Button>
          <Button variant="outline" onClick={onReplay} icon="↺">
            Replay
          </Button>
          {hasNext && (
            <Button accent="var(--bb)" onClick={onNext} icon="→">
              Next stage
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bb__statbox">
      <div className="bb__statval">{value}</div>
      <div className="bb__statlabel">{label}</div>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────
function genTarget(level: BuilderLevel): Pattern {
  let p = generatePattern(level.generator, {
    bars: level.bars,
    beatsPerBar: level.beatsPerBar,
    beatUnit: level.beatUnit,
  })
  let guard = 0
  while ((onsetCount(p) < 2 || Math.abs(patternBeats(p) - level.bars * level.beatsPerBar) > 0.01) && guard++ < 20) {
    p = generatePattern(level.generator, {
      bars: level.bars,
      beatsPerBar: level.beatsPerBar,
      beatUnit: level.beatUnit,
    })
  }
  return p
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
