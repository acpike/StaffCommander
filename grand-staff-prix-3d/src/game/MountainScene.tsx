import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Mountain Pass foreground: streaming snow-dusted pine trees + the occasional
// boulder flanking the road. The real alpine mountains + sun come from the HDRI;
// these give the "trees + snow" the name promises. Stylized but clearly pines.

const TREES = 11
const SPACING = 16

const trunkMat = () => new THREE.MeshStandardMaterial({ color: '#5a3b27', roughness: 0.9 })
const pineMat = () => new THREE.MeshStandardMaterial({ color: '#2f5d39', roughness: 0.85 })
const snowMat = () => new THREE.MeshStandardMaterial({ color: '#f3f7fb', roughness: 0.6 })
const rockMat = () => new THREE.MeshStandardMaterial({ color: '#8b8f96', roughness: 1 })

// Shared geometries so all trees reuse a handful of buffers (cheap).
function Pine({ mats, geo }: {
  mats: { trunk: THREE.Material; pine: THREE.Material; snow: THREE.Material }
  geo: { trunk: THREE.BufferGeometry; c1: THREE.BufferGeometry; c2: THREE.BufferGeometry; c3: THREE.BufferGeometry; cap: THREE.BufferGeometry }
}) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]} geometry={geo.trunk} material={mats.trunk} />
      <mesh position={[0, 2.0, 0]} geometry={geo.c1} material={mats.pine} />
      <mesh position={[0, 3.2, 0]} geometry={geo.c2} material={mats.pine} />
      <mesh position={[0, 4.15, 0]} geometry={geo.c3} material={mats.pine} />
      <mesh position={[0, 4.75, 0]} geometry={geo.cap} material={mats.snow} />
    </group>
  )
}

export function MountainScene() {
  const mats = useMemo(() => ({ trunk: trunkMat(), pine: pineMat(), snow: snowMat() }), [])
  const rock = useMemo(rockMat, [])
  const geo = useMemo(
    () => ({
      trunk: new THREE.CylinderGeometry(0.28, 0.34, 1.4, 6),
      c1: new THREE.ConeGeometry(1.55, 2.4, 7),
      c2: new THREE.ConeGeometry(1.1, 1.9, 7),
      c3: new THREE.ConeGeometry(0.68, 1.4, 7),
      cap: new THREE.ConeGeometry(0.42, 0.8, 7),
      rock: new THREE.DodecahedronGeometry(0.9, 0),
    }),
    [],
  )
  const left = useRef<(THREE.Group | null)[]>([])
  const right = useRef<(THREE.Group | null)[]>([])

  // deterministic per-slot variation
  const variant = useMemo(
    () =>
      Array.from({ length: TREES * 2 }, (_, i) => ({
        off: 2 + ((i * 5) % 5) * 1.4, // distance from the shoulder
        scale: 0.8 + ((i * 7) % 6) * 0.12,
        rock: i % 6 === 5,
      })),
    [],
  )

  useFrame(() => {
    const baseline = (Math.floor(carState.z / SPACING) + 2) * SPACING
    for (let j = 0; j < TREES; j++) {
      const z = baseline - j * SPACING
      const l = left.current[j]
      const r = right.current[j]
      if (l) l.position.z = z
      if (r) r.position.z = z
    }
  })

  const item = (side: number, j: number, ref: (g: THREE.Group | null) => void) => {
    const v = variant[side > 0 ? j : TREES + j]
    const x = side * (TRACK_HALF + v.off)
    return (
      <group key={`${side}-${j}`} ref={ref} position={[x, 0, 0]} scale={v.scale}>
        {v.rock ? (
          <mesh position={[0, 0.5, 0]} geometry={geo.rock} material={rock} />
        ) : (
          <Pine mats={mats} geo={geo} />
        )}
      </group>
    )
  }

  return (
    <>
      {Array.from({ length: TREES }).map((_, j) => item(1, j, (g) => { left.current[j] = g }))}
      {Array.from({ length: TREES }).map((_, j) => item(-1, j, (g) => { right.current[j] = g }))}
    </>
  )
}
