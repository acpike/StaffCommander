import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Candy Canyon: a deliberately stylized candy world (no real-world equivalent).
// The painted candy backdrop (see Scenery.tsx) IS the canyon — sky, hills and far
// horizon. This file is just the streaming roadside foreground: the lollipops.

const POPS = 10
const POP_SPACING = 22
const POP_COLORS = ['#ff5fa2', '#ffd35c', '#5fe0c0', '#c79bff', '#ff8fc7', '#8fd0ff']
const POP_H = 3.4

function Lollipops() {
  const left = useRef<(THREE.Group | null)[]>([])
  const right = useRef<(THREE.Group | null)[]>([])
  // shared geometries + materials (perf: no per-lollipop allocation, no shadow casters)
  const stickGeo = useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, POP_H, 8), [])
  const discGeo = useMemo(() => new THREE.TorusGeometry(0.95, 0.42, 10, 18), [])
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.55, 12, 12), [])
  const stickMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff3fa', roughness: 0.5 }), [])
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 }), [])
  const colorMats = useMemo(() => POP_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.05 })), [])

  useFrame(() => {
    const baseline = (Math.floor(carState.z / POP_SPACING) + 2) * POP_SPACING
    for (let j = 0; j < POPS; j++) {
      const z = baseline - j * POP_SPACING
      const l = left.current[j]
      const r = right.current[j]
      if (l) l.position.z = z
      if (r) r.position.z = z
    }
  })
  const lolly = (key: string, side: number, j: number, ref: (g: THREE.Group | null) => void) => {
    const mat = colorMats[(j + (side > 0 ? 0 : 3)) % colorMats.length]
    return (
      <group key={key} ref={ref} position={[side * (TRACK_HALF + 3.5), 0, 0]}>
        <mesh position={[0, POP_H / 2, 0]} geometry={stickGeo} material={stickMat} />
        <mesh position={[0, POP_H + 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={discGeo} material={mat} />
        <mesh position={[0, POP_H + 1.1, 0.02]} geometry={sphereGeo} material={whiteMat} />
      </group>
    )
  }
  return (
    <>
      {Array.from({ length: POPS }).map((_, j) => lolly(`ll${j}`, 1, j, (g) => { left.current[j] = g }))}
      {Array.from({ length: POPS }).map((_, j) => lolly(`lr${j}`, -1, j, (g) => { right.current[j] = g }))}
    </>
  )
}

export function CandyScene() {
  return <Lollipops />
}
