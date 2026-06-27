import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Desert Run foreground. Instead of one tidy row of identical cacti hugging the
// road, this scatters a desert field — saguaro cacti of varied size + colour,
// boulders and pebbles, and dry brush — spread from the shoulder out toward the
// horizon (dense near, thinning into the distance). The big mesas/buttes are left
// to the painted backdrop, so the 3D layer doesn't duplicate them.
//
// Everything is instanced (a handful of draw calls for hundreds of objects) and
// world-fixed: each instance keeps a static world position and only teleports
// forward by one PERIOD once the car drives PERIOD/2 past it. PERIOD is large
// enough that the teleport always happens deep in the fog, so the recycle is
// never visible — no popping, no jerky seam. (The ground reaches past the fog, so
// distant props sit on the ground rather than floating — see Track.tsx.)

const PERIOD = 1000 // streaming repeat length along Z (seam hides in fog at ±PERIOD/2)

// Deterministic PRNG so the scatter is stable across renders (no reshuffle).
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const N_CACTUS = 90
const N_ROCK = 120
const N_BRUSH = 110

interface Item {
  x: number
  zL: number // local Z within [0, PERIOD)
  s: number
  rot: number
  tint?: THREE.Color
}

// Nearest world-Z copy of a local position, kept within ±PERIOD/2 of the car.
function lattice(zL: number, carZ: number): number {
  return zL + Math.round((carZ - zL) / PERIOD) * PERIOD
}

