// The big tactile tap pad. Listens (when armed) for Space / pointerdown and calls
// onTap synchronously so the parent can judge against the engine in the same
// gesture. Emits ripples and a press-scale for juice. During the count-in it can
// display a big pulsing number instead of the label.
//
// HOLD support (ECHO-LEVEL-SYSTEM.md §5): when a level has hold notes the parent
// passes `onPress` (note-ON) + `onRelease` (note-OFF) instead of just `onTap`.
// `onPress` returns whether the attacked note must be HELD and for how long; if
// so, the pad raises a HOLD-METER that fills toward the target while pressed, and
// reports the release on pointerup / pointercancel / keyup. Tap-only play (and
// the Simon mode, which passes only `onTap`) is unchanged: no press/release, no
// meter, identical behaviour.

import { useCallback, useEffect, useRef, useState } from 'react'

const RATING_COLOR: Record<string, string> = {
  perfect: 'var(--perfect)',
  great: 'var(--great)',
  good: 'var(--good)',
  miss: 'var(--miss)',
}

interface Ripple {
  id: number
  color: string
}

/** What `onPress` tells the pad about the note it just attacked. */
export interface PressResult {
  /** Rating to color the ripple (perfect/great/good/miss), or null. */
  rating: string | null
  /** Expected hold duration in seconds; > 0 ⇒ raise the hold-meter. */
  holdSec: number
}

interface Props {
  /** When true the pad accepts taps (the RESPONSE phase). */
  armed: boolean
  /** When false the pad is shown but visibly inert (CALL / gap). */
  disabled?: boolean
  /** Big label lines for the idle/listen states. */
  bigLabel: string
  hint?: string
  /** A count-in number to show (1..n) instead of the label, or null. */
  count?: number | null
  /**
   * Tap-only callback (note-on, fire-and-forget). Used by tap-only modes (Simon).
   * Return the rating to color the ripple, or null. Kept for backward-compat.
   */
  onTap?: () => string | null
  /**
   * Note-ON callback for HOLD-aware play. If provided it is used instead of
   * `onTap`. Return a PressResult: the rating + the expected hold duration. A
   * positive `holdSec` raises the hold-meter and arms release reporting.
   */
  onPress?: () => PressResult | null
  /** Note-OFF callback — fired on release of a held note. */
  onRelease?: () => void
}

