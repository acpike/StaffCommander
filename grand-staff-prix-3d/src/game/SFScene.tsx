import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// San Francisco (keyless fallback): a recognizable, stylized Golden Gate Bridge —
// international-orange towers you drive under with draping suspension cables, plus
// coastal fog. (The photoreal real-SF path via Google 3D Tiles is wired behind
// VITE_GOOGLE_TILES_KEY in GameScene; this is the no-key version.)

const ORANGE = '#c1402a'
const TOWERS = 5
const SPAN = 120 // distance between towers
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

function TowerPair({ mat, cableGeoL, cableGeoR, suspenderGeo }: {
  mat: THREE.Material
  cableGeoL: THREE.TubeGeometry
  cableGeoR: THREE.TubeGeometry
  suspenderGeo: THREE.BufferGeometry
}) {
  return (
    <group>
      <Tower side={-1} mat={mat} />
      <Tower side={1} mat={mat} />
      <mesh geometry={cableGeoL} material={mat} />
      <mesh geometry={cableGeoR} material={mat} />
      <mesh geometry={suspenderGeo} material={mat} />
    </group>
  )
}

export function SFScene() {
  const mat = useOrange()
  const cableGeoL = useMemo(() => new THREE.TubeGeometry(cableCurve(-1), 24, 0.16, 8, false), [])
  const cableGeoR = useMemo(() => new THREE.TubeGeometry(cableCurve(1), 24, 0.16, 8, false), [])
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
      {/* No sky dome here — the painted SF backdrop (Scenery.tsx) is the sky.
          The old FogSky sphere sat at r=290, inside the r=300 backdrop quad, and
          painted over the whole horizon, hiding the city.jpg. */}
      {Array.from({ length: TOWERS }).map((_, j) => (
        <group key={j} ref={(g) => { pairs.current[j] = g }}>
          <TowerPair mat={mat} cableGeoL={cableGeoL} cableGeoR={cableGeoR} suspenderGeo={suspenderGeo} />
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
