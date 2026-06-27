// Five racing environments. Each theme tints the sky, fog, ground, road and
// lighting so every world reads as a distinct place — these palettes feed both
// the menu preview swatches and the live 3D scene.

export interface Theme {
  id: string
  name: string
  /** Sky gradient top → bottom. */
  skyTop: string
  skyBottom: string
  /** Distance fog colour (usually matches the horizon). */
  fog: string
  fogNear: number
  fogFar: number
  /** Ground plane colour flanking the track. */
  ground: string
  /** Road surface colour. */
  road: string
  /** Lane / edge line colour. */
  line: string
  /** Sun / key light colour and direction. */
  sun: string
  sunDir: [number, number, number]
  ambient: string
  /** drei <Environment> preset for reflections. */
  envPreset: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'city' | 'park' | 'lobby'
}

export const THEMES: Theme[] = [
  {
    id: 'mountain', name: 'Mountain Pass',
    skyTop: '#1B3A6B', skyBottom: '#7FB2D9', fog: '#9FC2DE', fogNear: 30, fogFar: 220,
    ground: '#3E6B43', road: '#3A3D44', line: '#E8EDF2',
    sun: '#FFF3DC', sunDir: [-8, 14, 6], ambient: '#5C7DA8', envPreset: 'park',
  },
  {
    id: 'city', name: 'San Francisco',
    skyTop: '#2A2350', skyBottom: '#E8A06B', fog: '#D89A78', fogNear: 28, fogFar: 200,
    ground: '#4A4550', road: '#33343B', line: '#FFE9C7',
    sun: '#FFD9A0', sunDir: [10, 12, -4], ambient: '#7A6A8C', envPreset: 'sunset',
  },
  {
    id: 'desert', name: 'Desert Run',
    skyTop: '#3D6FB0', skyBottom: '#F2D8A6', fog: '#E9CFA0', fogNear: 35, fogFar: 240,
    ground: '#C99A5B', road: '#5A4A3A', line: '#FFF6E2',
    sun: '#FFF0C8', sunDir: [6, 16, 8], ambient: '#B89A6E', envPreset: 'dawn',
  },
  {
    id: 'candy', name: 'Candy Canyon',
    skyTop: '#7A2E86', skyBottom: '#FFB3D9', fog: '#F7A8D2', fogNear: 26, fogFar: 190,
    ground: '#E86FB0', road: '#5E3A52', line: '#FFFFFF',
    sun: '#FFE0F2', sunDir: [-6, 13, 5], ambient: '#C56AA8', envPreset: 'lobby',
  },
  {
    id: 'space', name: 'Deep Space',
    skyTop: '#05030F', skyBottom: '#1A1140', fog: '#140C2E', fogNear: 24, fogFar: 200,
    ground: '#15122A', road: '#241F3D', line: '#8C7BFF',
    sun: '#BFA8FF', sunDir: [4, 14, -6], ambient: '#2A2150', envPreset: 'night',
  },
]

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
