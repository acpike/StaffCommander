// Live car telemetry shared outside React so the chase camera, gates and HUD
// effects can read the car's position every frame without re-rendering.

export const carState = {
  x: 0,
  z: 0,
  /** Smoothed steer value actually applied (-1..1). */
  steer: 0,
  /** Current forward speed in units/sec. */
  speed: 0,
  /** Visual yaw (radians) for banking. */
  yaw: 0,
}

export function resetCarState() {
  carState.x = 0
  carState.z = 0
  carState.steer = 0
  carState.speed = 0
  carState.yaw = 0
}
