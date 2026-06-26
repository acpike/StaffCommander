// Web Audio synth & SFX. All sounds are synthesized (no asset files) and routed
// through the shared master gain. Every function that schedules a sound takes an
// optional `when` (absolute audio-clock time) so the scheduler can place sounds
// sample-accurately ahead of time; default `when = now()` plays immediately.
//
// Design goal: pleasant, modern, not harsh. Soft sine/triangle bodies, gentle
// noise transients, short envelopes. Nothing piercing.

import { getAudioContext, getMaster, now } from './clock'

function env(
  gain: GainNode,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function tone(
  freq: number,
  when: number,
  dur: number,
  peak: number,
  type: OscillatorType = 'sine',
  glideTo?: number,
): void {
  const ctx = getAudioContext()
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, when)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, when + dur)
  env(g, when, peak, 0.005, dur)
  osc.connect(g).connect(getMaster())
  osc.start(when)
  osc.stop(when + dur + 0.05)
}

/** Short filtered-noise burst (for claps / hits). */
function noiseBurst(when: number, dur: number, peak: number, hp = 1200, lp = 6000): void {
  const ctx = getAudioContext()
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const hpf = ctx.createBiquadFilter()
  hpf.type = 'highpass'
  hpf.frequency.value = hp
  const lpf = ctx.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = lp
  const g = ctx.createGain()
  env(g, when, peak, 0.002, dur)
  src.connect(hpf).connect(lpf).connect(g).connect(getMaster())
  src.start(when)
  src.stop(when + dur + 0.05)
}

// ── Public SFX API ────────────────────────────────────────────────────────────

/** Metronome tick. Accented (brighter, louder) on the downbeat. */
export function metronome(when: number = now(), accent = false): void {
  tone(accent ? 1760 : 1320, when, 0.05, accent ? 0.32 : 0.16, 'sine')
}

/** A clap / hand-drum hit — the canonical "rhythm" sound used to play patterns. */
export function clap(when: number = now(), velocity = 1): void {
  noiseBurst(when, 0.06, 0.4 * velocity, 1400, 7000)
  tone(220, when, 0.05, 0.12 * velocity, 'triangle')
}

/** A pitched, musical hit — for melodic/Simon-style sequences. */
export function hit(freq: number, when: number = now(), velocity = 1): void {
  tone(freq, when, 0.22, 0.3 * velocity, 'triangle')
  tone(freq * 2, when, 0.12, 0.08 * velocity, 'sine')
}

/** Count-in voice-ish blip (for "1, 2, 3, 4" pre-roll). Higher = downbeat. */
export function countBlip(when: number = now(), accent = false): void {
  tone(accent ? 660 : 520, when, 0.12, accent ? 0.28 : 0.18, 'square', accent ? 680 : 540)
}

/** Pleasant success chime (round complete / correct answer). */
export function success(when: number = now()): void {
  tone(659.25, when, 0.18, 0.22, 'sine') // E5
  tone(987.77, when + 0.09, 0.22, 0.2, 'sine') // B5
  tone(1318.51, when + 0.18, 0.3, 0.18, 'sine') // E6
}

/** Big level-up / mastery fanfare. */
export function fanfare(when: number = now()): void {
  const notes = [523.25, 659.25, 783.99, 1046.5] // C E G C
  notes.forEach((f, i) => tone(f, when + i * 0.1, 0.4, 0.2, 'triangle'))
}

/** Gentle miss — a soft descending blip, NOT harsh (per the design bar). */
export function miss(when: number = now()): void {
  tone(330, when, 0.18, 0.16, 'sine', 220)
}

/** Per-tap feedback tones keyed to rating. */
export function ratingPing(rating: 'perfect' | 'great' | 'good' | 'miss', when: number = now()): void {
  switch (rating) {
    case 'perfect':
      tone(1318.51, when, 0.14, 0.24, 'sine')
      break
    case 'great':
      tone(987.77, when, 0.13, 0.2, 'sine')
      break
    case 'good':
      tone(659.25, when, 0.12, 0.17, 'sine')
      break
    case 'miss':
      miss(when)
      break
  }
}

export const sound = {
  metronome,
  clap,
  hit,
  countBlip,
  success,
  fanfare,
  miss,
  ratingPing,
}
