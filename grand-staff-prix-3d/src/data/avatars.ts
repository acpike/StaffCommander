// Avatar customization data. A player BUILDS their driver from features —
// face shape, skin tone, hair, eyes, outfit — and the result rides in the
// car cockpit (game/CarModel.tsx) and the menu showroom. Pure data: the ids
// and hex colors drive primitives in game/AvatarCharacter.tsx so we never
// ship a model file.

export type FaceShapeId = 'round' | 'oval' | 'square' | 'heart'
export type HairStyleId = 'short' | 'long' | 'ponytail' | 'spiky' | 'buzz' | 'bun' | 'cap'
export type OutfitId = 'racing' | 'hoodie' | 'jacket' | 'tee' | 'overalls'

export interface AvatarConfig {
  faceShape: FaceShapeId
  /** Skin tone (hex). */
  skinTone: string
  hairStyle: HairStyleId
  /** Hair color (hex). */
  hairColor: string
  /** Eye color (hex). */
  eyeColor: string
  outfit: OutfitId
  /** Primary outfit color (hex). */
  outfitColor: string
  /** Secondary accent color used for trim/cap/zips (hex). */
  accent: string
}

export interface Option<T extends string = string> {
  id: T
  name: string
}

export interface Swatch {
  id: string
  name: string
  hex: string
}

// ── Option lists ─────────────────────────────────────────────────────────────

export const FACE_SHAPES: Option<FaceShapeId>[] = [
  { id: 'round', name: 'Round' },
  { id: 'oval', name: 'Oval' },
  { id: 'square', name: 'Square' },
  { id: 'heart', name: 'Heart' },
]

export const SKIN_TONES: Swatch[] = [
  { id: 'porcelain', name: 'Porcelain', hex: '#F6D8C2' },
  { id: 'light', name: 'Light', hex: '#EFC0A0' },
  { id: 'tan', name: 'Tan', hex: '#D9A074' },
  { id: 'olive', name: 'Olive', hex: '#B57E52' },
  { id: 'brown', name: 'Brown', hex: '#8A5836' },
  { id: 'deep', name: 'Deep', hex: '#5C3621' },
]

export const HAIR_STYLES: Option<HairStyleId>[] = [
  { id: 'short', name: 'Short' },
  { id: 'long', name: 'Long' },
  { id: 'ponytail', name: 'Ponytail' },
  { id: 'spiky', name: 'Spiky' },
  { id: 'buzz', name: 'Buzz' },
  { id: 'bun', name: 'Bun' },
  { id: 'cap', name: 'Cap' },
]

export const HAIR_COLORS: Swatch[] = [
  { id: 'black', name: 'Black', hex: '#1B1A20' },
  { id: 'darkbrown', name: 'Dark Brown', hex: '#3A2418' },
  { id: 'brown', name: 'Brown', hex: '#6B4427' },
  { id: 'blonde', name: 'Blonde', hex: '#D9AE5A' },
  { id: 'auburn', name: 'Auburn', hex: '#8E3B1E' },
  { id: 'platinum', name: 'Platinum', hex: '#E8E2D2' },
  { id: 'teal', name: 'Teal', hex: '#1FB6A6' },
  { id: 'pink', name: 'Pink', hex: '#E85C9E' },
]

export const EYE_COLORS: Swatch[] = [
  { id: 'brown', name: 'Brown', hex: '#5A3A22' },
  { id: 'hazel', name: 'Hazel', hex: '#946B2D' },
  { id: 'green', name: 'Green', hex: '#3F8F5B' },
  { id: 'blue', name: 'Blue', hex: '#3B7DC4' },
  { id: 'gray', name: 'Gray', hex: '#6E7A86' },
  { id: 'violet', name: 'Violet', hex: '#7A5CC4' },
]

export const OUTFITS: Option<OutfitId>[] = [
  { id: 'racing', name: 'Racing Suit' },
  { id: 'hoodie', name: 'Hoodie' },
  { id: 'jacket', name: 'Jacket' },
  { id: 'tee', name: 'T-Shirt' },
  { id: 'overalls', name: 'Overalls' },
]

