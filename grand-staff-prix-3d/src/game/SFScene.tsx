import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// San Francisco foreground. Two layers:
//
//   1. A stylized Golden-Gate bridge you drive across — international-orange towers,
//      draping suspension cables, suspenders, and roadside railing beams that read
//      as a real deck rather than a flat row of gates. (The photoreal real-SF path
//      via Google 3D Tiles is wired behind VITE_GOOGLE_TILES_KEY in GameScene; this
//      is the no-key version.)
//
//   2. A scattered instanced CITYSCAPE flanking the road — varied skyscrapers and
//      mid/low blocks, dense near the shoulder and thinning into the fog, with
//      rooftop mechanicals and a sprinkle of warm-lit windows. This replaces the old
//      tidy/sparse row so the 3D foreground reads as driving through a real city,
//      cohesive with the painted blue-bay backdrop (Scenery.tsx) on the horizon.
//
// The cityscape is world-fixed and instanced: each building keeps a static world
// position and only teleports forward by one PERIOD once the car drives PERIOD/2
// past it (deep in fog → the recycle is never visible). The ground reaches past the
// fog so distant buildings sit on the ground rather than floating (see Track.tsx).

// ---------------------------------------------------------------------------
// Golden Gate bridge (hero feature)
// ---------------------------------------------------------------------------

const ORANGE = '#c1402a'
const TOWERS = 5
const SPAN = 120 // distance between bridge towers
const TOWER_X = TRACK_HALF + 1.3
const TOWER_H = 26
const DECK_Y = 0.4

function useOrange() {
  return useMemo(() => new THREE.MeshStandardMaterial({ color: ORANGE, metalness: 0.2, roughness: 0.6 }), [])
}

// One Golden-Gate tower (two tapered legs + cross-braces) at a given side.
function Tower({ side, mat }: { side: number; mat: THREE.Material }) {
  const x = side * TOWER_X
  return (
    <group position={[x, 0, 0]}>
      {[-0.7, 0.7].map((dx) => (
        <mesh key={dx} position={[dx, TOWER_H / 2, 0]} castShadow material={mat}>
          <boxGeometry args={[0.7, TOWER_H, 0.7]} />
        </mesh>
      ))}
      {/* horizontal cross-braces (the classic Golden Gate look) */}
      {[7, 14, 20, TOWER_H - 0.6].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={mat}>
          <boxGeometry args={[2.2, 0.6, 0.7]} />
        </mesh>
      ))}
    </group>
  )
}

// Draping main cable (catenary) running forward from a tower to the next, on one side.
function cableCurve(side: number): THREE.CatmullRomCurve3 {
  const x = side * TOWER_X
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const z = -t * SPAN
    // catenary-ish dip: high at the towers (t=0,1), low at mid
    const y = TOWER_H - 0.5 - Math.sin(t * Math.PI) * (TOWER_H - 9)
    pts.push(new THREE.Vector3(x, y, z))
  }
  return new THREE.CatmullRomCurve3(pts)
}

function TowerPair({ mat, cableGeoL, cableGeoR, suspenderGeo, railGeo }: {
  mat: THREE.Material
  cableGeoL: THREE.TubeGeometry
  cableGeoR: THREE.TubeGeometry
  suspenderGeo: THREE.BufferGeometry
  railGeo: THREE.BufferGeometry
}) {
  return (
    <group>
      <Tower side={-1} mat={mat} />
      <Tower side={1} mat={mat} />
      <mesh geometry={cableGeoL} material={mat} />
      <mesh geometry={cableGeoR} material={mat} />
      <mesh geometry={suspenderGeo} material={mat} />
      {/* deck-edge railing beams running between the towers (reads as a bridge deck) */}
      <mesh position={[-TOWER_X, 0, 0]} geometry={railGeo} material={mat} castShadow />
      <mesh position={[TOWER_X, 0, 0]} geometry={railGeo} material={mat} castShadow />
    </group>
  )
}

