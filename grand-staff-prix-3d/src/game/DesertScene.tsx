import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Desert Run foreground: streaming saguaro cacti, boulders and the occasional
// mesa flanking the road, over the real semi-desert HDRI. Lean: shared geometry,
// no shadow-casters, modest count (perf guardrail).

const ITEMS = 11
const SPACING = 17

export function DesertScene() {
  const geo = useMemo(
    () => ({
      trunk: new THREE.CylinderGeometry(0.45, 0.52, 4.6, 8),
      armV: new THREE.CylinderGeometry(0.3, 0.32, 1.8, 7),
      armH: new THREE.CylinderGeometry(0.28, 0.28, 1.0, 7),
      rock: new THREE.DodecahedronGeometry(1.0, 0),
      mesa: new THREE.CylinderGeometry(2.4, 3.0, 3.4, 6),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      cactus: new THREE.MeshStandardMaterial({ color: '#4a7a45', roughness: 0.85 }),
      rock: new THREE.MeshStandardMaterial({ color: '#b0875a', roughness: 1 }),
      mesa: new THREE.MeshStandardMaterial({ color: '#c4895a', roughness: 1 }),
    }),
    [],
  )

  const left = useRef<(THREE.Group | null)[]>([])
  const right = useRef<(THREE.Group | null)[]>([])
  const variant = useMemo(
    () =>
      Array.from({ length: ITEMS * 2 }, (_, i) => ({
        off: 2.5 + ((i * 5) % 5) * 1.6,
        scale: 0.85 + ((i * 7) % 5) * 0.12,
        kind: i % 7 === 6 ? 'mesa' : i % 4 === 3 ? 'rock' : 'cactus',
      })),
    [],
  )

  useFrame(() => {
    const baseline = (Math.floor(carState.z / SPACING) + 2) * SPACING
    for (let j = 0; j < ITEMS; j++) {
      const z = baseline - j * SPACING
      const l = left.current[j]
      const r = right.current[j]
      if (l) l.position.z = z
      if (r) r.position.z = z
    }
  })

  const cactus = (
    <group>
      <mesh position={[0, 2.3, 0]} geometry={geo.trunk} material={mats.cactus} />
      {/* left arm */}
      <mesh position={[-0.5, 2.6, 0]} rotation={[0, 0, Math.PI / 2]} geometry={geo.armH} material={mats.cactus} />
      <mesh position={[-0.95, 3.4, 0]} geometry={geo.armV} material={mats.cactus} />
      {/* right arm (higher) */}
      <mesh position={[0.5, 3.4, 0]} rotation={[0, 0, Math.PI / 2]} geometry={geo.armH} material={mats.cactus} />
      <mesh position={[0.95, 4.2, 0]} geometry={geo.armV} material={mats.cactus} />
    </group>
  )

  const item = (side: number, j: number, ref: (g: THREE.Group | null) => void) => {
    const v = variant[side > 0 ? j : ITEMS + j]
    const x = side * (TRACK_HALF + v.off)
    return (
      <group key={`${side}-${j}`} ref={ref} position={[x, 0, 0]} scale={v.scale}>
        {v.kind === 'mesa' ? (
          <mesh position={[0, 1.7, 0]} geometry={geo.mesa} material={mats.mesa} />
        ) : v.kind === 'rock' ? (
          <mesh position={[0, 0.6, 0]} geometry={geo.rock} material={mats.rock} />
        ) : (
          cactus
        )}
      </group>
    )
  }

  return (
    <>
      {Array.from({ length: ITEMS }).map((_, j) => item(1, j, (g) => { left.current[j] = g }))}
      {Array.from({ length: ITEMS }).map((_, j) => item(-1, j, (g) => { right.current[j] = g }))}
    </>
  )
}
