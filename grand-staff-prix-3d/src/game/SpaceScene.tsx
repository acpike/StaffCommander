import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Deep Space foreground. The painted galaxy backdrop, planets and follow-stars
// (see Scenery.tsx) give the deep field; this layer flanks the light-bridge with a
// free-floating debris field — compact glowing crystal clusters and tumbling
// asteroid chunks — drifting in true 3D: spread sideways from the lane edge AND
// vertically above and below it, each at a random 3D orientation, dense near the
// lane and thinning into the dark fog. Nothing stands on the ground (there is no
// ground in space — see Track.tsx); everything floats.
//
// Everything is instanced (a handful of draw calls for hundreds of objects) and
// world-fixed: each instance keeps a static world position and only teleports
// forward by one PERIOD once the car drives PERIOD/2 past it. PERIOD is large
// enough that the teleport always happens deep in the fog, so the recycle is
// never visible — no popping, no jerky seam.

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

const N_CRYSTAL = 70
const N_ROCK = 110

interface Item {
  x: number
  y: number // floating height above/below the lane
  zL: number // local Z within [0, PERIOD)
  s: number
  rx: number // static random 3D orientation
  ry: number
  rz: number
  tint?: THREE.Color
}

// Nearest world-Z copy of a local position, kept within ±PERIOD/2 of the car.
function lattice(zL: number, carZ: number): number {
  return zL + Math.round((carZ - zL) / PERIOD) * PERIOD
}

export function SpaceScene() {
  // ---- scatter layout (built once) ---------------------------------------
  const { crystals, rocks } = useMemo(() => {
    const rng = mulberry32(0x5face)
    const side = () => (rng() < 0.5 ? -1 : 1)
    // X grows away from the lane, biased dense near the shoulder (pow > 1). The
    // gap keeps everything clear of the lane path so it never blocks gameplay.
    const scatterX = (reach: number, gap = 3) =>
      side() * (TRACK_HALF + gap + Math.pow(rng(), 1.7) * reach)
    // Y floats above AND below the lane — a true 3D field, not a horizon line.
    const scatterY = () => -28 + rng() * 56
    // A full random 3D orientation (static): reads as a drifting tumble field.
    const spin3 = () => rng() * Math.PI * 2

    // Cool indigo → violet → cyan glow for the crystals and shards.
    const crystalTone = () =>
      new THREE.Color().setHSL(0.70 + (rng() - 0.5) * 0.13, 0.6 + rng() * 0.3, 0.5 + rng() * 0.18)
    // Asteroids: dark, desaturated purple-grey.
    const rockTone = () =>
      new THREE.Color().setHSL(0.72, 0.08 + rng() * 0.12, 0.16 + rng() * 0.12)

    const crystals: Item[] = Array.from({ length: N_CRYSTAL }, () => ({
      x: scatterX(92),
      y: scatterY(),
      zL: rng() * PERIOD,
      s: 0.7 + rng() * 1.6,
      rx: spin3(), ry: spin3(), rz: spin3(),
      tint: crystalTone(),
    }))
    const rocks: Item[] = Array.from({ length: N_ROCK }, () => ({
      x: scatterX(100, 2),
      y: scatterY(),
      zL: rng() * PERIOD,
      s: 0.3 + rng() * 2.4, // pebbles → boulders
      rx: spin3(), ry: spin3(), rz: spin3(),
      tint: rockTone(),
    }))
    return { crystals, rocks }
  }, [])

  // ---- geometry + materials (crystal part offsets baked into the geometry so
  //      one per-instance matrix places the whole cluster) -------------------
  const assets = useMemo(() => {
    // compact floating crystal cluster: two stubby shards around the origin (no
    // tall spire, no ground offset — these free-float and tumble in 3D).
    const spire = new THREE.OctahedronGeometry(0.8, 0).scale(0.7, 1.05, 0.7)
    const spire2 = new THREE.OctahedronGeometry(0.5, 0).translate(0.5, 0.2, 0.18)
    // asteroid chunk: a dodecahedron centred on the origin (free-floating).
    const rock = new THREE.DodecahedronGeometry(1.0, 0)

    const crystalMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // tinted per-instance
      emissive: '#5a3df0',
      emissiveIntensity: 0.95,
      roughness: 0.25,
      metalness: 0.1,
    })
    const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }) // tinted per-instance

    return {
      geo: { spire, spire2, rock },
      mat: { crystalMat, rockMat },
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

  const crystalRefs = useMemo(() => [spireRef, spire2Ref], [])

  // remembered world-Z per instance per group (NaN forces a first build)
  const cur = useMemo(
    () => ({
      crystal: new Float64Array(N_CRYSTAL).fill(NaN),
      rock: new Float64Array(N_ROCK).fill(NaN),
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
      dummy.position.set(items[i].x, items[i].y, wz)
      dummy.rotation.set(items[i].rx, items[i].ry, items[i].rz)
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
  }

  // per-instance tints (set once)
  useLayoutEffect(() => {
    crystals.forEach((c, i) => c.tint && crystalRefs.forEach((r) => r.current?.setColorAt(i, c.tint!)))
    rocks.forEach((c, i) => c.tint && rockRef.current?.setColorAt(i, c.tint))
    for (const r of crystalRefs) if (r.current?.instanceColor) r.current.instanceColor.needsUpdate = true
    if (rockRef.current?.instanceColor) rockRef.current.instanceColor.needsUpdate = true
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
    </>
  )
}
