// High-level rhythm engine — the API the 3 games implement against.
//
// Responsibilities:
//  - own the AudioContext (via clock.ts), scheduler, and a rAF "song clock"
//    OUTSIDE React state (refs/singletons), per research §2.5.
//  - play a Pattern (clap/hit sounds) with an optional metronome count-in,
//    scheduled sample-accurately on the audio clock.
//  - judge a tap (keydown/pointerdown) against the pattern's onset times using
//    tunable Perfect/Great/Good/Miss windows with an early/late sign.
//  - expose the live `songTime` (seconds since pattern start, audio-clock based)
//    for the game's own rAF render loop.
//
// React rules: nothing here lives in React state. A thin `useRhythmEngine()`
// hook (engineHook.ts → re-exported) owns a single engine instance per mount.

import { now, resumeAudio, outputLatency } from './clock'
import { Scheduler, type ScheduledEvent } from './scheduler'
import { sound } from './sound'
import { beatsToSeconds, onsets, type NoteEvent, type Pattern } from './patterns'

export type Rating = 'perfect' | 'great' | 'good' | 'miss'

/**
 * Outcome of releasing a held note (ECHO-LEVEL-SYSTEM.md §5). NOT a harsh miss:
 *  - 'good'    — released inside the green duration window (held long enough).
 *  - 'short'   — released too early ("hold longer"); a gentle cue, not a miss.
 *  - 'long'    — released too late ("hold shorter"); a gentle cue, not a miss.
 * A hold whose ATTACK never landed reports its attack rating separately (the
 * attack is judged exactly like a tap); the release only grades the duration.
 */
export type HoldRelease = 'good' | 'short' | 'long'

/** Symmetric +/- judging windows in milliseconds. Tighten by level. */
export interface JudgeWindows {
  perfect: number
  great: number
  good: number
}

/** Beginner-generous defaults (research §2.4). Tighten via `tightenWindows`. */
export const DEFAULT_WINDOWS: JudgeWindows = { perfect: 50, great: 90, good: 130 }

/**
 * Hold-duration tolerance, as a FRACTION of the note's expected duration, plus a
 * floor in milliseconds so very short holds aren't impossibly strict. A release
 * within ±(frac · duration), but at least ±floorMs, counts as a clean hold.
 * Generous by default (per the design bar: gentle "hold longer/shorter" cue,
 * never a harsh miss). Tightened alongside the tap windows by `tightenHold`.
 */
export interface HoldWindows {
  /** Fraction of the note's duration tolerated either side (e.g. 0.35). */
  frac: number
  /** Absolute floor (ms) so short notes keep a usable window. */
  floorMs: number
}

/** Beginner-generous hold defaults. */
export const DEFAULT_HOLD_WINDOWS: HoldWindows = { frac: 0.4, floorMs: 180 }

/**
 * Scale the hold tolerance by difficulty 0..1 (0 = generous, 1 = tight). Mirrors
 * `tightenWindows`: down to ~half-width at difficulty 1.
 */
export function tightenHold(difficulty: number, base: HoldWindows = DEFAULT_HOLD_WINDOWS): HoldWindows {
  const d = Math.max(0, Math.min(1, difficulty))
  const k = 1 - 0.5 * d
  return { frac: base.frac * k, floorMs: base.floorMs * k }
}

/**
 * Scale windows by an osu!-style difficulty 0..1 (0 = generous beginner,
 * 1 = tight advanced). Linear interpolation down to ~half-width at difficulty 1.
 */
export function tightenWindows(difficulty: number, base: JudgeWindows = DEFAULT_WINDOWS): JudgeWindows {
  const d = Math.max(0, Math.min(1, difficulty))
  const k = 1 - 0.5 * d // 1.0 → 0.5
  return { perfect: base.perfect * k, great: base.great * k, good: base.good * k }
}