function GoldenGate() {
  const mat = useOrange()
  const cableGeoL = useMemo(() => new THREE.TubeGeometry(cableCurve(-1), 24, 0.16, 8, false), [])
  const cableGeoR = useMemo(() => new THREE.TubeGeometry(cableCurve(1), 24, 0.16, 8, false), [])
  // a single railing beam spanning from this tower back to the next one
  const railGeo = useMemo(
    () => new THREE.BoxGeometry(0.28, 0.85, SPAN).translate(0, DECK_Y + 0.42, -SPAN / 2),
    [],
  )
  // vertical suspender cables from each main cable down to the deck
  const suspenderGeo = useMemo(() => {
    const geos: THREE.BufferGeometry[] = []
    for (const side of [-1, 1]) {
      const curve = cableCurve(side)
      for (let i = 1; i < 10; i++) {
        const p = curve.getPoint(i / 10)
        const h = p.y - DECK_Y
        const g = new THREE.CylinderGeometry(0.04, 0.04, h, 5)
        g.translate(p.x, DECK_Y + h / 2, p.z)
        geos.push(g)
      }
    }
    return mergeSimple(geos)
  }, [])

  useEffect(() => {
    return () => {
      cableGeoL.dispose()
      cableGeoR.dispose()
      railGeo.dispose()
      suspenderGeo.dispose()
      mat.dispose()
    }
  }, [cableGeoL, cableGeoR, railGeo, suspenderGeo, mat])

  const pairs = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const baseline = (Math.floor(carState.z / SPAN) + 1) * SPAN
    for (let j = 0; j < TOWERS; j++) {
      const g = pairs.current[j]
      if (g) g.position.z = baseline - j * SPAN
    }
  })

  return (
    <>
      {Array.from({ length: TOWERS }).map((_, j) => (
        <group key={j} ref={(g) => { pairs.current[j] = g }}>
          <TowerPair mat={mat} cableGeoL={cableGeoL} cableGeoR={cableGeoR} suspenderGeo={suspenderGeo} railGeo={railGeo} />
        </group>
      ))}
    </>
  )
}

// minimal geometry merge (positions only) to keep all suspenders in one mesh
function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0
  for (const g of geos) count += g.getAttribute('position').count
  const pos = new Float32Array(count * 3)
  const idx: number[] = []
  let v = 0
  let o = 0
  for (const g of geos) {
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const index = g.getIndex()
    pos.set(p.array as Float32Array, o * 3)
    if (index) for (let i = 0; i < index.count; i++) idx.push(v + index.getX(i))
    else for (let i = 0; i < p.count; i++) idx.push(v + i)
    v += p.count
    o += p.count
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setIndex(idx)
  out.computeVertexNormals()
  return out
}

// ---------------------------------------------------------------------------
// Scattered instanced cityscape
// ---------------------------------------------------------------------------

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

const N_TOWER = 90 // tall skyscrapers
const N_BLOCK = 150 // mid / low blocks
const N_ROOF = N_TOWER // rooftop mechanicals, one per tower
const N_LIGHT = 90 // glowing window / streetlamp accents

interface Item {
  x: number
  zL: number // local Z within [0, PERIOD)
  sx: number
  sy: number
  sz: number
  rot: number
  oy?: number // baked Y origin (rooftop details / floating window lights)
  tint?: THREE.Color
}

// Nearest world-Z copy of a local position, kept within ±PERIOD/2 of the car.
function lattice(zL: number, carZ: number): number {
  return zL + Math.round((carZ - zL) / PERIOD) * PERIOD
}

