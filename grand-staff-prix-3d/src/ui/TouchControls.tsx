import { useRef, useState } from 'react'
import { input } from '../game/input'

const IS_TOUCH =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

const RANGE = 78 // px of thumb drag for full lock

// On-screen driving controls for touch devices: a steering pad (bottom-left,
// slide the thumb left/right) and a throttle button (bottom-right, hold to boost).
export function TouchControls() {
  const startX = useRef(0)
  const pid = useRef<number | null>(null)
  const [knob, setKnob] = useState(0)

  if (!IS_TOUCH) return null

  const onDown = (e: React.PointerEvent) => {
    pid.current = e.pointerId
    startX.current = e.clientX
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (pid.current !== e.pointerId) return
    const v = Math.max(-1, Math.min(1, (e.clientX - startX.current) / RANGE))
    input.setPadSteer(v)
    setKnob(v)
  }
  const onUp = (e: React.PointerEvent) => {
    if (pid.current !== e.pointerId) return
    pid.current = null
    input.setPadSteer(0)
    setKnob(0)
  }

  return (
    <div className="touchCtl">
      <div
        className="steerPad"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="steerTrack" />
        <div className="steerKnob" style={{ transform: `translate(calc(-50% + ${knob * 46}px), -50%)` }} />
        <div className="padHint">◄ STEER ►</div>
      </div>
      <button
        className="throttleBtn"
        aria-label="Throttle"
        onPointerDown={(e) => {
          ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
          input.setThrottle(true)
        }}
        onPointerUp={() => input.setThrottle(false)}
        onPointerCancel={() => input.setThrottle(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        GO
      </button>
    </div>
  )
}
