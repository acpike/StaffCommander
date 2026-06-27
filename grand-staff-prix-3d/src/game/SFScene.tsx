import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'
import { Terrain } from './Terrain'

// San Francisco foreground — the MARIN HEADLANDS approach to the city. The road
// winds through open, golden-green coastal hills; the Golden Gate + SF skyline
// live ONLY in the painted backdrop (Scenery.tsx) on the horizon, so we never
// duplicate them in the 3D layer (you can't drive across the bridge AND look at
// it). Two layers:
//
//   1. Rolling golden-green hills flanking both shoulders (Terrain.tsx's displaced
//      streaming strips, tinted a sun-dried grass green/gold and given real relief
//      so the headland undulates and fog-fades into the warm sunset horizon).
//
//   2. A scattered instanced coastal field ON/AROUND the hills — wind-bent
//      Monterey cypress, low sage scrub, grey rock outcrops and dry golden grass
//      tufts. Dense near the shoulder, thinning into the fog. NO buildings, NO
//      bridge, NO city props. Kept calm and uncluttered so the note gates + staff
//      card stay legible.
//
// Everything in layer 2 is instanced (a few draw calls for hundreds of objects)
// and world-fixed: each instance keeps a static world position and only teleports
// forward by one PERIOD once the car drives PERIOD/2 past it — always deep in the
// fog, so the recycle is never visible. (The ground reaches past the fog, so
// distant props sit on the ground rather than floating — see Track.tsx.)

// Golden-green sun-dried grass for the rolling headland hills, with real relief.
const HILL_COLOR = '#9EA356'
const HILL_AMPLITUDE = 8

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

const N_CYPRESS = 70 // iconic wind-bent Monterey cypress (landmark, not a forest)
const N_SHRUB = 130 // low coastal scrub / sage
const N_ROCK = 60 // grey rock outcrops
const N_GRASS = 120 // dry golden grass tufts for texture

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