export interface Judgement {
  /** The rating bucket. */
  rating: Rating
  /** Signed timing error in ms: negative = early, positive = late. */
  error_ms: number
  /** True if early (error_ms < 0). Convenience for color/arrow. */
  early: boolean
  /** Song time (s) at which the tap landed. */
  songTime: number
  /** Index of the onset this tap was matched to, or -1 for a stray tap. */
  noteIndex: number
}

/**
 * Result of judging a note-ON for a HOLD note. The attack is graded exactly like
 * a tap (`rating`/`error_ms`/`early`); additionally `isHold` says whether the
 * matched note is long enough to require a sustained hold (so the pad should
 * raise its hold-meter), and `expectedSec` is how long it must be held.
 */
export interface HoldAttack extends Judgement {
  /** True if the matched note must be held (expected duration > one beat). */
  isHold: boolean
  /** Expected hold duration in seconds (0 if no note matched). */
  expectedSec: number
}

/**
 * Result of judging a note-OFF (release) for a held note. `release` is the gentle
 * duration verdict; `heldSec`/`expectedSec` are the actual vs expected hold; and
 * `noteIndex` is the onset whose hold this closed (or -1 if no active hold).
 */
export interface HoldJudgement {
  release: HoldRelease
  heldSec: number
  expectedSec: number
  noteIndex: number
}

/** A pattern resolved to absolute audio-clock onset times for the current run. */
interface ScheduledPattern {
  /** Audio-clock time (s) at which the pattern's beat 0 begins. */
  startTime: number
  bpm: number
  /**
   * Sounding onsets with absolute audio-clock target times (seconds).
   *  - `duration` is the note's expected sounding length in SECONDS (note.beats
   *    → seconds at this bpm). Used only by hold judging; tap judging ignores it.
   *  - `attackAt` is set by `judgeHoldOn` when this note's attack lands, so the
   *    matching `judgeHoldOff` can grade the held duration. -1 = not held yet.
   */
  targets: { note: NoteEvent; time: number; duration: number; judged: boolean; attackAt: number }[]
}

export interface PlayOptions {
  bpm: number
  /** Bars of metronome count-in before the pattern. Default 1. */
  countInBars?: number
  /** Beats per bar for the count-in clicks. Default = pattern.beatsPerBar. */
  beatsPerBar?: number
  /** Play the clap/hit sounds for the pattern itself. Default true. */
  playPattern?: boolean
  /** Use pitched `hit(freq)` instead of `clap` for onsets (Simon mode). */
  pitches?: number[]
  /** Click the metronome through the pattern body too (not just count-in). */
  metronomeThroughout?: boolean
  /**
   * FELT-beat stride (in `beat` units) between metronome / count-in clicks.
   * Default 1 = a click on every beat-unit (simple meters: one click per
   * quarter). For COMPOUND meters (6/8, 9/8, 12/8) the cells are authored in
   * eighth-units and one FELT beat (a dotted quarter) spans 3 of them, so pass
   * `feltStride: 3` to click only on the felt pulse — 2 clicks per 6/8 bar, NOT
   * 6 ("1-2", not "1-2-3-4-5-6"). The bar downbeat is still accented.
   * Additive: undefined ⇒ 1, so existing callers are unchanged.
   */
  feltStride?: number
  /** Called (via rAF, audible time) when the whole pattern has finished. */
  onComplete?: () => void
}

export interface TapInfo {
  songTime: number
  error_ms: number
  rating: Rating
  early: boolean
  noteIndex: number
}

export class RhythmEngine {
  private scheduler = new Scheduler()
  private current: ScheduledPattern | null = null
  private windows: JudgeWindows = DEFAULT_WINDOWS
  private holdWindows: HoldWindows = DEFAULT_HOLD_WINDOWS
  /** Audio offset (s) — shifts expected note time to correct output latency. */
  private audioOffset = outputLatency()
  private tapHandlers = new Set<(t: TapInfo) => void>()
  private holdHandlers = new Set<(h: HoldJudgement) => void>()
  private rafId: number | null = null
  private completeAt = 0
  private onComplete: (() => void) | null = null
  private completed = false

