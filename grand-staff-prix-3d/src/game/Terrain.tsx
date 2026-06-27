import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneryFor } from './envConfig'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Rolling hill terrain flanking the road. Two displaced strips sit just past the
// shoulders and recycle along Z relative to the car, so the hills stream past
// forever. Displacement is sampled from a tiling height field keyed on WORLD z, so
// when a strip jumps back by one tile the surface lines up seamlessly.

const STRIP_W = 220 // X extent of each flanking strip (well beyond the road)
const TILE = 120 // Z length of one strip tile (= recycle period)
const SEGX = 40
const SEGZ = 48
const INNER = TRACK_HALF + 4 // gap from road edge to where hills begin
const STRIPS = 2 // tiles chained per side to keep terrain ahead + behind

function hash2(ix: number, iz: number): number {
  const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ux), THREE.MathUtils.lerp(c, d, ux), uz)
}

/** Build one strip plane displaced into rolling hills. `side` = +1 right, -1 left. */
function buildStrip(side: number, amplitude: number, capColor: string | null): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(STRIP_W, TILE, SEGX, SEGZ)
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const cap = capColor ? new THREE.Color(capColor) : null
  const base = new THREE.Color('#ffffff') // multiplied by material color
  // Periodic Z sampling so chained tiles meet seamlessly: map lz around a circle
  // whose circumference corresponds to one TILE, then sample 2-D noise on it.
  const TWO_PI = Math.PI * 2
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i)
    const lz = pos.getZ(i)
    const ang = ((lz + TILE / 2) / TILE) * TWO_PI
    const cz = Math.cos(ang) * 6
    const sz = Math.sin(ang) * 6
    // world X grows away from the road; ramp height up from 0 at the inner edge
    const distFromInner = STRIP_W / 2 + lx * side // 0 at inner edge, STRIP_W at far edge
    const ramp = THREE.MathUtils.smoothstep(distFromInner, 0, 60)
    const h =
      (valueNoise(lx * 0.06 + cz + side * 50, sz) * 0.7 +
        valueNoise(lx * 0.15 + cz * 2.5, sz * 2.5) * 0.3) *
      amplitude *
      ramp
    pos.setY(i, h)
    // blend a cap colour onto the high parts (snow / candy frosting)
    let r = base.r, gg = base.g, b = base.b
    if (cap) {
      const m = THREE.MathUtils.smoothstep(h, amplitude * 0.55, amplitude * 0.95)
      r = THREE.MathUtils.lerp(base.r, cap.r, m)
      gg = THREE.MathUtils.lerp(base.g, cap.g, m)
      b = THREE.MathUtils.lerp(base.b, cap.b, m)
    }
    colors[i * 3] = r
    colors[i * 3 + 1] = gg
    colors[i * 3 + 2] = b
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

// Per-theme terrain comes from envConfig, but any field can be overridden by a
// caller (e.g. SFScene drives golden-green Marin-Headlands hills without editing
// the shared config). `cap` is overridable to null, so we distinguish "omitted".
export function Terrain({
  themeId,
  color,
  amplitude,
  cap,
  roughness,
}: {
  themeId: string
  color?: string
  amplitude?: number
  cap?: string | null
  roughness?: number
}) {
  const cfg = sceneryFor(themeId)
  const tColor = color ?? cfg.terrain.color
  const tAmplitude = amplitude ?? cfg.terrain.amplitude
  const tCap = cap === undefined ? cfg.terrain.cap : cap
  const tRoughness = roughness ?? cfg.terrain.roughness

  const { left, right, material } = useMemo(() => {
    const left = buildStrip(-1, tAmplitude, tCap)
    const right = buildStrip(1, tAmplitude, tCap)
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tColor),
      vertexColors: true,
      roughness: tRoughness,
      metalness: 0,
      flatShading: true,
    })
    return { left, right, material }
  }, [tColor, tAmplitude, tRoughness, tCap])

  // dispose on theme change / unmount
  useEffect(() => {
    return () => {
      left.dispose()
      right.dispose()
      material.dispose()
    }
  }, [left, right, material])

  const refs = useRef<(THREE.Mesh | null)[]>([])

  useFrame(() => {
    // chain `STRIPS` tiles per side; baseline keeps the seam behind the camera.
    const baseline = (Math.floor(carState.z / TILE) + 1) * TILE
    let k = 0
    for (let s = 0; s < STRIPS; s++) {
      const z = baseline - s * TILE
      const l = refs.current[k++]
      const r = refs.current[k++]
      if (l) l.position.z = z
      if (r) r.position.z = z
    }
  })

  const meshes: ReactElement[] = []
  let idx = 0
  for (let s = 0; s < STRIPS; s++) {
    const li = idx++
    const ri = idx++
    meshes.push(
      <mesh
        key={`l${s}`}
        ref={(m) => { refs.current[li] = m }}
        geometry={left}
        material={material}
        position={[-(INNER + STRIP_W / 2), -0.06, 0]}
        receiveShadow
      />,
    )
    meshes.push(
      <mesh
        key={`r${s}`}
        ref={(m) => { refs.current[ri] = m }}
        geometry={right}
        material={material}
        position={[INNER + STRIP_W / 2, -0.06, 0]}
        receiveShadow
      />,
    )
  }

  return <>{meshes}</>
}
