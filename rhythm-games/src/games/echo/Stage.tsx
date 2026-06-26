// The two-character stage: YOU vs the opponent, trading fours. Each "claps" via
// an animation pulse triggered by a bumping `clapTick` prop.

import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Opponent character. */
  opponent: { name: string; emoji: string }
  /** Whose turn it is right now (drives highlight). */
  turn: 'opponent' | 'you' | 'none'
  /** Bump to make the opponent clap (during the CALL). */
  oppClapTick: number
  /** Bump to make YOU clap (during the RESPONSE). */
  youClapTick: number
}

function useClapFlash(tick: number) {
  const [on, setOn] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setOn(true)
    const id = window.setTimeout(() => setOn(false), 320)
    return () => window.clearTimeout(id)
  }, [tick])
  return on
}

export function Stage({ opponent, turn, oppClapTick, youClapTick }: Props) {
  const oppClap = useClapFlash(oppClapTick)
  const youClap = useClapFlash(youClapTick)

  return (
    <div className="echo-stage">
      <div
        className={`echo-char ${turn === 'opponent' ? 'is-turn' : ''} ${
          oppClap ? 'is-active' : ''
        } ${turn === 'you' ? 'is-dim' : ''}`}
      >
        <div className="echo-char__emoji" aria-hidden>
          {opponent.emoji}
        </div>
        <div className="echo-char__name">{opponent.name}</div>
      </div>

      <div className="echo-vs">VS</div>

      <div
        className={`echo-char ${turn === 'you' ? 'is-turn' : ''} ${youClap ? 'is-active' : ''} ${
          turn === 'opponent' ? 'is-dim' : ''
        }`}
      >
        <div className="echo-char__emoji" aria-hidden>
          🧑‍🎤
        </div>
        <div className="echo-char__name">You</div>
      </div>
    </div>
  )
}
