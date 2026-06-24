// Per-theme environment tuning for the scenery layer (terrain, distant ridges,
// roadside props). Kept separate from the gameplay palette in data/themes so the
// landscape look can evolve without touching the menu swatch source of truth.
//
// All colours are plain hex strings consumed by THREE.Color. Geometry kinds are
// string enums switched on inside the prop/terrain components.

export type RidgeKind = 'peaks' | 'skyline' | 'mesas' | 'rolling' | 'asteroids'
export type PropKind = 'tree' | 'building' | 'cactus' | 'lollipop' | 'crystal'

export interface SceneryConfig {
  /** Two-to-three distant silhouette ridge bands (far → near). */
  ridge: {
    kind: RidgeKind
    /** Colours per band, drawn far → near (index 0 is farthest/lightest). */
    bands: string[]
    /** Base height of the nearest ridge band in world units. */
    height: number
  }
  /** Rolling hill terrain that flanks the road just past the shoulders. */
  terrain: {
    /** Hill surface colour. */
    color: string
    /** Optional snow / highlight tint blended onto peaks (null = none). */
    cap: string | null
    /** Vertical relief amplitude in world units. */
    amplitude: number
    roughness: number
  }
  /** Streaming roadside props. */
  prop: {
    kind: PropKind
    /** Primary body colour. */
    color: string
    /** Secondary colour (foliage, windows, candy, etc.). */
    accent: string
    /** Nominal world height of one prop. */
    height: number
    /** Emissive accent (for space crystals / candy glow). 0 = off. */
    glow: number
  }
}

export const SCENERY: Record<string, SceneryConfig> = {
  mountain: {
    ridge: { kind: 'peaks', bands: ['#A9C6DF', '#6E93B8', '#46688F'], height: 60 },
    terrain: { color: '#3E6B43', cap: '#E8F0F6', amplitude: 7, roughness: 1 },
    prop: { kind: 'tree', color: '#234D2E', accent: '#2E6238', height: 5, glow: 0 },
  },
  city: {
    ridge: { kind: 'skyline', bands: ['#C79A86', '#8C6A78', '#5B4A60'], height: 48 },
    terrain: { color: '#4A4550', cap: null, amplitude: 2.5, roughness: 1 },
    prop: { kind: 'building', color: '#3A3742', accent: '#FFE9C7', height: 9, glow: 0.6 },
  },
  desert: {
    ridge: { kind: 'mesas', bands: ['#E2C089', '#C99A5B', '#A6713F'], height: 40 },
    terrain: { color: '#C99A5B', cap: null, amplitude: 5, roughness: 1 },
    prop: { kind: 'cactus', color: '#5C7A45', accent: '#6E8C52', height: 4, glow: 0 },
  },
  candy: {
    ridge: { kind: 'rolling', bands: ['#FFC7E4', '#F58FC4', '#D86BAA'], height: 34 },
    terrain: { color: '#E86FB0', cap: '#FFFFFF', amplitude: 6, roughness: 0.6 },
    prop: { kind: 'lollipop', color: '#FFFFFF', accent: '#FF5FA2', height: 5, glow: 0.4 },
  },
  space: {
    ridge: { kind: 'asteroids', bands: ['#221B45', '#16112F', '#0C0920'], height: 30 },
    terrain: { color: '#15122A', cap: null, amplitude: 4, roughness: 0.8 },
    prop: { kind: 'crystal', color: '#3A2E6B', accent: '#8C7BFF', height: 5, glow: 1.4 },
  },
}

export function sceneryFor(id: string): SceneryConfig {
  return SCENERY[id] ?? SCENERY.mountain
}