export function SFScene() {
  // ---- scatter layout (built once) ---------------------------------------
  const { cypress, shrubs, rocks, grass } = useMemo(() => {
    const rng = mulberry32(0x5f0c)
    const side = () => (rng() < 0.5 ? -1 : 1)
    // X grows away from the road, biased dense near the shoulder (pow > 1) so the
    // near band stays readable and the field thins into the distance.
    const scatterX = (reach: number, gap = 3) =>
      side() * (TRACK_HALF + gap + Math.pow(rng(), 1.7) * reach)

    // Monterey cypress: deep coastal green, slight hue/lightness variation.
    const cypressTone = () =>
      new THREE.Color().setHSL(0.33 + (rng() - 0.5) * 0.04, 0.34 + rng() * 0.16, 0.16 + rng() * 0.08)
    // Scrub: muted olive / sage.
    const shrubTone = () =>
      new THREE.Color().setHSL(0.22 + (rng() - 0.5) * 0.05, 0.30 + rng() * 0.18, 0.28 + rng() * 0.12)
    // Rock: near-neutral grey, faint warm cast.
    const rockTone = () =>
      new THREE.Color().setHSL(0.09, 0.03 + rng() * 0.05, 0.42 + rng() * 0.22)
    // Dry grass tufts: sun-bleached gold.
    const grassTone = () =>
      new THREE.Color().setHSL(0.13 + (rng() - 0.5) * 0.03, 0.45 + rng() * 0.20, 0.42 + rng() * 0.14)

    const cypress: Item[] = Array.from({ length: N_CYPRESS }, () => ({
      x: scatterX(90),
      zL: rng() * PERIOD,
      s: 0.7 + rng() * 0.8,
      rot: rng() * Math.PI * 2, // randomises which way the baked windward lean faces
      tint: cypressTone(),
    }))
    const shrubs: Item[] = Array.from({ length: N_SHRUB }, () => ({
      x: scatterX(95, 2),
      zL: rng() * PERIOD,
      s: 0.5 + rng() * 0.9,
      rot: rng() * Math.PI * 2,
      tint: shrubTone(),
    }))
    const rocks: Item[] = Array.from({ length: N_ROCK }, () => ({
      x: scatterX(100, 2),
      zL: rng() * PERIOD,
      s: 0.4 + rng() * 1.8,
      rot: rng() * Math.PI * 2,
      tint: rockTone(),
    }))
    const grass: Item[] = Array.from({ length: N_GRASS }, () => ({
      x: scatterX(85, 1),
      zL: rng() * PERIOD,
      s: 0.6 + rng() * 0.9,
      rot: rng() * Math.PI * 2,
      tint: grassTone(),
    }))
    return { cypress, shrubs, rocks, grass }
  }, [])

  // ---- geometry + materials (cypress part offsets baked into the geometry so
  //      one per-instance matrix places the whole leaning tree) ---------------
  const assets = useMemo(() => {
    // Wind-bent Monterey cypress: a slightly leaning trunk under a wide, FLAT,
    // overhanging canopy. The lean + canopy offset are baked in +x; a per-instance
    // Y-rotation then points that windward lean in a random compass direction.
    const trunk = new THREE.CylinderGeometry(0.14, 0.24, 2.6, 6).translate(0, 1.3, 0).rotateZ(-0.14)
    const canopy1 = new THREE.IcosahedronGeometry(1, 0).scale(2.4, 0.7, 1.9).translate(0.6, 2.7, 0)
    const canopy2 = new THREE.IcosahedronGeometry(1, 0).scale(1.5, 0.55, 1.3).translate(1.05, 3.1, 0)
    const shrub = new THREE.IcosahedronGeometry(0.62, 0).scale(1.1, 0.8, 1.1).translate(0, 0.46, 0)
    const rock = new THREE.DodecahedronGeometry(0.85, 0).translate(0, 0.42, 0)
    const grassTuft = new THREE.ConeGeometry(0.34, 1.0, 4).translate(0, 0.5, 0)

    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5436', roughness: 0.95 })
    const cypressMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }) // tinted per-instance
    const shrubMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }) // tinted per-instance
    const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }) // tinted per-instance
    const grassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }) // tinted per-instance

    return {
      geo: { trunk, canopy1, canopy2, shrub, rock, grassTuft },
      mat: { trunkMat, cypressMat, shrubMat, rockMat, grassMat },
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
  const can1Ref = useRef<THREE.InstancedMesh>(null)
  const can2Ref = useRef<THREE.InstancedMesh>(null)
  const shrubRef = useRef<THREE.InstancedMesh>(null)
  const rockRef = useRef<THREE.InstancedMesh>(null)
  const grassRef = useRef<THREE.InstancedMesh>(null)

  const cypressRefs = useMemo(() => [trunkRef, can1Ref, can2Ref], [])
  const cypressFoliageRefs = useMemo(() => [can1Ref, can2Ref], [])

  // remembered world-Z per instance per group (NaN forces a first build)
  const cur = useMemo(
    () => ({
      cypress: new Float64Array(N_CYPRESS).fill(NaN),
      shrub: new Float64Array(N_SHRUB).fill(NaN),
      rock: new Float64Array(N_ROCK).fill(NaN),
      grass: new Float64Array(N_GRASS).fill(NaN),
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
    stream(cypressRefs, cypress, cur.cypress, carZ)
    stream([shrubRef], shrubs, cur.shrub, carZ)
    stream([rockRef], rocks, cur.rock, carZ)
    stream([grassRef], grass, cur.grass, carZ)
  }

  // per-instance tints (set once)
  useLayoutEffect(() => {
    cypress.forEach((c, i) => c.tint && cypressFoliageRefs.forEach((r) => r.current?.setColorAt(i, c.tint!)))
    shrubs.forEach((b, i) => b.tint && shrubRef.current?.setColorAt(i, b.tint))
    rocks.forEach((r, i) => r.tint && rockRef.current?.setColorAt(i, r.tint))
    grass.forEach((g, i) => g.tint && grassRef.current?.setColorAt(i, g.tint))
    for (const r of cypressFoliageRefs) if (r.current?.instanceColor) r.current.instanceColor.needsUpdate = true
    if (shrubRef.current?.instanceColor) shrubRef.current.instanceColor.needsUpdate = true
    if (rockRef.current?.instanceColor) rockRef.current.instanceColor.needsUpdate = true
    if (grassRef.current?.instanceColor) grassRef.current.instanceColor.needsUpdate = true
    // initial placement so nothing flashes at the origin before the first frame
    buildAll(carState.z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => buildAll(carState.z))

  const { geo, mat } = assets
  return (
    <>
      {/* rolling golden-green headland hills flanking the road (streaming strips) */}
      <Terrain themeId="city" color={HILL_COLOR} amplitude={HILL_AMPLITUDE} cap={null} roughness={1} />

      {/* wind-bent Monterey cypress (trunk + two flat overhanging canopies) */}
      <instancedMesh frustumCulled={false} ref={trunkRef} args={[geo.trunk, mat.trunkMat, N_CYPRESS]} castShadow />
      <instancedMesh frustumCulled={false} ref={can1Ref} args={[geo.canopy1, mat.cypressMat, N_CYPRESS]} castShadow />
      <instancedMesh frustumCulled={false} ref={can2Ref} args={[geo.canopy2, mat.cypressMat, N_CYPRESS]} castShadow />
      {/* low coastal scrub, rock outcrops, dry grass tufts */}
      <instancedMesh frustumCulled={false} ref={shrubRef} args={[geo.shrub, mat.shrubMat, N_SHRUB]} castShadow />
      <instancedMesh frustumCulled={false} ref={rockRef} args={[geo.rock, mat.rockMat, N_ROCK]} castShadow />
      <instancedMesh frustumCulled={false} ref={grassRef} args={[geo.grassTuft, mat.grassMat, N_GRASS]} castShadow />
    </>
  )
}