  /** Must be called from a user gesture before the first playback. */
  async resume(): Promise<void> {
    await resumeAudio()
  }

  /** Set the judging windows (e.g. from tightenWindows for the level). */
  setWindows(w: JudgeWindows): void {
    this.windows = w
  }

  getWindows(): JudgeWindows {
    return this.windows
  }

  /** Set the hold-duration tolerance (e.g. from tightenHold for the level). */
  setHoldWindows(w: HoldWindows): void {
    this.holdWindows = w
  }

  getHoldWindows(): HoldWindows {
    return this.holdWindows
  }

  /** Manually override the audio offset (s). Calibration hook for later. */
  setAudioOffset(seconds: number): void {
    this.audioOffset = seconds
  }

  /**
   * Schedule a Pattern for playback + judging. Returns the absolute audio-clock
   * time the pattern body (beat 0) starts, and its total duration (s).
   */
  playPattern(p: Pattern, opts: PlayOptions): { startTime: number; duration: number } {
    this.stop()
    // Re-resume if the OS suspended the context between plays (iOS Safari does
    // this on backgrounding/inactivity); fire-and-forget, no-op if already running.
    void resumeAudio()
    const bpm = opts.bpm
    const beatsPerBar = opts.beatsPerBar ?? p.beatsPerBar
    const countInBars = opts.countInBars ?? 1
    const playBody = opts.playPattern ?? true
    // FELT-beat click stride: 1 for simple meters; 3 for compound (one click per
    // dotted-quarter felt beat, not per eighth). Clamp to ≥1.
    const feltStride = Math.max(1, Math.round(opts.feltStride ?? 1))
    const lead = 0.12 // small lead so the first count-in click isn't clipped
    const t0 = now() + lead
    const countInBeats = countInBars * beatsPerBar
    const bodyStart = t0 + beatsToSeconds(countInBeats, bpm)

    const events: ScheduledEvent[] = []

    // Count-in clicks — one per FELT beat (stride), accented on the bar downbeat.
    for (let b = 0; b < countInBeats; b += feltStride) {
      const accent = b % beatsPerBar === 0
      const when = t0 + beatsToSeconds(b, bpm)
      events.push({ time: when, tag: 'countin', play: (w) => sound.countBlip(w, accent) })
    }

    // Build absolute targets for sounding onsets.
    const os = onsets(p)
    const targets: ScheduledPattern['targets'] = os.map((note, i) => {
      const time = bodyStart + beatsToSeconds(note.beat, bpm) + this.audioOffset
      if (playBody) {
        const pitch = opts.pitches?.[i]
        events.push({
          time,
          tag: 'onset',
          play: (w) => (pitch != null ? sound.hit(pitch, w) : sound.clap(w)),
        })
      }
      // Expected hold duration in seconds (note.beats → seconds at this bpm).
      // Used only by the hold-judging API; tap judging ignores it entirely.
      const duration = beatsToSeconds(note.beats, bpm)
      return { note, time, duration, judged: false, attackAt: -1 }
    })

    // Optional metronome through the body — one click per FELT beat (stride),
    // accented on each bar downbeat.
    if (opts.metronomeThroughout) {
      const totalBeats = p.cells.reduce((s, c) => s + c.beats, 0)
      for (let b = 0; b < totalBeats; b += feltStride) {
        const when = bodyStart + beatsToSeconds(b, bpm)
        events.push({ time: when, tag: 'metro', play: (w) => sound.metronome(w, b % beatsPerBar === 0) })
      }
    }

    this.scheduler.schedule(events)

    const totalBeats = p.cells.reduce((s, c) => s + c.beats, 0)
    const duration = beatsToSeconds(totalBeats, bpm)
    this.current = { startTime: bodyStart, bpm, targets }
    this.onComplete = opts.onComplete ?? null
    this.completeAt = bodyStart + duration + 0.05
    this.completed = false
    this.startRaf()
    return { startTime: bodyStart, duration }
  }

