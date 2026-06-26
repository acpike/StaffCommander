// Shared "coming soon" scaffold for the 3 game stubs. It wires the game into the
// shared HUD + engine so it compiles and demonstrates the contract the real game
// agents will build against: it resumes the audio engine on a gesture, plays a
// short demo pattern through the shared engine, shows live judging ratings, and
// reads the active profile's XP/gems via the shared HUD.
//
// Game agents: REPLACE this with your real game. Keep `meta` and the default
// export shape (a component taking GameProps). See shared/gameModule.ts.

import { useEffect, useRef, useState } from 'react'
import type { GameMeta, GameProps } from '../shared/gameModule'
import { useStore, activeProfile } from '../shared/store'
import { useRhythmEngine } from '../shared/audio/useRhythmEngine'
import { pattern, CELLS, type Pattern } from '../shared/audio/patterns'
import { tightenWindows, type Rating } from '../shared/audio/engine'
import { Button, Hud, RatingPopup } from '../shared/ui'
import './ComingSoon.css'

interface Props extends GameProps {
  meta: GameMeta
  /** A demo pattern unique to each stub, to show the engine works. */
  demo: Pattern
  /** What the real game will be (shown as a teaser list). */
  teaser: string[]
}

export function ComingSoon({ meta, demo, teaser, onExit }: Props) {
  const profile = useStore(activeProfile)
  const engine = useRhythmEngine()
  const [phase, setPhase] = useState<'idle' | 'playing'>('idle')
  const [rating, setRating] = useState<Rating | null>(null)
  const [err, setErr] = useState(0)
  const tickRef = useRef(0)
  const [tick, setTick] = useState(0)
  const [hits, setHits] = useState({ perfect: 0, great: 0, good: 0, miss: 0 })

  useEffect(() => {
    const off = engine.onTap(({ rating, error_ms }) => {
      setRating(rating)
      setErr(error_ms)
      tickRef.current += 1
      setTick(tickRef.current)
      setHits((h) => ({ ...h, [rating]: h[rating] + 1 }))
    })
    return off
  }, [engine])

  // Judge taps off the audio clock (Space / tap on the pad).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && phase === 'playing') {
        e.preventDefault()
        engine.judgeTap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine, phase])

  const start = async () => {
    await engine.resume()
    engine.setWindows(tightenWindows(0))
    setHits({ perfect: 0, great: 0, good: 0, miss: 0 })
    setPhase('playing')
    engine.playPattern(demo, {
      bpm: 88,
      countInBars: 1,
      metronomeThroughout: true,
      onComplete: () => setPhase('idle'),
    })
  }

  const tap = () => {
    if (phase === 'playing') engine.judgeTap()
  }

  return (
    <div
      className="rg-cs"
      style={
        {
          '--accent': meta.accent,
          '--accent2': meta.accent2 ?? meta.accent,
        } as React.CSSProperties
      }
    >
      <div className="rg-cs__top">
        <Button variant="ghost" size="sm" onClick={onExit} icon={<span>←</span>}>
          Menu
        </Button>
        {profile && <Hud name={profile.name} xp={profile.xp} gems={profile.gems} accent={meta.accent} compact />}
      </div>

      <div className="rg-cs__stage">
        <div className="rg-cs__badge">{meta.icon}</div>
        <h1 className="rg-cs__title">{meta.title}</h1>
        <p className="rg-cs__tag">{meta.tagline}</p>
        <span className="rg-cs__soon">Coming soon</span>

        <ul className="rg-cs__teaser">
          {teaser.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <div className="rg-cs__demo">
          <p className="rg-cs__demohint">
            The shared rhythm engine is live. Press <kbd>Play demo</kbd>, then tap{' '}
            <kbd>Space</kbd> or the pad in time with the claps.
          </p>
          <button
            className={`rg-cs__pad ${phase === 'playing' ? 'is-live' : ''}`}
            onPointerDown={tap}
            disabled={phase !== 'playing'}
          >
            <RatingPopup rating={rating} error_ms={err} tick={tick} />
            <span className="rg-cs__padlabel">{phase === 'playing' ? 'TAP!' : 'Press Play'}</span>
          </button>
          <div className="rg-cs__controls">
            <Button onClick={start} disabled={phase === 'playing'} accent={meta.accent}>
              {phase === 'playing' ? 'Listening…' : 'Play demo'}
            </Button>
          </div>
          <div className="rg-cs__counts">
            <span style={{ color: 'var(--perfect)' }}>Perfect {hits.perfect}</span>
            <span style={{ color: 'var(--great)' }}>Great {hits.great}</span>
            <span style={{ color: 'var(--good)' }}>Good {hits.good}</span>
            <span style={{ color: 'var(--miss)' }}>Miss {hits.miss}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Shared demo patterns so each stub feels distinct. */
export const DEMO_PATTERNS = {
  echo: pattern([CELLS.quarter, CELLS.twoEighths, CELLS.quarter, CELLS.half]),
  detective: pattern([CELLS.twoEighths, CELLS.quarter, CELLS.eighthAndRest, CELLS.half]),
  builder: pattern([CELLS.quarter, CELLS.quarter, CELLS.twoEighths, CELLS.quarter]),
}