export const OUTFIT_COLORS: Swatch[] = [
  { id: 'ember', name: 'Ember', hex: '#F0522B' },
  { id: 'royal', name: 'Royal', hex: '#5B5BEF' },
  { id: 'viper', name: 'Viper', hex: '#2EC07A' },
  { id: 'sun', name: 'Sun', hex: '#F2B826' },
  { id: 'rose', name: 'Rose', hex: '#E8569E' },
  { id: 'ink', name: 'Ink', hex: '#2A2F3C' },
  { id: 'sky', name: 'Sky', hex: '#3FB6E8' },
  { id: 'cloud', name: 'Cloud', hex: '#E9EAF0' },
]

export const ACCENT_COLORS: Swatch[] = [
  { id: 'white', name: 'White', hex: '#F4F4F8' },
  { id: 'ember', name: 'Ember', hex: '#FF6A3D' },
  { id: 'gold', name: 'Gold', hex: '#F2C14E' },
  { id: 'cyan', name: 'Cyan', hex: '#37D7E8' },
  { id: 'violet', name: 'Violet', hex: '#9B6BEF' },
  { id: 'ink', name: 'Ink', hex: '#1B1E27' },
]

// ── Defaults + helpers ───────────────────────────────────────────────────────

export const DEFAULT_AVATAR: AvatarConfig = {
  faceShape: 'round',
  skinTone: SKIN_TONES[1].hex,
  hairStyle: 'short',
  hairColor: HAIR_COLORS[2].hex,
  eyeColor: EYE_COLORS[0].hex,
  outfit: 'racing',
  outfitColor: OUTFIT_COLORS[0].hex,
  accent: ACCENT_COLORS[0].hex,
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function randomAvatar(): AvatarConfig {
  return {
    faceShape: pick(FACE_SHAPES).id,
    skinTone: pick(SKIN_TONES).hex,
    hairStyle: pick(HAIR_STYLES).id,
    hairColor: pick(HAIR_COLORS).hex,
    eyeColor: pick(EYE_COLORS).hex,
    outfit: pick(OUTFITS).id,
    outfitColor: pick(OUTFIT_COLORS).hex,
    accent: pick(ACCENT_COLORS).hex,
  }
}

/**
 * Normalize an unknown persisted value (legacy string id, missing, or partial
 * object) into a complete AvatarConfig. Used by the store migration so old
 * profiles never crash.
 */
export function normalizeAvatar(raw: unknown): AvatarConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<AvatarConfig>
    return {
      faceShape: r.faceShape ?? DEFAULT_AVATAR.faceShape,
      skinTone: r.skinTone ?? DEFAULT_AVATAR.skinTone,
      hairStyle: r.hairStyle ?? DEFAULT_AVATAR.hairStyle,
      hairColor: r.hairColor ?? DEFAULT_AVATAR.hairColor,
      eyeColor: r.eyeColor ?? DEFAULT_AVATAR.eyeColor,
      outfit: r.outfit ?? DEFAULT_AVATAR.outfit,
      outfitColor: r.outfitColor ?? DEFAULT_AVATAR.outfitColor,
      accent: r.accent ?? DEFAULT_AVATAR.accent,
    }
  }
  // Legacy string id or undefined → default.
  return { ...DEFAULT_AVATAR }
}

// ── Legacy compatibility shim ────────────────────────────────────────────────
// game/RealCarModel.tsx (maintained by another pass) still imports AvatarSpec /
// avatarById and expects helmet/visor/suit/shape fields. We derive a sensible
// legacy spec from the new config so that file keeps compiling and rendering.

export type HelmetShape = 'round' | 'tall' | 'crested'

export interface AvatarSpec {
  id: string
  name: string
  helmet: string
  visor: string
  suit: string
  shape: HelmetShape
}

export function avatarById(config: AvatarConfig | string | undefined): AvatarSpec {
  const c = normalizeAvatar(config)
  const shape: HelmetShape =
    c.faceShape === 'oval' || c.faceShape === 'heart'
      ? 'tall'
      : c.faceShape === 'square'
        ? 'crested'
        : 'round'
  return {
    id: 'derived',
    name: 'Driver',
    helmet: c.outfitColor,
    visor: c.accent,
    suit: c.outfitColor,
    shape,
  }
}