  /**
   * Play a Pattern purely as audio (no judging targets) — for "listen" phases
   * in Detective / Builder where the player only hears, doesn't tap.
   */
  preview(p: Pattern, opts: PlayOptions): { startTime: number; duration: number } {
    const res = this.playPattern(p, { ...opts, playPattern: opts.playPattern ?? true })
    // Mark all targets judged so stray taps during preview aren't matched.
    if (this.current) this.current.targets.forEach((t) => (t.judged = true))
    return res
  }

  /**
   * Current song time: seconds since the pattern body's beat 0. Negative during
   * the count-in. Reads the audio clock fresh — safe to call every rAF frame.
   * Returns NaN if nothing is playing.
   */
  songTime(): number {
    if (!this.current) return NaN
    return now() - this.current.startTime
  }

  /** Whether a pattern is currently scheduled/active. */
  get isPlaying(): boolean {
    return this.current !== null
  }

  /**
   * Judge a tap NOW (call this synchronously inside a pointerdown/keydown
   * handler — the first thing it does is read the audio clock). Matches the tap
   * to the nearest unjudged onset within the Good window; returns the Judgement
   * (rating 'miss' with noteIndex -1 for a stray tap with no onset in range).
   * Also fires registered tap handlers and plays the rating ping.
   */
  judgeTap(): Judgement {
    const tapTime = now()
    if (!this.current) {
      const j: Judgement = { rating: 'miss', error_ms: 0, early: false, songTime: NaN, noteIndex: -1 }
      return j
    }
    const goodSec = this.windows.good / 1000
    let best: { idx: number; err: number } | null = null
    this.current.targets.forEach((t, idx) => {
      if (t.judged) return
      const err = tapTime - t.time // + = late
      if (Math.abs(err) <= goodSec && (best === null || Math.abs(err) < Math.abs(best.err))) {
        best = { idx, err }
      }
    })

    let rating: Rating
    let error_ms: number
    let noteIndex: number
    if (best === null) {
      // Stray tap — no onset in range. Count as a miss (ghost-tap penalty).
      rating = 'miss'
      error_ms = 0
      noteIndex = -1
    } else {
      const chosen: { idx: number; err: number } = best
      this.current.targets[chosen.idx].judged = true
      error_ms = chosen.err * 1000
      noteIndex = this.current.targets[chosen.idx].note.index
      const abs = Math.abs(error_ms)
      if (abs <= this.windows.perfect) rating = 'perfect'
      else if (abs <= this.windows.great) rating = 'great'
      else rating = 'good'
    }

    const songTime = tapTime - this.current.startTime
    const j: Judgement = { rating, error_ms, early: error_ms < 0, songTime, noteIndex }
    sound.ratingPing(rating)
    const info: TapInfo = { songTime, error_ms, rating, early: j.early, noteIndex }
    this.tapHandlers.forEach((h) => h(info))
    return j
  }

  /**
   * Judge a note-ON (attack) for HOLD-aware play. Backward-compatible superset of
   * `judgeTap`: it grades the attack exactly like a tap (same windows, same
   * stray-tap handling, same tap-handler fan-out and rating ping), AND remembers
   * the attack time on the matched note so a later `judgeHoldOff` can grade the
   * held duration. Call this synchronously inside a pointerdown/keydown handler.
   *
   * Returns a `HoldAttack`: the tap judgement plus `isHold` (does this note need
   * sustaining?) and `expectedSec` (how long). For single-beat notes `isHold` is
   * false and the caller can treat it as a plain tap (no release needed).
   *
   * `holdThresholdBeats` (default 1) — notes longer than this many beats are
   * considered holds; one-beat notes stay tap-only.
   */
  judgeHoldOn(holdThresholdBeats = 1): HoldAttack {
    const tapTime = now()
    const base = this.judgeTap()
    if (!this.current || base.noteIndex < 0) {
      return { ...base, isHold: false, expectedSec: 0 }
    }
    // judgeTap matched & marked an onset by its note.index; find that target to
    // read its duration and arm the hold. (note.index is the sounding-onset id.)
    const target = this.current.targets.find((t) => t.note.index === base.noteIndex)
    if (!target) return { ...base, isHold: false, expectedSec: 0 }
    const expectedSec = target.duration
    const isHold = target.note.beats > holdThresholdBeats
    if (isHold) target.attackAt = tapTime
    return { ...base, isHold, expectedSec }
  }

