import { useRef, useState } from 'react'
import { input } from '../game/input'

const IS_TOUCH =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

const RANGE = 78 // px of thumb drag for full lock

// On-screen driving controls for touch devices: a frosted steering pad
// (bottom-left, slide the thumb) and a throttle button (bottom-right, hold).
export function TouchControls() {
  const startX = useRef(0)
  const pid = useRef<number | null>(null)
  const [knob, setKnob] = useState(0)
  const [boost, setBoost] = useState(false)

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

  const Chevron = ({ dir }: { dir: 'l' | 'r' }) => (
    <svg viewBox="0 0 24 24" className={`steerChev ${dir}${(dir === 'l' ? knob < -0.06 : knob > 0.06) ? ' on' : ''}`}>
      <path d={dir === 'l' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  return (
    <div className="touchCtl">
      <div className="steerPad" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <Chevron dir="l" />
        <div className="steerKnob" style={{ transform: `translate(calc(-50% + ${knob * 46}px), -50%)` }} />
        <Chevron dir="r" />
      </div>
      <button
        className={`throttleBtn${boost ? ' on' : ''}`}
        aria-label="Throttle"
        onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); input.setThrottle(true); setBoost(true) }}
        onPointerUp={() => { input.setThrottle(false); setBoost(false) }}
        onPointerCancel={() => { input.setThrottle(false); setBoost(false) }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg viewBox="0 0 24 24" className="throttleIcon">
          <path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 19l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        </svg>
      </button>
    </div>
  )
}
