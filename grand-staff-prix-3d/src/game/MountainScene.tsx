import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Mountain Pass foreground. Instead of one tidy row of identical trees hugging
// the shoulder, this scatters a whole alpine field — pines of varied size and
// colour spread from the road edge out toward the horizon (dense near, thinning
// into the distance), plus boulders, shrubs, fallen logs and snow patches.
//
// Everything is instanced (a handful of draw calls for hundreds of objects) and
// world-fixed: each instance keeps a static world position and only teleports
// forward by one PERIOD once the car has driven PERIOD/2 past it. PERIOD is large
// enough that the teleport always happens deep in the fog (fog is full by ~380),
// so the recycle is never visible — no popping, no jerky seam joining the screen.

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

const N_PINE = 220
const N_ROCK = 50
const N_BUSH = 90
const N_SNOW = 70
const N_LOG = 16

interface Item {
  x: number
  zL: number // local Z within [0, PERIOD)
  s: number
  rot: number
  tint?: THREE.Color
}

// Nearest world-Z copy of a local position, kept within ±HALF of the car.
function lattice(zL: number, carZ: number): number {
  return zL + Math.round((carZ - zL) / PERIOD) * PERIOD
}

export function MountainScene() {
  // ---- scatter layout (built once) ---------------------------------------
  const { pines, rocks, bushes, snow, logs } = useMemo(() => {
    const rng = mulberry32(0x5eed)
    const side = () => (rng() < 0.5 ? -1 : 1)
    // X grows away from the road, biased dense near the shoulder (pow > 1).
    const scatterX = (reach: number, gap = 3) =>
      side() * (TRACK_HALF + gap + Math.pow(rng(), 1.7) * reach)

    const pineFoliage = () =>
      new THREE.Color().setHSL(0.30 + (rng() - 0.5) * 0.05, 0.40 + rng() * 0.18, 0.20 + rng() * 0.16)
    const bushFoliage = () =>
      new THREE.Color().setHSL(0.27 + (rng() - 0.5) * 0.06, 0.45 + rng() * 0.20, 0.30 + rng() * 0.14)
    const rockTone = () =>
      new THREE.Color().setHSL(0.09, 0.04 + rng() * 0.05, 0.40 + rng() * 0.24)

    const pines: Item[] = Array.from({ length: N_PINE }, () => ({
      x: scatterX(95),
      zL: rng() * PERIOD,
      s: 0.7 + rng() * 1.4,
      rot: rng() * Math.PI * 2,
      tint: pineFoliage(),
    }))
    const rocks: Item[] = Array.from({ length: N_ROCK }, () => ({
      x: scatterX(95, 2),
      zL: rng() * PERIOD,
      s: 0.5 + rng() * 2.0,
      rot: rng() * Math.PI * 2,
      tint: rockTone(),
    }))
    const bushes: Item[] = Array.from({ length: N_BUSH }, () => ({
      x: scatterX(75, 2),
      zL: rng() * PERIOD,
      s: 0.5 + rng() * 0.9,
      rot: rng() * Math.PI * 2,
      tint: bushFoliage(),
    }))
    const snow: Item[] = Array.from({ length: N_SNOW }, () => ({
      x: scatterX(88, 1),
      zL: rng() * PERIOD,
      s: 1.5 + rng() * 4.0,
      rot: rng() * Math.PI * 2,
    }))
    const logs: Item[] = Array.from({ length: N_LOG }, () => ({
      x: scatterX(55, 2),
      zL: rng() * PERIOD,
      s: 0.7 + rng() * 0.8,
      rot: rng() * Math.PI * 2,
    }))
    return { pines, rocks, bushes, snow, logs }
  }, [])

  // ---- geometry + materials (part offsets baked into the geometry so one
  //      per-instance matrix places every pine part consistently) ------------
  const assets = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.28, 0.34, 1.4, 6).translate(0, 0.7, 0)
    const c1 = new THREE.ConeGeometry(1.55, 2.4, 7).translate(0, 2.0, 0)
    const c2 = new THREE.ConeGeometry(1.1, 1.9, 7).translate(0, 3.2, 0)
    const c3 = new THREE.ConeGeometry(0.68, 1.4, 7).translate(0, 4.15, 0)
    const cap = new THREE.ConeGeometry(0.42, 0.8, 7).translate(0, 4.75, 0)
    const rock = new THREE.DodecahedronGeometry(0.9, 0).translate(0, 0.5, 0)
    const bush = new THREE.IcosahedronGeometry(0.7, 0).translate(0, 0.55, 0)
    const snow = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2).translate(0, 0.02, 0)
    const log = new THREE.CylinderGeometry(0.18, 0.22, 2.4, 7).rotateZ(Math.PI / 2).translate(0, 0.22, 0)

    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5a3b27', roughness: 0.9 })
    const foliageMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }) // tinted per-instance
    const snowCapMat = new THREE.MeshStandardMaterial({ color: '#f3f7fb', roughness: 0.6 })
    const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }) // tinted per-instance
    const bushMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }) // tinted per-instance
    const snowMat = new THREE.MeshStandardMaterial({ color: '#eef4fa', roughness: 0.7 })
    const logMat = new THREE.MeshStandardMaterial({ color: '#6b4a31', roughness: 0.95 })

    return {
      geo: { trunk, c1, c2, c3, cap, rock, bush, snow, log },
      mat: { trunkMat, foliageMat, snowCapMat, rockMat, bushMat, snowMat, logMat },
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
  const c1Ref = useRef<THREE.InstancedMesh>(null)
  const c2Ref = useRef<THREE.InstancedMesh>(null)
  const c3Ref = useRef<THREE.InstancedMesh>(null)
  const capRef = useRef<THREE.InstancedMesh>(null)
  const rockRef = useRef<THREE.InstancedMesh>(null)
  const bushRef = useRef<THREE.InstancedMesh>(null)
  const snowRef = useRef<THREE.InstancedMesh>(null)
  const logRef = useRef<THREE.InstancedMesh>(null)

  const pineRefs = useMemo(() => [trunkRef, c1Ref, c2Ref, c3Ref, capRef], [])
  const pineFoliageRefs = useMemo(() => [c1Ref, c2Ref, c3Ref], [])

  // remembered world-Z per instance per group (NaN forces a first build)
  const cur = useMemo(
    () => ({
      pine: new Float64Array(N_PINE).fill(NaN),
      rock: new Float64Array(N_ROCK).fill(NaN),
      bush: new Float64Array(N_BUSH).fill(NaN),
      snow: new Float64Array(N_SNOW).fill(NaN),
      log: new Float64Array(N_LOG).fill(NaN),
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
    stream(pineRefs, pines, cur.pine, carZ)
    stream([rockRef], rocks, cur.rock, carZ)
    stream([bushRef], bushes, cur.bush, carZ)
    stream([snowRef], snow, cur.snow, carZ)
    stream([logRef], logs, cur.log, carZ)
  }

  // per-instance tints (set once)
  useLayoutEffect(() => {
    pines.forEach((p, i) => p.tint && pineFoliageRefs.forEach((r) => r.current?.setColorAt(i, p.tint!)))
    rocks.forEach((p, i) => p.tint && rockRef.current?.setColorAt(i, p.tint))
    bushes.forEach((p, i) => p.tint && bushRef.current?.setColorAt(i, p.tint))
    for (const r of pineFoliageRefs) if (r.current?.instanceColor) r.current.instanceColor.needsUpdate = true
    if (rockRef.current?.instanceColor) rockRef.current.instanceColor.needsUpdate = true
    if (bushRef.current?.instanceColor) bushRef.current.instanceColor.needsUpdate = true
    // initial placement so nothing flashes at the origin before the first frame
    buildAll(carState.z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => buildAll(carState.z))

  const { geo, mat } = assets
  return (
    <>
      <instancedMesh ref={trunkRef} args={[geo.trunk, mat.trunkMat, N_PINE]} castShadow />
      <instancedMesh ref={c1Ref} args={[geo.c1, mat.foliageMat, N_PINE]} castShadow />
      <instancedMesh ref={c2Ref} args={[geo.c2, mat.foliageMat, N_PINE]} castShadow />
      <instancedMesh ref={c3Ref} args={[geo.c3, mat.foliageMat, N_PINE]} castShadow />
      <instancedMesh ref={capRef} args={[geo.cap, mat.snowCapMat, N_PINE]} />
      <instancedMesh ref={rockRef} args={[geo.rock, mat.rockMat, N_ROCK]} castShadow />
      <instancedMesh ref={bushRef} args={[geo.bush, mat.bushMat, N_BUSH]} castShadow />
      <instancedMesh ref={snowRef} args={[geo.snow, mat.snowMat, N_SNOW]} receiveShadow />
      <instancedMesh ref={logRef} args={[geo.log, mat.logMat, N_LOG]} castShadow />
    </>
  )
}
