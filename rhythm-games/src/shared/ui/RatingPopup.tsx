import { useEffect, useState } from 'react'
import type { Rating } from '../audio/engine'
import './RatingPopup.css'

interface Props {
  /** The judgement to show. Pass a new object (or bump `tick`) to re-trigger. */
  rating: Rating | null
  /** Signed timing error (ms): negative early, positive late. */
  error_ms?: number
  /** Monotonic counter — change it to re-fire the popup for the same rating. */
  tick: number
}

const LABEL: Record<Rating, string> = {
  perfect: 'Perfect',
  great: 'Great',
  good: 'Good',
  miss: 'Miss',
}

const ENCOURAGE: Record<Rating, string[]> = {
  perfect: ['Dead on!', 'Locked in!', 'Flawless!', 'In the pocket!'],
  great: ['So close!', 'Nice!', 'Almost perfect!'],
  good: ['Keep going!', 'Got it!', 'Feel the pulse.'],
  miss: ['Shake it off!', 'Next one!', 'You got this.'],
}

/** Floating Perfect/Great/Good/Miss popup with early/late tint + encouragement. */
export function RatingPopup({ rating, error_ms = 0, tick }: Props) {
  const [shown, setShown] = useState<{ rating: Rating; error_ms: number; key: number } | null>(null)

  useEffect(() => {
    if (!rating) return
    setShown({ rating, error_ms, key: tick })
    const id = setTimeout(() => setShown(null), 850)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  if (!shown) return null
  const { rating: r, error_ms: err } = shown
  const dir = r === 'miss' || Math.abs(err) < 8 ? null : err < 0 ? 'early' : 'late'
  const encourage = ENCOURAGE[r][shown.key % ENCOURAGE[r].length]

  return (
    <div className="rg-rating" key={shown.key} data-rating={r}>
      <div className="rg-rating__label">{LABEL[r]}</div>
      {dir && (
        <div className={`rg-rating__dir rg-rating__dir--${dir}`}>
          {dir === 'early' ? '◀ early' : 'late ▶'}
          <span className="rg-rating__ms">{Math.abs(Math.round(err))}ms</span>
        </div>
      )}
      <div className="rg-rating__msg">{encourage}</div>
    </div>
  )
}