export function DesertScene() {
  // ---- scatter layout (built once) ---------------------------------------
  const { cacti, rocks, brush } = useMemo(() => {
    const rng = mulberry32(0xca7c5)
    const side = () => (rng() < 0.5 ? -1 : 1)
    const scatterX = (reach: number, gap = 3) =>
      side() * (TRACK_HALF + gap + Math.pow(rng(), 1.7) * reach)

    const cactusTone = () =>
      new THREE.Color().setHSL(0.29 + (rng() - 0.5) * 0.04, 0.34 + rng() * 0.16, 0.24 + rng() * 0.12)
    const rockTone = () =>
      new THREE.Color().setHSL(0.08, 0.22 + rng() * 0.18, 0.40 + rng() * 0.20)
    const brushTone = () =>
      new THREE.Color().setHSL(0.12, 0.22 + rng() * 0.18, 0.34 + rng() * 0.14)

    const cacti: Item[] = Array.from({ length: N_CACTUS }, () => ({
      x: scatterX(92),
      zL: rng() * PERIOD,
      s: 0.7 + rng() * 0.9,
      rot: rng() * Math.PI * 2,
      tint: cactusTone(),
    }))
    const rocks: Item[] = Array.from({ length: N_ROCK }, () => ({
      x: scatterX(100, 2),
      zL: rng() * PERIOD,
      s: 0.3 + rng() * 2.2, // pebbles → boulders
      rot: rng() * Math.PI * 2,
      tint: rockTone(),
    }))
    const brush: Item[] = Array.from({ length: N_BRUSH }, () => ({
      x: scatterX(88, 1),
      zL: rng() * PERIOD,
      s: 0.5 + rng() * 1.0,
      rot: rng() * Math.PI * 2,
      tint: brushTone(),
    }))
    return { cacti, rocks, brush }
  }, [])

  // ---- geometry + materials (saguaro part offsets baked into the geometry so
  //      one per-instance matrix places the whole cactus) --------------------
  const assets = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.45, 0.52, 4.6, 8).translate(0, 2.3, 0)
    const armHL = new THREE.CylinderGeometry(0.28, 0.28, 1.0, 7).rotateZ(Math.PI / 2).translate(-0.5, 2.6, 0)
    const armVL = new THREE.CylinderGeometry(0.3, 0.32, 1.8, 7).translate(-0.95, 3.4, 0)
    const armHR = new THREE.CylinderGeometry(0.28, 0.28, 1.0, 7).rotateZ(Math.PI / 2).translate(0.5, 3.4, 0)
    const armVR = new THREE.CylinderGeometry(0.3, 0.32, 1.8, 7).translate(0.95, 4.2, 0)
    const rock = new THREE.DodecahedronGeometry(1.0, 0).translate(0, 0.6, 0)
    const brush = new THREE.IcosahedronGeometry(0.7, 0).scale(1, 0.7, 1).translate(0, 0.45, 0)

    const cactusMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }) // tinted per-instance
    const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 })
    const brushMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })

    return {
      geo: { trunk, armHL, armVL, armHR, armVR, rock, brush },
      mat: { cactusMat, rockMat, brushMat },
    }
  }, [])

  useEffect(() => {
    return () => {
      Object.values(assets.geo).forEach((g) => g.dispose())
      Object.values(assets.mat).forEach((m) => m.dispose())
    }
  }, [assets])

  // ---- instanced mesh refs ------------------------------------------------
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const aHLRef = useRef<THREE.InstancedMesh>(null)
  const aVLRef = useRef<THREE.InstancedMesh>(null)
  const aHRRef = useRef<THREE.InstancedMesh>(null)
  const aVRRef = useRef<THREE.InstancedMesh>(null)
  const rockRef = useRef<THREE.InstancedMesh>(null)
  const brushRef = useRef<THREE.InstancedMesh>(null)

  const cactusRefs = useMemo(() => [trunkRef, aHLRef, aVLRef, aHRRef, aVRRef], [])

  const cur = useMemo(
    () => ({
      cactus: new Float64Array(N_CACTUS).fill(NaN),
      rock: new Float64Array(N_ROCK).fill(NaN),
      brush: new Float64Array(N_BRUSH).fill(NaN),
    }),
    [],
  )

  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Reposition only the instances whose nearest lattice copy changed this frame;
  // upload the buffer only if at least one moved. Static between recycles → cheap.
  const stream = (refs: React.RefObject<THREE.InstancedMesh | null>[], items: Item[], mem: Float64Array, carZ: number) => {
    let dirty = false
    for (let i = 0; i < items.length; i++) {
      const wz = lattice(items[i].zL, carZ)
      if (wz === mem[i]) continue
      mem[i] = wz
      dummy.position.set(items[i].x, 0, wz)
      dummy.rotation.set(0, items[i].rot, 0)
      dummy.scale.setScalar(items[i].s)
      dummy.updateMatrix()
      for (const r of refs) r.current?.setMatrixAt(i, dummy.matrix)
      dirty = true
    }
    if (dirty) for (const r of refs) if (r.current) r.current.instanceMatrix.needsUpdate = true
  }

  const buildAll = (carZ: number) => {
    stream(cactusRefs, cacti, cur.cactus, carZ)
    stream([rockRef], rocks, cur.rock, carZ)
    stream([brushRef], brush, cur.brush, carZ)
  }

  // per-instance tints (set once)
  useLayoutEffect(() => {
    cacti.forEach((c, i) => c.tint && cactusRefs.forEach((r) => r.current?.setColorAt(i, c.tint!)))
    rocks.forEach((c, i) => c.tint && rockRef.current?.setColorAt(i, c.tint))
    brush.forEach((c, i) => c.tint && brushRef.current?.setColorAt(i, c.tint))
    for (const r of cactusRefs) if (r.current?.instanceColor) r.current.instanceColor.needsUpdate = true
    if (rockRef.current?.instanceColor) rockRef.current.instanceColor.needsUpdate = true
    if (brushRef.current?.instanceColor) brushRef.current.instanceColor.needsUpdate = true
    buildAll(carState.z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => buildAll(carState.z))

  const { geo, mat } = assets
  return (
    <>
      <instancedMesh ref={trunkRef} args={[geo.trunk, mat.cactusMat, N_CACTUS]} castShadow />
      <instancedMesh ref={aHLRef} args={[geo.armHL, mat.cactusMat, N_CACTUS]} castShadow />
      <instancedMesh ref={aVLRef} args={[geo.armVL, mat.cactusMat, N_CACTUS]} castShadow />
      <instancedMesh ref={aHRRef} args={[geo.armHR, mat.cactusMat, N_CACTUS]} castShadow />
      <instancedMesh ref={aVRRef} args={[geo.armVR, mat.cactusMat, N_CACTUS]} castShadow />
      <instancedMesh ref={rockRef} args={[geo.rock, mat.rockMat, N_ROCK]} castShadow />
      <instancedMesh ref={brushRef} args={[geo.brush, mat.brushMat, N_BRUSH]} castShadow />
    </>
  )
}
