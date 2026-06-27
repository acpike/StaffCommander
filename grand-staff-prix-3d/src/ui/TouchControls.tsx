import { useRef, useState } from 'react'
import { input } from '../game/input'
import { useGame } from '../state/store'

const IS_TOUCH =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

const RANGE = 80 // px of thumb drag for full lock
const MAX_TURN = 42 // deg the wheel rotates at full lock

// controls tint to the current circuit's accent (mirrors the menu's TILE_ACCENT)
const ACCENT: Record<string, string> = {
  mountain: '#00e5c4', city: '#ffc23d', desert: '#ff8a3d', candy: '#ff6fb0', space: '#8b7bff',
}

// ───────── steering wheel art (rotated by the parent) — default F1, themed Space + Candy ─────────
function WheelArt({ theme }: { theme: string }) {
  if (theme === 'space') {
    return (
      <svg className="wheelSvg" viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="74" fill="none" stroke="#1a1530" strokeWidth="20" />
        <circle cx="100" cy="100" r="74" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="3 12" opacity=".9" />
        <path d="M22,84 a14,14 0 0,0 0,32" fill="#221a3a" stroke="var(--accent)" strokeWidth="1.8" />
        <path d="M178,84 a14,14 0 0,1 0,32" fill="#221a3a" stroke="var(--accent)" strokeWidth="1.8" />
        <path d="M100,74 L122,87 L122,113 L100,126 L78,113 L78,87 Z" fill="#0e0b1c" stroke="var(--accent)" strokeWidth="2" />
        <path d="M100,84 L113,92 L113,108 L100,116 L87,108 L87,92 Z" fill="none" stroke="var(--accent)" strokeWidth="1.4" opacity=".6" />
        <circle cx="100" cy="100" r="6" fill="var(--accent)" />
      </svg>
    )
  }
  if (theme === 'candy') {
    return (
      <svg className="wheelSvg" viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="74" fill="none" stroke="#2a1822" strokeWidth="22" />
        <circle cx="100" cy="100" r="74" fill="none" stroke="#fff" strokeWidth="22" strokeDasharray="20 20" opacity=".9" />
        <circle cx="100" cy="100" r="74" fill="none" stroke="var(--accent)" strokeWidth="22" strokeDasharray="20 20" strokeDashoffset="20" opacity=".9" />
        <circle cx="100" cy="100" r="30" fill="#fff" />
        <path d="M100 78 a22 22 0 1 1 -15.5 6.4 a14 14 0 1 0 9.9 -4.1" fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" />
        <circle cx="100" cy="100" r="5" fill="var(--accent)" />
      </svg>
    )
  }
  // default — F1 racing wheel (flat top, grips, hub + shift LEDs)
  return (
    <svg className="wheelSvg" viewBox="0 0 200 200" aria-hidden>
      <path d="M45,49 L155,49 A75,75 0 1,1 45,49 Z" fill="none" stroke="#161d26" strokeWidth="24" />
      <path d="M45,49 L155,49 A75,75 0 1,1 45,49 Z" fill="none" stroke="var(--accent)" strokeWidth="2.5" opacity=".85" />
      <rect x="20" y="90" width="20" height="34" rx="9" fill="#1f2933" stroke="var(--accent)" strokeWidth="1.5" opacity=".9" />
      <rect x="160" y="90" width="20" height="34" rx="9" fill="#1f2933" stroke="var(--accent)" strokeWidth="1.5" opacity=".9" />
      <path d="M100,100 L60,106 M100,100 L140,106 M100,100 L100,146" stroke="#1f2933" strokeWidth="12" strokeLinecap="round" />
      <circle cx="100" cy="100" r="27" fill="#0d1218" stroke="#2a3340" strokeWidth="2" />
      <circle cx="100" cy="100" r="27" fill="none" stroke="var(--accent)" strokeWidth="2" opacity=".7" />
      <circle cx="88" cy="92" r="2.4" fill="var(--accent)" /><circle cx="100" cy="90" r="2.4" fill="var(--accent)" /><circle cx="112" cy="92" r="2.4" fill="var(--accent)" />
      <circle cx="100" cy="104" r="7" fill="var(--accent)" />
    </svg>
  )
}

// ───────── throttle centre motif (animates while held) — default chevrons, Space rocket, Candy star ─────────
function ThrottleArt({ theme }: { theme: string }) {
  if (theme === 'space') {
    return (
      <svg className="throttleArt rocket" viewBox="0 0 32 38" aria-hidden>
        <path className="flame" d="M12 25 Q16 38 20 25 Z" fill="#ffb23d" />
        <path d="M16 3 C22 9 21 19 19 25 H13 C11 19 10 9 16 3 Z" fill="currentColor" />
        <circle cx="16" cy="13" r="2.4" fill="#0a0e12" />
        <path d="M13 23 L8 29 L13 27 Z M19 23 L24 29 L19 27 Z" fill="currentColor" opacity=".8" />
      </svg>
    )
  }
  if (theme === 'candy') {
    return (
      <svg className="throttleArt star" viewBox="0 0 34 34" aria-hidden>
        <path d="M17 3 l3.7 7.4 8.1 1 -5.9 5.6 1.5 8.1 -7.4 -4 -7.4 4 1.5 -8.1 -5.9 -5.6 8.1 -1 Z" fill="currentColor" />
      </svg>
    )
  }
  // default — speed chevrons flowing upward
  return (
    <svg className="throttleChevs" viewBox="0 0 24 30" aria-hidden>
      <path className="ch ch1" d="M5 11l7-6 7 6" fill="none" stroke="currentColor" />
      <path className="ch ch2" d="M5 18l7-6 7 6" fill="none" stroke="currentColor" />
      <path className="ch ch3" d="M5 25l7-6 7 6" fill="none" stroke="currentColor" />
    </svg>
  )
}

// On-screen driving controls for touch devices: a rotating steering wheel (bottom-left,
// slide the thumb) and a GO throttle button (bottom-right, hold). Both tint + swap art per circuit.
export function TouchControls() {
  const startX = useRef(0)
  const pid = useRef<number | null>(null)
  const [knob, setKnob] = useState(0)
  const [boost, setBoost] = useState(false)
  const themeId = useGame((s) => s.settings.themeId)
  const accent = ACCENT[themeId] ?? '#00e5c4'

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
        className="steerWheel"
        style={{ ['--accent' as string]: accent }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="wheelSpin" style={{ transform: `rotate(${knob * MAX_TURN}deg)` }}>
          <WheelArt theme={themeId} />
        </div>
      </div>
      <button
        className={`throttleBtn${boost ? ' on' : ''}`}
        aria-label="Throttle"
        style={{ ['--accent' as string]: accent }}
        onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); input.setThrottle(true); setBoost(true) }}
        onPointerUp={() => { input.setThrottle(false); setBoost(false) }}
        onPointerCancel={() => { input.setThrottle(false); setBoost(false) }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg className="revRing" viewBox="0 0 100 100" aria-hidden>
          <circle className="revTrack" cx="50" cy="50" r="45" />
          <circle className="revFill" cx="50" cy="50" r="45" />
        </svg>
        <ThrottleArt theme={themeId} />
        <span className="throttleGo">GO</span>
      </button>
    </div>
  )
}
