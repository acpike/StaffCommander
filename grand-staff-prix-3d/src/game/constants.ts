// Shared world tuning. One place so the car, camera, track and gates agree.

export const TRACK_HALF = 8.25 // half the drivable width (full width = 16.5)
export const CAR_HALF_W = 0.9 // half car width, used to clamp & size collider
export const CAR_Y = 0.45 // fixed driving height of the car body centre

export const BASE_SPEED = 26 // forward units / second at stage 1
export const STAGE_SPEED = 4 // extra forward speed per stage
export const BOOST_SPEED = 12 // extra speed while boosting
export const MAX_VISUAL_SPEED = 26 + 4 * 8 + 12 // for speed-line normalisation

export const STEER_RATE = 12 // lateral units / second at full steer

export const GATE_DISTANCE = 95 // how far ahead a new wave spawns (reaction time)
export const GATE_THICKNESS = 2.4 // z-depth of the gate sensor
export const GATE_HEIGHT = 6 // gate sensor height

/** Lane centre x positions for a wave of `count` gates spanning the full road. */
export function laneCenters(count: number): number[] {
  const laneW = (TRACK_HALF * 2) / count
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(-TRACK_HALF + (i + 0.5) * laneW)
  return out
}

export function laneWidth(count: number): number {
  return (TRACK_HALF * 2) / count
}

export const CLAMP_X = TRACK_HALF - CAR_HALF_W
