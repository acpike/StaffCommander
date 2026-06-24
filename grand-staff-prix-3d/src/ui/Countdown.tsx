import { useEffect, useState } from 'react'
import { useGame } from '../state/store'
import { audio } from '../audio/sound'

const SEQ = ['3', '2', '1', 'GO!']

export function Countdown() {
  const beginPlay = useGame((s) => s.beginPlay)
  const [i, setI] = useState(0)

  useEffect(() => {
    let idx = 0
    audio.countBeep(false)
    const timers: number[] = []
    const tick = () => {
      idx += 1
      if (idx < SEQ.length) {
        setI(idx)
        audio.countBeep(idx === SEQ.length - 1)
        timers.push(window.setTimeout(tick, idx === SEQ.length - 1 ? 600 : 750))
      } else {
        beginPlay()
      }
    }
    timers.push(window.setTimeout(tick, 750))
    return () => timers.forEach(clearTimeout)
  }, [beginPlay])

  return (
    <div className="countdown">
      <div className="big" key={i}>
        {SEQ[i]}
      </div>
    </div>
  )
}