export function TapPad({ armed, disabled, bigLabel, hint, count, onTap, onPress, onRelease }: Props) {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [hit, setHit] = useState(false)
  // Hold-meter: 0..1 fill while a held note is pressed, plus whether we're holding.
  const [holding, setHolding] = useState(false)
  const [holdFill, setHoldFill] = useState(0)
  /** 'short' until the green zone, 'good' once full enough to release cleanly. */
  const [holdZone, setHoldZone] = useState<'short' | 'good'>('short')

  const idRef = useRef(0)
  const hitTimer = useRef<number | null>(null)
  // Active-hold bookkeeping (refs: never re-render from the rAF fill loop).
  const holdingRef = useRef(false)
  const holdStartRef = useRef(0)
  const holdSecRef = useRef(0)
  const holdRafRef = useRef<number | null>(null)
  const pressedRef = useRef(false) // a press is currently down (gesture open)

  const stopHoldRaf = useCallback(() => {
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current)
      holdRafRef.current = null
    }
  }, [])

  const ripple = useCallback((rating: string | null) => {
    const color = rating ? RATING_COLOR[rating] ?? 'var(--ec)' : 'var(--ec)'
    const id = idRef.current++
    setRipples((rs) => [...rs, { id, color }])
    window.setTimeout(() => setRipples((rs) => rs.filter((r) => r.id !== id)), 580)
    setHit(true)
    if (hitTimer.current) window.clearTimeout(hitTimer.current)
    hitTimer.current = window.setTimeout(() => setHit(false), 110)
  }, [])

  // Drive the hold-meter fill while a held note is pressed.
  const runHoldMeter = useCallback(() => {
    const tick = () => {
      if (!holdingRef.current) return
      const elapsed = (performance.now() - holdStartRef.current) / 1000
      const target = holdSecRef.current || 0.0001
      const fill = Math.min(1, elapsed / target)
      setHoldFill(fill)
      // The "green" release zone opens a little before the full duration so a
      // tiny-early release still reads clean (the engine has its own tolerance).
      setHoldZone(fill >= 0.82 ? 'good' : 'short')
      holdRafRef.current = requestAnimationFrame(tick)
    }
    stopHoldRaf()
    holdRafRef.current = requestAnimationFrame(tick)
  }, [stopHoldRaf])

  const endHold = useCallback(() => {
    holdingRef.current = false
    stopHoldRaf()
    setHolding(false)
    setHoldFill(0)
    setHoldZone('short')
  }, [stopHoldRaf])

  // ── note-ON ──
  const press = useCallback(() => {
    if (!armed || pressedRef.current) return
    pressedRef.current = true
    if (onPress) {
      const res = onPress()
      ripple(res?.rating ?? null)
      if (res && res.holdSec > 0) {
        holdingRef.current = true
        holdStartRef.current = performance.now()
        holdSecRef.current = res.holdSec
        setHolding(true)
        setHoldFill(0)
        setHoldZone('short')
        runHoldMeter()
      }
    } else {
      ripple(onTap ? onTap() : null)
    }
  }, [armed, onPress, onTap, ripple, runHoldMeter])

  // ── note-OFF ──
  const release = useCallback(() => {
    if (!pressedRef.current) return
    pressedRef.current = false
    if (holdingRef.current) {
      onRelease?.()
      endHold()
    }
  }, [onRelease, endHold])

  // Keyboard: Space / Enter = note-on (keydown) + note-off (keyup). Held-key
  // auto-repeat keydowns are ignored so a hold reads as ONE sustained press.
  useEffect(() => {
    if (!armed) return
    const isPadKey = (e: KeyboardEvent) => e.code === 'Space' || e.code === 'Enter'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (isPadKey(e)) {
        e.preventDefault()
        press()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (isPadKey(e)) {
        e.preventDefault()
        release()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [armed, press, release])

  // If the pad disarms mid-hold (round/phase change), close the gesture cleanly.
  useEffect(() => {
    if (!armed && pressedRef.current) {
      pressedRef.current = false
      if (holdingRef.current) {
        onRelease?.()
        endHold()
      }
    }
  }, [armed, onRelease, endHold])

  useEffect(() => {
    return () => {
      if (hitTimer.current) window.clearTimeout(hitTimer.current)
      stopHoldRaf()
    }
  }, [stopHoldRaf])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      // Capture so a release outside the pad still reports the note-off.
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        /* setPointerCapture can throw if the pointer is already gone; ignore. */
      }
      press()
    },
    [press],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      release()
    },
    [release],
  )

  return (
    <div
      className={`echo-pad ${armed ? 'is-armed' : ''} ${disabled && !armed ? 'is-disabled' : ''} ${
        hit ? 'is-hit' : ''
      } ${holding ? 'is-holding' : ''}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="button"
      aria-label={armed ? 'Tap the rhythm back' : bigLabel}
      tabIndex={-1}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="echo-ripple"
          style={{ ['--rcolor' as string]: r.color }}
        />
      ))}

      {holding && (
        <div className="echo-hold" data-zone={holdZone} aria-hidden>
          <div className="echo-hold__fill" style={{ height: `${holdFill * 100}%` }} />
          <div className="echo-hold__target" />
        </div>
      )}

      <div className="echo-pad__label">
        {count != null ? (
          <div className="echo-pad__count" key={count}>
            {count}
          </div>
        ) : (
          <>
            <div className="echo-pad__big">{holding ? 'HOLD…' : bigLabel}</div>
            {hint && <div className="echo-pad__hint">{hint}</div>}
          </>
        )}
      </div>
    </div>
  )
}