function CityScatter() {
  // ---- scatter layout (built once) ---------------------------------------
  const { towers, blocks, roofs, lights } = useMemo(() => {
    const rng = mulberry32(0xc17a5)
    const side = () => (rng() < 0.5 ? -1 : 1)
    // X grows away from the road, biased dense near the shoulder (pow > 1).
    const scatterX = (reach: number, gap = 3) =>
      side() * (TRACK_HALF + gap + Math.pow(rng(), 1.7) * reach)

    // Cool concrete / glass greys, faintly blue to sit with the bay backdrop;
    // ~1 in 6 buildings gets a warm dusk-lit facade instead.
    const buildingTone = () => {
      if (rng() < 0.16) return new THREE.Color().setHSL(0.08 + rng() * 0.04, 0.35 + rng() * 0.2, 0.42 + rng() * 0.12)
      return new THREE.Color().setHSL(0.58 + (rng() - 0.5) * 0.06, 0.05 + rng() * 0.12, 0.42 + rng() * 0.26)
    }
    const roofTone = () => new THREE.Color().setHSL(0.6, 0.04 + rng() * 0.06, 0.24 + rng() * 0.12)
    // Window / lamp glow: mostly warm amber, a few cool fluorescent whites.
    const lightTone = () =>
      rng() < 0.7
        ? new THREE.Color().setHSL(0.09 + rng() * 0.03, 0.85, 0.62)
        : new THREE.Color().setHSL(0.56, 0.25, 0.82)

    // Tall towers: narrow footprint, big height variation via non-uniform scale.
    const towers: Item[] = Array.from({ length: N_TOWER }, () => {
      const sy = 13 + Math.pow(rng(), 1.4) * 30 // 13 → ~43 units tall
      return {
        x: scatterX(108, 3),
        zL: rng() * PERIOD,
        sx: 2.4 + rng() * 2.4,
        sy,
        sz: 2.4 + rng() * 2.4,
        rot: (rng() - 0.5) * 0.5, // mostly road-aligned, slight jitter
        tint: buildingTone(),
      }
    })
    // Mid / low blocks: wider footprint, shorter, denser, fill the gaps.
    const blocks: Item[] = Array.from({ length: N_BLOCK }, () => ({
      x: scatterX(100, 2),
      zL: rng() * PERIOD,
      sx: 3.0 + rng() * 4.0,
      sy: 3.5 + Math.pow(rng(), 1.3) * 9,
      sz: 3.0 + rng() * 4.0,
      rot: (rng() - 0.5) * 0.6,
      tint: buildingTone(),
    }))
    // Rooftop mechanicals (water tanks / penthouses) sitting on each tower top.
    const roofs: Item[] = towers.map((t) => ({
      x: t.x,
      zL: t.zL,
      sx: t.sx * (0.3 + rng() * 0.25),
      sy: 0.8 + rng() * 2.4,
      sz: t.sz * (0.3 + rng() * 0.25),
      rot: t.rot,
      oy: t.sy, // top of the tower (unit box scaled by sy → spans 0..sy)
      tint: roofTone(),
    }))
    // Glowing window / streetlamp accents floating at varied heights near the road.
    const lights: Item[] = Array.from({ length: N_LIGHT }, () => {
      const s = 0.3 + rng() * 0.6
      return {
        x: scatterX(70, 2),
        zL: rng() * PERIOD,
        sx: s,
        sy: s * (1 + rng() * 2),
        sz: s,
        rot: 0,
        oy: 1.5 + Math.pow(rng(), 1.5) * 24,
        tint: lightTone(),
      }
    })
    return { towers, blocks, roofs, lights }
  }, [])

  // ---- geometry + materials ----------------------------------------------
  const assets = useMemo(() => {
    // unit boxes spanning y 0..1 so a per-instance Y scale grows them off the ground
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const roof = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const light = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)

    const towerMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // tinted per-instance
      roughness: 0.35,
      metalness: 0.3,
      emissive: '#16263c',
      emissiveIntensity: 0.22, // faint dusk glass glow
    })
    const blockMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // tinted per-instance
      roughness: 0.82,
      metalness: 0.05,
    })
    const roofMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }) // tinted per-instance
    const lightMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // tinted per-instance
      emissive: '#ffb347',
      emissiveIntensity: 1.4,
      roughness: 0.4,
    })

    return {
      geo: { box, roof, light },
      mat: { towerMat, blockMat, roofMat, lightMat },
    }
  }, [])

  useEffect(() => {
    return () => {
      Object.values(assets.geo).forEach((g) => g.dispose())
      Object.values(assets.mat).forEach((m) => m.dispose())
    }
  }, [assets])

  // ---- instanced mesh refs ------------------------------------------------
  const towerRef = useRef<THREE.InstancedMesh>(null)
  const blockRef = useRef<THREE.InstancedMesh>(null)
  const roofRef = useRef<THREE.InstancedMesh>(null)
  const lightRef = useRef<THREE.InstancedMesh>(null)

  // remembered world-Z per instance per group (NaN forces a first build)
  const cur = useMemo(
    () => ({
      tower: new Float64Array(N_TOWER).fill(NaN),
      block: new Float64Array(N_BLOCK).fill(NaN),
      roof: new Float64Array(N_ROOF).fill(NaN),
      light: new Float64Array(N_LIGHT).fill(NaN),
    }),
    [],
  )

  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Reposition only the instances whose nearest lattice copy changed this frame;
  // upload the buffer only if at least one moved. Static between recycles → cheap.
  // Buildings use non-uniform scale (sx,sy,sz) so each tower has its own silhouette.
  const stream = (ref: React.RefObject<THREE.InstancedMesh | null>, items: Item[], mem: Float64Array, carZ: number) => {
    let dirty = false
    for (let i = 0; i < items.length; i++) {
      const wz = lattice(items[i].zL, carZ)
      if (wz === mem[i]) continue
      mem[i] = wz
      dummy.position.set(items[i].x, items[i].oy ?? 0, wz)
      dummy.rotation.set(0, items[i].rot, 0)
      dummy.scale.set(items[i].sx, items[i].sy, items[i].sz)
      dummy.updateMatrix()
      ref.current?.setMatrixAt(i, dummy.matrix)
      dirty = true
    }
    if (dirty && ref.current) ref.current.instanceMatrix.needsUpdate = true
  }

  const buildAll = (carZ: number) => {
    stream(towerRef, towers, cur.tower, carZ)
    stream(blockRef, blocks, cur.block, carZ)
    stream(roofRef, roofs, cur.roof, carZ)
    stream(lightRef, lights, cur.light, carZ)
  }

  // per-instance tints (set once)
  useLayoutEffect(() => {
    towers.forEach((t, i) => t.tint && towerRef.current?.setColorAt(i, t.tint))
    blocks.forEach((b, i) => b.tint && blockRef.current?.setColorAt(i, b.tint))
    roofs.forEach((r, i) => r.tint && roofRef.current?.setColorAt(i, r.tint))
    lights.forEach((l, i) => l.tint && lightRef.current?.setColorAt(i, l.tint))
    if (towerRef.current?.instanceColor) towerRef.current.instanceColor.needsUpdate = true
    if (blockRef.current?.instanceColor) blockRef.current.instanceColor.needsUpdate = true
    if (roofRef.current?.instanceColor) roofRef.current.instanceColor.needsUpdate = true
    if (lightRef.current?.instanceColor) lightRef.current.instanceColor.needsUpdate = true
    // initial placement so nothing flashes at the origin before the first frame
    buildAll(carState.z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => buildAll(carState.z))

  const { geo, mat } = assets
  return (
    <>
      <instancedMesh ref={towerRef} args={[geo.box, mat.towerMat, N_TOWER]} castShadow receiveShadow />
      <instancedMesh ref={blockRef} args={[geo.box, mat.blockMat, N_BLOCK]} castShadow receiveShadow />
      <instancedMesh ref={roofRef} args={[geo.roof, mat.roofMat, N_ROOF]} castShadow />
      <instancedMesh ref={lightRef} args={[geo.light, mat.lightMat, N_LIGHT]} />
    </>
  )
}

export function SFScene() {
  // No sky dome here — the painted SF backdrop (Scenery.tsx) is the sky/horizon.
  return (
    <>
      <GoldenGate />
      <CityScatter />
    </>
  )
}
