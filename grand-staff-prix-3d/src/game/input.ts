// Unified steering input: keyboard + touch/drag + device tilt, combined into a
// single steer value in [-1, 1] and a boost flag. Lives outside React so the
// game loop can read it every frame without triggering re-renders.

type SteerMode = 'keys' | 'touch' | 'tilt'

class InputController {
  private left = false
  private right = false
  private up = false
  private touchSteer = 0
  private touchActive = false
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
    if (this.mode === 'touch' && this.touchActive) s += this.touchSteer
    if (this.mode === 'tilt') s += this.tiltSteer
    return Math.max(-1, Math.min(1, s))
  }

  get boost(): boolean {
    return this.up || this.touchActive
  }

  attach() {
    if (this.attached) return
    this.attached = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
  }

  detach() {
    if (!this.attached) return
    this.attached = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    window.removeEventListener('deviceorientation', this.onTilt)
    this.left = this.right = this.up = this.touchActive = false
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

  private onPointerDown = (e: PointerEvent) => {
    this.touchActive = true
    this.updateTouch(e.clientX)
  }
  private onPointerMove = (e: PointerEvent) => {
    if (this.touchActive) this.updateTouch(e.clientX)
  }
  private onPointerUp = () => {
    this.touchActive = false
    this.touchSteer = 0
  }
  private updateTouch(clientX: number) {
    // Map horizontal screen position to steer: left third → -1, right third → +1.
    const norm = (clientX / window.innerWidth) * 2 - 1
    this.touchSteer = Math.max(-1, Math.min(1, norm * 1.6))
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