  /**
   * Judge a note-OFF (release) for a held note. Looks up the note whose attack is
   * still open (set by `judgeHoldOn`) — the most recently attacked one — and
   * grades the held duration against the hold window:
   *  - within ±tolerance ⇒ 'good'
   *  - released early     ⇒ 'short' ("hold longer") — a gentle cue, not a miss
   *  - released late      ⇒ 'long'  ("hold shorter") — a gentle cue, not a miss
   * Returns null if there is no open hold (e.g. releasing after a tap-only note).
   * Fires registered hold handlers. Never plays the harsh miss ping.
   */
  judgeHoldOff(): HoldJudgement | null {
    const releaseTime = now()
    if (!this.current) return null
    // The active hold is the target with the latest attackAt that's still open.
    let active: ScheduledPattern['targets'][number] | null = null
    for (const t of this.current.targets) {
      if (t.attackAt >= 0 && (active === null || t.attackAt > active.attackAt)) active = t
    }
    if (active === null) return null
    const held = releaseTime - active.attackAt
    const expected = active.duration
    active.attackAt = -1 // close the hold

    const tol = Math.max(this.holdWindows.floorMs / 1000, expected * this.holdWindows.frac)
    let release: HoldRelease
    if (held < expected - tol) release = 'short'
    else if (held > expected + tol) release = 'long'
    else release = 'good'

    const j: HoldJudgement = { release, heldSec: held, expectedSec: expected, noteIndex: active.note.index }
    this.holdHandlers.forEach((h) => h(j))
    return j
  }

  /** Register a hold-release handler. Returns an unsubscribe fn. */
  onHold(handler: (h: HoldJudgement) => void): () => void {
    this.holdHandlers.add(handler)
    return () => this.holdHandlers.delete(handler)
  }

  /**
   * Returns onsets that elapsed past the Good window without being judged —
   * i.e. genuine MISSES. Call once per frame in the game loop; each missed onset
   * is reported exactly once. (Lets games count dropped notes as misses.)
   */
  collectMisses(): NoteEvent[] {
    if (!this.current) return []
    const t = now()
    const goodSec = this.windows.good / 1000
    const missed: NoteEvent[] = []
    for (const target of this.current.targets) {
      if (!target.judged && t > target.time + goodSec) {
        target.judged = true
        missed.push(target.note)
      }
    }
    return missed
  }

  /** Register a tap handler. Returns an unsubscribe fn. */
  onTap(handler: (t: TapInfo) => void): () => void {
    this.tapHandlers.add(handler)
    return () => this.tapHandlers.delete(handler)
  }

  /** Stop playback, clear the schedule, and reset state (keeps handlers). */
  stop(): void {
    this.scheduler.clear()
    this.current = null
    this.onComplete = null
    this.completed = false
    this.stopRaf()
  }

  /** Full teardown — call on unmount. */
  dispose(): void {
    this.stop()
    this.tapHandlers.clear()
    this.holdHandlers.clear()
  }

  // The engine's own rAF loop fires onComplete at audible time (not when the
  // scheduler queued the last sound, which is ~aheadTime early).
  private startRaf(): void {
    if (this.rafId !== null) return
    const loop = () => {
      if (this.current && !this.completed && now() >= this.completeAt) {
        this.completed = true
        const cb = this.onComplete
        cb?.()
      }
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  private stopRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}
