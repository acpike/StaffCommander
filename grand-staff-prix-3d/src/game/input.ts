// Unified steering input: keyboard + on-screen touch pads + device tilt, combined
// into a single steer value in [-1, 1] and a throttle flag. Lives outside React so
// the game loop can read it every frame without triggering re-renders.

type SteerMode = 'keys' | 'touch' | 'tilt'

class InputController {
  private left = false
  private right = false
  private up = false
  private padSteer = 0 // from the on-screen steering pad
  private throttle = false // from the on-screen throttle button
  private tiltSteer = 0
  private mode: SteerMode = 'keys'
  private attached = false
  private tiltCalibrated = false
  private tiltZero = 0

  setMode(m: SteerMode) {
    this.mode = m
    if (m === 'tilt') this.requestTilt()
  }

  /** Combined steer, clamped. Negative = left, positive = right. */
  get steer(): number {
    let s = 0
    if (this.left) s -= 1
    if (this.right) s += 1
    s += this.padSteer
    if (this.mode === 'tilt') s += this.tiltSteer
    return Math.max(-1, Math.min(1, s))
  }

  get boost(): boolean {
    return this.up || this.throttle
  }

  // ── on-screen touch controls (driven by ui/TouchControls) ──
  setPadSteer(v: number) {
    this.padSteer = Math.max(-1, Math.min(1, v))
  }
  setThrottle(on: boolean) {
    this.throttle = on
  }

  attach() {
    if (this.attached) return
    this.attached = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  detach() {
    if (!this.attached) return
    this.attached = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('deviceorientation', this.onTilt)
    this.left = this.right = this.up = this.throttle = false
    this.padSteer = 0
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.left = true
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = true
    else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') this.up = true
  }
  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.left = false
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = false
    else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') this.up = false
  }

  private requestTilt() {
    type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }
    const DOEvt = window.DeviceOrientationEvent as DOE | undefined
    if (DOEvt && typeof DOEvt.requestPermission === 'function') {
      DOEvt.requestPermission()
        .then((res) => {
          if (res === 'granted') window.addEventListener('deviceorientation', this.onTilt)
        })
        .catch(() => {})
    } else if (DOEvt) {
      window.addEventListener('deviceorientation', this.onTilt)
    }
  }
  private onTilt = (e: DeviceOrientationEvent) => {
    const gamma = e.gamma ?? 0 // left/right tilt in degrees
    if (!this.tiltCalibrated) {
      this.tiltZero = gamma
      this.tiltCalibrated = true
    }
    this.tiltSteer = Math.max(-1, Math.min(1, (gamma - this.tiltZero) / 30))
  }
}

export const input = new InputController()
