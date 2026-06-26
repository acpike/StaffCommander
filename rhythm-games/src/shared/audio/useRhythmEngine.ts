// React-safe wrapper around RhythmEngine. The engine (AudioContext, scheduler,
// rAF) lives in a ref — never in React state — so per-frame work never triggers
// re-renders. One engine instance per mount; disposed on unmount.
//
// Usage in a game component:
//
//   const engine = useRhythmEngine()
//   // on a "Start" button (user gesture):
//   await engine.resume()
//   engine.setWindows(tightenWindows(level.difficulty))
//   engine.playPattern(pattern, { bpm: 90, countInBars: 1, onComplete })
//   // wire taps:
//   useEffect(() => engine.onTap(({ rating, error_ms }) => { ... }), [engine])
//   // in your own rAF render loop: const t = engine.songTime()
//   // on a keydown/pointerdown handler (synchronous): const j = engine.judgeTap()

import { useEffect, useRef } from 'react'
import { RhythmEngine } from './engine'

/** Returns a stable RhythmEngine for the component's lifetime. */
export function useRhythmEngine(): RhythmEngine {
  const ref = useRef<RhythmEngine | null>(null)
  if (ref.current === null) ref.current = new RhythmEngine()
  useEffect(() => {
    const engine = ref.current!
    return () => engine.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ref.current
}
