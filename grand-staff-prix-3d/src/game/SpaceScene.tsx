import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Deep Space foreground. The painted galaxy backdrop, planets and follow-stars
// (see Scenery.tsx) give the deep field; this layer flanks the road with a
// scattered alien field — glowing crystal spires of varied size and colour,
// asteroids / space rocks, and small floating shards — spread from the road edge
// out toward the horizon (dense near, thinning into the distance), fading into the
// dark fog.
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

const N_CRYSTAL = 100
const N_ROCK = 120
const N_SHARD = 70

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

export function SpaceScene() {
  // ---- scatter layout (built once) ---------------------------------------
  const { crystals, rocks, shards } = useMemo(() => {
    const rng = mulberry32(0x5face)
    const side = () => (rng() < 0.5 ? -1 : 1)
    // X grows away from the road, biased dense near the shoulder (pow > 1).
    const scatterX = (reach: number, gap = 3) =>
      side() * (TRACK_HALF + gap + Math.pow(rng(), 1.7) * reach)

    // Cool indigo → violet → cyan glow for the crystals and shards.
    const crystalTone = () =>
      new THREE.Color().setHSL(0.70 + (rng() - 0.5) * 0.13, 0.6 + rng() * 0.3, 0.5 + rng() * 0.18)
    const shardTone = () =>
      new THREE.Color().setHSL(0.68 + (rng() - 0.5) * 0.12, 0.55 + rng() * 0.3, 0.55 + rng() * 0.18)
    // Asteroids: dark, desaturated purple-grey.
    const rockTone = () =>
      new THREE.Color().setHSL(0.72, 0.08 + rng() * 0.12, 0.16 + rng() * 0.12)

    const crystals: Item[] = Array.from({ length: N_CRYSTAL }, () => ({
      x: scatterX(92),
      zL: rng() * PERIOD,
      s: 0.7 + rng() * 1.6,
      rot: rng() * Math.PI * 2,
      tint: crystalTone(),
    }))
    const rocks: Item[] = Array.from({ length: N_ROCK }, () => ({
      x: scatterX(100, 2),
      zL: rng() * PERIOD,
      s: 0.3 + rng() * 2.4, // pebbles → boulders
      rot: rng() * Math.PI * 2,
      tint: rockTone(),
    }))
    const shards: Item[] = Array.from({ length: N_SHARD }, () => ({
      x: scatterX(88, 1),
      zL: rng() * PERIOD,
      s: 0.5 + rng() * 1.3, // scale also lifts the baked float height
      rot: rng() * Math.PI * 2,
      tint: shardTone(),
    }))
    return { crystals, rocks, shards }
  }, [])

  // ---- geometry + materials (crystal part offsets baked into the geometry so
  //      one per-instance matrix places the whole cluster) -------------------
  const assets = useMemo(() => {
    // crystal cluster: a tall central spire + a shorter offset spire
    const spire = new THREE.OctahedronGeometry(0.8, 0).scale(0.55, 1.7, 0.55).translate(0, 1.35, 0)
    const spire2 = new THREE.OctahedronGeometry(0.55, 0).scale(0.5, 1.4, 0.5).translate(0.55, 0.85, 0.2)
    const rock = new THREE.DodecahedronGeometry(1.0, 0).translate(0, 0.6, 0)
    // floating shard: small tetra baked high off the ground (scale lifts it more)
    const shard = new THREE.TetrahedronGeometry(0.5, 0).translate(0, 3.0, 0)

    const crystalMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // tinted per-instance
      emissive: '#5a3df0',
      emissiveIntensity: 0.95,
      roughness: 0.25,
      metalness: 0.1,
    })
    const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }) // tinted per-instance
    const shardMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // tinted per-instance
      emissive: '#6f5bff',
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.1,
    })

    return {
      geo: { spire, spire2, rock, shard },
      mat: { crystalMat, rockMat, shardMat },
    }
  }, [])

  useEffect(() => {
    return () => {
      Object.values(assets.geo).forEach((g) => g.dispose())
      Object.values(assets.mat).forEach((m) => m.dispose())
    }
  }, [assets])

  // ---- instanced mesh refs ------------------------------------------------
  const spireRef = useRef<THREE.InstancedMesh>(null)
  const spire2Ref = useRef<THREE.InstancedMesh>(null)
  const rockRef = useRef<THREE.InstancedMesh>(null)
  const shardRef = useRef<THREE.InstancedMesh>(null)

  const crystalRefs = useMemo(() => [spireRef, spire2Ref], [])

  // remembered world-Z per instance per group (NaN forces a first build)
  const cur = useMemo(
    () => ({
      crystal: new Float64Array(N_CRYSTAL).fill(NaN),
      rock: new Float64Array(N_ROCK).fill(NaN),
      shard: new Float64Array(N_SHARD).fill(NaN),
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
    stream(crystalRefs, crystals, cur.crystal, carZ)
    stream([rockRef], rocks, cur.rock, carZ)
    stream([shardRef], shards, cur.shard, carZ)
  }

  // per-instance tints (set once)
  useLayoutEffect(() => {
    crystals.forEach((c, i) => c.tint && crystalRefs.forEach((r) => r.current?.setColorAt(i, c.tint!)))
    rocks.forEach((c, i) => c.tint && rockRef.current?.setColorAt(i, c.tint))
    shards.forEach((c, i) => c.tint && shardRef.current?.setColorAt(i, c.tint))
    for (const r of crystalRefs) if (r.current?.instanceColor) r.current.instanceColor.needsUpdate = true
    if (rockRef.current?.instanceColor) rockRef.current.instanceColor.needsUpdate = true
    if (shardRef.current?.instanceColor) shardRef.current.instanceColor.needsUpdate = true
    // initial placement so nothing flashes at the origin before the first frame
    buildAll(carState.z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => buildAll(carState.z))

  const { geo, mat } = assets
  return (
    <>
      <instancedMesh frustumCulled={false} ref={spireRef} args={[geo.spire, mat.crystalMat, N_CRYSTAL]} castShadow />
      <instancedMesh frustumCulled={false} ref={spire2Ref} args={[geo.spire2, mat.crystalMat, N_CRYSTAL]} castShadow />
      <instancedMesh frustumCulled={false} ref={rockRef} args={[geo.rock, mat.rockMat, N_ROCK]} castShadow />
      <instancedMesh frustumCulled={false} ref={shardRef} args={[geo.shard, mat.shardMat, N_SHARD]} />
    </>
  )
}
