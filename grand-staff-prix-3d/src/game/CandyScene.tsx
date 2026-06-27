import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Candy Canyon foreground. Instead of one tidy row of identical lollipops hugging
// the shoulder, this scatters a whole candy field — lollipops of varied size and
// colour, candy canes, gumdrops and peppermint pillows — spread from the road edge
// out toward the horizon (dense near, thinning into the distance). The candy hills
// and far horizon are left to the painted backdrop (see Scenery.tsx), so the 3D
// layer doesn't duplicate them.
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

const N_POP = 130
const N_CANE = 60
const N_GUM = 110
const N_MINT = 90

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

export function CandyScene() {
  // ---- scatter layout (built once) ---------------------------------------
  const { pops, canes, gums, mints } = useMemo(() => {
    const rng = mulberry32(0xca0d1)
    const side = () => (rng() < 0.5 ? -1 : 1)
    // X grows away from the road, biased dense near the shoulder (pow > 1).
    const scatterX = (reach: number, gap = 3) =>
      side() * (TRACK_HALF + gap + Math.pow(rng(), 1.7) * reach)

    // Bright, saturated candy colours across the whole hue wheel.
    const candyTone = () =>
      new THREE.Color().setHSL(rng(), 0.72 + rng() * 0.22, 0.58 + rng() * 0.14)
    // Candy canes lean warm pink / cherry red.
    const caneTone = () =>
      new THREE.Color().setHSL((0.96 + rng() * 0.06) % 1, 0.72 + rng() * 0.2, 0.56 + rng() * 0.12)
    // Peppermint pillows: pale, low-saturation pinks / mints.
    const mintTone = () =>
      new THREE.Color().setHSL(rng() < 0.5 ? 0.95 : 0.45, 0.35 + rng() * 0.2, 0.74 + rng() * 0.12)

    const pops: Item[] = Array.from({ length: N_POP }, () => ({
      x: scatterX(88),
      zL: rng() * PERIOD,
      s: 0.6 + rng() * 1.3,
      rot: rng() * Math.PI * 2,
      tint: candyTone(),
    }))
    const canes: Item[] = Array.from({ length: N_CANE }, () => ({
      x: scatterX(80, 2),
      zL: rng() * PERIOD,
      s: 0.7 + rng() * 0.9,
      rot: rng() * Math.PI * 2,
      tint: caneTone(),
    }))
    const gums: Item[] = Array.from({ length: N_GUM }, () => ({
      x: scatterX(85, 1),
      zL: rng() * PERIOD,
      s: 0.7 + rng() * 1.8, // little bonbons → fat gumdrops
      rot: rng() * Math.PI * 2,
      tint: candyTone(),
    }))
    const mints: Item[] = Array.from({ length: N_MINT }, () => ({
      x: scatterX(82, 1),
      zL: rng() * PERIOD,
      s: 0.6 + rng() * 1.4,
      rot: rng() * Math.PI * 2,
      tint: mintTone(),
    }))
    return { pops, canes, gums, mints }
  }, [])

  // ---- geometry + materials (part offsets baked into the geometry so one
  //      per-instance matrix places every candy part consistently) -----------
  const assets = useMemo(() => {
    const POP_H = 3.0
    // lollipop: white stick + tinted disc head + white swirl centre
    const stick = new THREE.CylinderGeometry(0.11, 0.11, POP_H, 8).translate(0, POP_H / 2, 0)
    const disc = new THREE.TorusGeometry(0.7, 0.3, 10, 18).translate(0, POP_H + 0.55, 0)
    const center = new THREE.SphereGeometry(0.45, 12, 12).translate(0, POP_H + 0.55, 0.02)
    // candy cane: tinted pole + hooked top (half-torus arcing up and over)
    const canePole = new THREE.CylinderGeometry(0.16, 0.16, 3.2, 8).translate(0, 1.6, 0)
    const caneHook = new THREE.TorusGeometry(0.5, 0.16, 8, 14, Math.PI).translate(-0.5, 3.2, 0)
    // gumdrop: rounded dome sitting on the ground
    const gum = new THREE.SphereGeometry(0.7, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.12, 0)
    // peppermint pillow: flattened cushion resting on the ground
    const mint = new THREE.SphereGeometry(0.6, 14, 10).scale(1, 0.42, 1).translate(0, 0.26, 0)

    const stickMat = new THREE.MeshStandardMaterial({ color: '#fff3fa', roughness: 0.5 })
    const candyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.28, metalness: 0.05 }) // tinted per-instance
    const centerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.22 })
    const caneMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.32 }) // tinted per-instance
    const gumMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.05 }) // tinted per-instance
    const mintMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }) // tinted per-instance

    return {
      geo: { stick, disc, center, canePole, caneHook, gum, mint },
      mat: { stickMat, candyMat, centerMat, caneMat, gumMat, mintMat },
    }
  }, [])

  useEffect(() => {
    return () => {
      Object.values(assets.geo).forEach((g) => g.dispose())
      Object.values(assets.mat).forEach((m) => m.dispose())
    }
  }, [assets])

  // ---- instanced mesh refs ------------------------------------------------
  const stickRef = useRef<THREE.InstancedMesh>(null)
  const discRef = useRef<THREE.InstancedMesh>(null)
  const centerRef = useRef<THREE.InstancedMesh>(null)
  const canePoleRef = useRef<THREE.InstancedMesh>(null)
  const caneHookRef = useRef<THREE.InstancedMesh>(null)
  const gumRef = useRef<THREE.InstancedMesh>(null)
  const mintRef = useRef<THREE.InstancedMesh>(null)

  const popRefs = useMemo(() => [stickRef, discRef, centerRef], [])
  const caneRefs = useMemo(() => [canePoleRef, caneHookRef], [])

  // remembered world-Z per instance per group (NaN forces a first build)
  const cur = useMemo(
    () => ({
      pop: new Float64Array(N_POP).fill(NaN),
      cane: new Float64Array(N_CANE).fill(NaN),
      gum: new Float64Array(N_GUM).fill(NaN),
      mint: new Float64Array(N_MINT).fill(NaN),
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
    stream(popRefs, pops, cur.pop, carZ)
    stream(caneRefs, canes, cur.cane, carZ)
    stream([gumRef], gums, cur.gum, carZ)
    stream([mintRef], mints, cur.mint, carZ)
  }

  // per-instance tints (set once)
  useLayoutEffect(() => {
    pops.forEach((p, i) => p.tint && discRef.current?.setColorAt(i, p.tint))
    canes.forEach((c, i) => c.tint && caneRefs.forEach((r) => r.current?.setColorAt(i, c.tint!)))
    gums.forEach((g, i) => g.tint && gumRef.current?.setColorAt(i, g.tint))
    mints.forEach((m, i) => m.tint && mintRef.current?.setColorAt(i, m.tint))
    if (discRef.current?.instanceColor) discRef.current.instanceColor.needsUpdate = true
    for (const r of caneRefs) if (r.current?.instanceColor) r.current.instanceColor.needsUpdate = true
    if (gumRef.current?.instanceColor) gumRef.current.instanceColor.needsUpdate = true
    if (mintRef.current?.instanceColor) mintRef.current.instanceColor.needsUpdate = true
    // initial placement so nothing flashes at the origin before the first frame
    buildAll(carState.z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => buildAll(carState.z))

  const { geo, mat } = assets
  return (
    <>
      <instancedMesh frustumCulled={false} ref={stickRef} args={[geo.stick, mat.stickMat, N_POP]} castShadow />
      <instancedMesh frustumCulled={false} ref={discRef} args={[geo.disc, mat.candyMat, N_POP]} castShadow />
      <instancedMesh frustumCulled={false} ref={centerRef} args={[geo.center, mat.centerMat, N_POP]} />
      <instancedMesh frustumCulled={false} ref={canePoleRef} args={[geo.canePole, mat.caneMat, N_CANE]} castShadow />
      <instancedMesh frustumCulled={false} ref={caneHookRef} args={[geo.caneHook, mat.caneMat, N_CANE]} castShadow />
      <instancedMesh frustumCulled={false} ref={gumRef} args={[geo.gum, mat.gumMat, N_GUM]} castShadow />
      <instancedMesh frustumCulled={false} ref={mintRef} args={[geo.mint, mat.mintMat, N_MINT]} castShadow />
    </>
  )
}
