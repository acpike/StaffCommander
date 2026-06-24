// Self-contained Web Audio engine: synthesized SFX + a light procedural music
// loop. No audio files required. All nodes are created lazily after the first
// user gesture (browsers block audio before interaction).

import { noteFrequency, type GameNote } from '../data/notes'

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private musicTimer: number | null = null
  private musicOn = false
  private step = 0

  /** Must be called from a user gesture to unlock audio. */
  resume() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.0
      this.musicGain.connect(this.master)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, dest?: AudioNode) {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime + when
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(dest ?? this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  /** The pitch of the note the player just read correctly. */
  playNotePitch(note: GameNote) {
    this.blip(noteFrequency(note), 0.5, 'triangle', 0.5)
  }

  correct() {
    this.blip(660, 0.12, 'triangle', 0.4)
    this.blip(990, 0.16, 'triangle', 0.35, 0.08)
  }

  wrong() {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.28)
    g.gain.setValueAtTime(0.3, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.32)
  }

  click() {
    this.blip(420, 0.05, 'square', 0.2)
  }

  countBeep(last = false) {
    this.blip(last ? 880 : 520, last ? 0.3 : 0.12, 'triangle', 0.4)
  }

  crash() {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = this.ctx.createBufferSource()
    const g = this.ctx.createGain()
    src.buffer = buf
    g.gain.setValueAtTime(0.4, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    src.connect(g)
    g.connect(this.master)
    src.start(t)
  }

  // ── engine: filtered brown-noise rumble + a low sub, modulated by a "firing"
  //    LFO. Reads as an engine (textured rumble) rather than a tonal drone, and
  //    its brightness/pitch/throb-rate rise with speed. Kept quiet. (A recorded
  //    engine loop would be even more realistic — easy to swap in later.)
  private engNoise: AudioBufferSourceNode | null = null
  private engSub: OscillatorNode | null = null
  private engLfo: OscillatorNode | null = null
  private engBand: BiquadFilterNode | null = null
  private engGain: GainNode | null = null
  private engNoiseBuf: AudioBuffer | null = null

  private brownNoise(): AudioBuffer {
    if (this.engNoiseBuf) return this.engNoiseBuf
    const ctx = this.ctx!
    const len = ctx.sampleRate * 1.2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.2
    }
    this.engNoiseBuf = buf
    return buf
  }

  startEngine() {
    if (!this.ctx || !this.master || this.engNoise) return
    const t = this.ctx.currentTime

    this.engGain = this.ctx.createGain()
    this.engGain.gain.value = 0
    this.engGain.connect(this.master)

    // firing throb: LFO adds a small wobble to the engine gain
    const lfoDepth = this.ctx.createGain()
    lfoDepth.gain.value = 0.012
    this.engLfo = this.ctx.createOscillator()
    this.engLfo.type = 'sine'
    this.engLfo.frequency.value = 14
    this.engLfo.connect(lfoDepth)
    lfoDepth.connect(this.engGain.gain)

    this.engBand = this.ctx.createBiquadFilter()
    this.engBand.type = 'lowpass'
    this.engBand.frequency.value = 220
    this.engBand.Q.value = 1
    this.engBand.connect(this.engGain)

    this.engNoise = this.ctx.createBufferSource()
    this.engNoise.buffer = this.brownNoise()
    this.engNoise.loop = true
    this.engNoise.connect(this.engBand)

    this.engSub = this.ctx.createOscillator()
    this.engSub.type = 'sawtooth'
    this.engSub.frequency.value = 38
    this.engSub.connect(this.engBand)

    this.engNoise.start(t)
    this.engSub.start(t)
    this.engLfo.start(t)
    this.engGain.gain.linearRampToValueAtTime(0.05, t + 0.4)
  }

  /** norm in 0..1 (current speed / max speed). */
  setEngineSpeed(norm: number) {
    if (!this.ctx || !this.engBand || !this.engSub || !this.engLfo || !this.engGain) return
    const n = Math.max(0, Math.min(1, norm))
    const t = this.ctx.currentTime
    this.engBand.frequency.setTargetAtTime(180 + n * 520, t, 0.12)
    this.engSub.frequency.setTargetAtTime(34 + n * 46, t, 0.12)
    this.engLfo.frequency.setTargetAtTime(11 + n * 26, t, 0.12) // throb speeds up
    this.engGain.gain.setTargetAtTime(0.035 + n * 0.03, t, 0.15)
  }

  stopEngine() {
    if (!this.ctx) {
      this.engNoise = this.engSub = this.engLfo = null
      return
    }
    const t = this.ctx.currentTime
    if (this.engGain) {
      this.engGain.gain.cancelScheduledValues(t)
      this.engGain.gain.setValueAtTime(this.engGain.gain.value, t)
      this.engGain.gain.linearRampToValueAtTime(0, t + 0.25)
    }
    try {
      this.engNoise?.stop(t + 0.3)
      this.engSub?.stop(t + 0.3)
      this.engLfo?.stop(t + 0.3)
    } catch {
      /* already stopped */
    }
    this.engNoise = this.engSub = this.engLfo = null
  }

  // ── procedural background music: a rolling minor-pentatonic arpeggio + bass ──
  private readonly mel = [0, 3, 5, 7, 10, 7, 5, 3]
  private readonly rootHz = 220 // A3

  setMusic(on: boolean) {
    this.musicOn = on
    if (!this.ctx || !this.musicGain) return
    const t = this.ctx.currentTime
    this.musicGain.gain.cancelScheduledValues(t)
    this.musicGain.gain.linearRampToValueAtTime(on ? 0.18 : 0.0, t + 0.4)
    if (on && this.musicTimer == null) this.scheduleMusic()
    if (!on && this.musicTimer != null) {
      clearTimeout(this.musicTimer)
      this.musicTimer = null
    }
  }

  /** Speed the music up with the stage (1..). */
  private tempoMs = 260
  setStageTempo(stage: number) {
    this.tempoMs = Math.max(150, 280 - stage * 18)
  }

  private scheduleMusic() {
    if (!this.ctx || !this.musicGain) return
    // self-chained setTimeout so we can pick up the latest tempo each step and
    // never leave a stray interval running after the music is turned off.
    const tick = () => {
      if (!this.ctx || !this.musicGain || !this.musicOn) {
        this.musicTimer = null
        return
      }
      const semi = this.mel[this.step % this.mel.length]
      const freq = this.rootHz * Math.pow(2, semi / 12)
      this.blip(freq * 2, 0.18, 'triangle', 0.5, 0, this.musicGain)
      if (this.step % 2 === 0) this.blip(this.rootHz / 2, 0.22, 'sawtooth', 0.4, 0, this.musicGain)
      this.step++
      this.musicTimer = window.setTimeout(tick, this.tempoMs)
    }
    this.musicTimer = window.setTimeout(tick, this.tempoMs)
  }
}

export const audio = new AudioEngine()
