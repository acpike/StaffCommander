// Lookahead scheduler — the "Tale of Two Clocks" pattern (Chris Wilson /
// web.dev). See research/rhythm-racer.md §2.1.
//
// We keep a sorted queue of future events, each with an absolute audio-clock
// time and a callback that schedules its sound. A setTimeout loop wakes every
// `tickMs` (25ms) and fires any event whose time is within `aheadTime` (100ms)
// of the audio clock, so the audio thread plays it sample-accurately. The
// deliberate overlap (wake 25ms, schedule 100ms ahead) absorbs main-thread
// stalls.
//
// CRITICAL: callbacks here run AHEAD of audible time — they must only SCHEDULE
// audio (sound.* take a `when`), never trigger visuals. Visuals read the clock
// in their own rAF loop.

import { now } from './clock'

export interface ScheduledEvent {
  /** Absolute audio-clock time (seconds) at which the sound should play. */
  time: number
  /** Schedules the sound at `time`. Runs ~aheadTime before `time`. */
  play: (time: number) => void
  /** Optional opaque tag for debugging / filtering. */
  tag?: string
}

export interface SchedulerOptions {
  /** setTimeout interval (ms). Default 25. */
  tickMs?: number
  /** How far ahead to schedule (seconds). Default 0.1. */
  aheadTime?: number
}

export class Scheduler {
  private queue: ScheduledEvent[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly tickMs: number
  private readonly aheadTime: number

  constructor(opts: SchedulerOptions = {}) {
    this.tickMs = opts.tickMs ?? 25
    this.aheadTime = opts.aheadTime ?? 0.1
  }

  /** Queue events (absolute times). They're merged and kept time-sorted. */
  schedule(events: ScheduledEvent[]): void {
    this.queue.push(...events)
    this.queue.sort((a, b) => a.time - b.time)
    this.ensureRunning()
  }

  /** True while the loop is active. */
  get running(): boolean {
    return this.timer !== null
  }

  /** Number of events still waiting to be dispatched. */
  get pending(): number {
    return this.queue.length
  }

  private ensureRunning(): void {
    if (this.timer === null) this.tick()
  }

  private tick = (): void => {
    const horizon = now() + this.aheadTime
    // Queue is sorted; dispatch everything up to the horizon.
    while (this.queue.length > 0 && this.queue[0].time < horizon) {
      const ev = this.queue.shift()!
      // Guard against past-due events (e.g. after a stall) — clamp to "now".
      ev.play(Math.max(ev.time, now()))
    }
    if (this.queue.length > 0) {
      this.timer = setTimeout(this.tick, this.tickMs)
    } else {
      this.timer = null
    }
  }

  /** Stop the loop and drop all pending events. */
  clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.queue = []
  }
}
