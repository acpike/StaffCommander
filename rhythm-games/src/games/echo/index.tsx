// ECHO — call-and-response clap-back (zero notation). The most physical of the
// three games: hear a rhythm, tap it back on one big pad. Two modes — Beat Battle
// (level ladder vs opponents, lives + combos + mastery) and Rhythm Simon (memory
// ladder; the sequence grows each round). All timing flows through the shared
// RhythmEngine: the CALL uses engine.preview (audible, no judging), the RESPONSE
// uses engine.playPattern with playPattern:false + metronomeThroughout (silent
// targets + a click while the player taps the remembered rhythm). recordRun on
// finish drives the celebratory results screen.

import { useCallback, useState } from 'react'
import type { GameMeta, GameProps } from '../../shared/gameModule'
import { Button } from '../../shared/ui'
import { Menu, LevelSelect } from './Menu'
import { Battle } from './Battle'
import { Simon } from './Simon'
import { levelById, type EchoLevel } from './levels'
import './echo.css'

export const meta: GameMeta = {
  id: 'echo',
  title: 'Echo',
  tagline: 'Hear the beat, clap it back. Trade fours in a rhythm battle.',
  description:
    'A drummer plays a rhythm — you tap it back on one big pad. The pattern grows each round (Rhythm Simon) until you break. Pure production: no notation needed.',
  accent: '#f472b6',
  accent2: '#fb923c',
  icon: '🥁',
}

type Route =
  | { name: 'menu' }
  | { name: 'levelselect' }
  | { name: 'battle'; level: EchoLevel }
  | { name: 'simon' }

export default function Echo({ onExit }: GameProps) {
  const [route, setRoute] = useState<Route>({ name: 'menu' })

  const goMenu = useCallback(() => setRoute({ name: 'menu' }), [])
  const goLevels = useCallback(() => setRoute({ name: 'levelselect' }), [])

  const nextLevelOf = useCallback((level: EchoLevel) => {
    if (!level.unlockNext) return undefined
    const next = levelById(level.unlockNext)
    if (!next) return undefined
    return () => setRoute({ name: 'battle', level: next })
  }, [])

  return (
    <div className="echo-root">
      <div className="echo-top">
        <Button
          className="echo-back"
          variant="ghost"
          size="sm"
          onClick={route.name === 'menu' ? onExit : goMenu}
        >
          {route.name === 'menu' ? '← Exit' : '← Echo'}
        </Button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="echo-body">
        {route.name === 'menu' && (
          <Menu onBattle={goLevels} onSimon={() => setRoute({ name: 'simon' })} />
        )}

        {route.name === 'levelselect' && (
          <LevelSelect onBack={goMenu} onPick={(level) => setRoute({ name: 'battle', level })} />
        )}

        {route.name === 'battle' && (
          <Battle
            key={route.level.id}
            level={route.level}
            onExit={goLevels}
            onNextLevel={nextLevelOf(route.level)}
          />
        )}

        {route.name === 'simon' && <Simon key="simon" onExit={goMenu} />}
      </div>
    </div>
  )
}
