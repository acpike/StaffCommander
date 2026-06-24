// Five selectable cars. Colors drive the 3D material; stats are flavor +
// light handling modifiers so the choice feels meaningful.

export interface CarSpec {
  id: string
  name: string
  /** Body paint. */
  color: string
  /** Secondary trim / accent. */
  accent: string
  /** 0..1 bars shown in the garage. */
  speed: number
  grip: number
  /** Handling multipliers applied to the controller (subtle). */
  topSpeedMul: number
  turnMul: number
  /**
   * Optional real 3D model. When set, RealCarModel loads this GLB (relative to
   * /public) instead of rendering procedural geometry. Leave undefined to use
   * the procedural sports-car body (the default today — no GLB assets bundled).
   */
  model?: string
  /** Uniform scale applied to the loaded GLB to match the ~1.8x3.7 footprint. */
  modelScale?: number
  /** Y rotation (radians) so the model's nose points toward -Z. */
  modelRotation?: number
  /** Vertical offset so the model's wheels rest near y = -0.18. */
  modelYOffset?: number
  /** Open-cockpit car: show a helmeted driver in the seat. */
  openCockpit?: boolean
  /** Where the driver bust sits, in fitted-car space (after auto-fit). */
  driverSeat?: [number, number, number]
  /** Driver bust scale + Y rotation tweaks. */
  driverScale?: number
  driverRotation?: number
}

export const CARS: CarSpec[] = [
  { id: 'vortex', name: 'Vortex GT', color: '#FF4E2E', accent: '#2A1410', speed: 0.7, grip: 0.7, topSpeedMul: 1.0, turnMul: 1.0, model: '/models/user_sportscar.glb', modelRotation: Math.PI / 2, openCockpit: true, driverSeat: [0, 0.55, 0.15], driverScale: 1, driverRotation: 0 },
  { id: 'brawler', name: 'Brawler', color: '#F5A623', accent: '#3A2606', speed: 0.55, grip: 0.9, topSpeedMul: 0.92, turnMul: 1.12, model: '/models/muscle_car.glb', modelRotation: Math.PI / 2 },
  { id: 'apex', name: 'Apex F1', color: '#34D1BF', accent: '#06302B', speed: 0.95, grip: 0.6, topSpeedMul: 1.12, turnMul: 0.9 },
  { id: 'trailblaze', name: 'Trailblaze', color: '#5B8DEF', accent: '#0B1E3D', speed: 0.6, grip: 0.85, topSpeedMul: 0.95, turnMul: 1.08 },
  { id: 'rumble', name: 'Rumble Rod', color: '#E84CA0', accent: '#3A0B26', speed: 0.8, grip: 0.75, topSpeedMul: 1.05, turnMul: 1.0 },
]

export function carById(id: string): CarSpec {
  return CARS.find((c) => c.id === id) ?? CARS[0]
}

/**
 * De-duplicated list of GLB paths declared across CARS, for preloading in
 * RealCarModel. Empty today because no real car GLBs are bundled yet — add a
 * `model` to any car above and it will be preloaded automatically.
 */
export const CAR_MODEL_PATHS: string[] = Array.from(
  new Set(CARS.map((c) => c.model).filter((m): m is string => Boolean(m))),
)
