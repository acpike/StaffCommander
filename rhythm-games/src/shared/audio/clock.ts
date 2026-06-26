// AudioContext singleton — THE clock for the whole suite.
//
// Per research/rhythm-racer.md §2: `AudioContext.currentTime` is the only
// trustworthy clock. It is sample-accurate and runs on the audio hardware
// thread, immune to main-thread jank, GC, and layout. Everything (audio
// scheduling, visual rendering, input judging) must read from this one clock.
//
// Browser autoplay policy: an AudioContext starts 'suspended' and can only be
// resumed inside a user gesture. Call `resumeAudio()` from a click/keydown/tap
// before any playback.

let ctx: AudioContext | null = null
let master: GainNode | null = null

/** Get (lazily creating) the shared AudioContext. */
export function getAudioContext(): AudioContext {
  if (!ctx) {
    // latencyHint 'interactive' → lowest non-glitching latency, correct for games.
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor({ latencyHint: 'interactive' })
  }
  return ctx
}

/** A shared master gain node — route all SFX/notes through this for one volume. */
export function getMaster(): GainNode {
  const c = getAudioContext()
  if (!master) {
    master = c.createGain()
    master.gain.value = 0.9
    master.connect(c.destination)
  }
  return master
}

/** Set master output volume (0..1). */
export function setMasterVolume(v: number): void {
  const c = getAudioContext()
  getMaster().gain.setTargetAtTime(Math.max(0, Math.min(1, v)), c.currentTime, 0.01)
}

/**
 * Resume the context. MUST be called from inside a user gesture handler the
 * first time (autoplay policy). Safe to call repeatedly; returns once running.
 */
export async function resumeAudio(): Promise<void> {
  const c = getAudioContext()
  getMaster()
  if (c.state === 'suspended') {
    try {
      await c.resume()
    } catch {
      /* ignore — will retry on next gesture */
    }
  }
}

/** The current audio-clock time, in seconds. The source of truth for timing. */
export function now(): number {
  return getAudioContext().currentTime
}

/**
 * Best-effort output latency (seconds) the browser knows about. Does NOT
 * include speaker air-gap, display, or input latency — those need a calibration
 * step (not built in the foundation; games may add one later). Used to seed a
 * sensible default audio offset.
 */
export function outputLatency(): number {
  const c = getAudioContext()
  const ol = (c as AudioContext & { outputLatency?: number }).outputLatency
  if (typeof ol === 'number' && ol > 0) return ol
  if (typeof c.baseLatency === 'number') return c.baseLatency
  return 0
}

export function isRunning(): boolean {
  return !!ctx && ctx.state === 'running'
}
