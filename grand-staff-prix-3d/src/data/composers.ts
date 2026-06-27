// The roster of composer drivers. Each is a baked-texture character bust that
// rides in the open cockpit. Players pick one (and later unlock more). Rotation
// is per-bust (so it faces forward); seat position is per-car (in cars.ts).

export interface Composer {
  id: string
  name: string
  /** short era/blurb shown in the picker */
  era: string
  model: string
  /** Y rotation (radians) so the bust faces forward (-Z). */
  rotationY: number
  /** scale tweak relative to the default bust height. */
  scale: number
}

export const COMPOSERS: Composer[] = [
  { id: 'beethoven', name: 'Beethoven', era: 'Classical → Romantic', model: '/models/composer_beethoven.glb', rotationY: Math.PI / 2, scale: 1 },
  { id: 'mozart', name: 'Mozart', era: 'Classical', model: '/models/composer_mozart.glb', rotationY: Math.PI / 2, scale: 1 },
  { id: 'clara', name: 'Clara Schumann', era: 'Romantic', model: '/models/composer_clara.glb', rotationY: Math.PI / 2, scale: 1 },
  { id: 'hildegard', name: 'Hildegard von Bingen', era: 'Medieval', model: '/models/composer_hildegard.glb', rotationY: Math.PI / 2, scale: 1 },
  { id: 'joplin', name: 'Scott Joplin', era: 'Ragtime', model: '/models/composer_joplin.glb', rotationY: Math.PI / 2, scale: 1 },
]

export function composerById(id: string): Composer {
  return COMPOSERS.find((c) => c.id === id) ?? COMPOSERS[0]
}
