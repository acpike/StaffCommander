import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sceneryFor, type PropKind } from './envConfig'
import { carState } from './carState'
import { TRACK_HALF } from './constants'

// Streaming roadside props. A fixed pool of instances per side is laid out along Z
// and recycled relative to the car: whenever a prop falls a tile-length behind the
// camera it is repositioned a tile-length ahead, so props stream past forever for
// the cost of two InstancedMeshes (one body + one accent) per side. The track is
// straight, so X is a fixed jittered offset just past the shoulder.
//
// NOTE: this assumes a STRAIGHT track. If the road later curves, prop X would need
// to track the road centreline at each prop's Z — a known follow-up.

const COUNT = 26 // props per side
const SPACING = 16 // Z gap between props
const SIDE_OFFSET = TRACK_HALF + 5 // base distance from road centre to prop line

// Build a body geometry + an accent geometry for a prop kind. Both are unit-ish
// and scaled per instance. Returns null accent if the kind has no second colour.
function buildProp(kind: PropKind, height: number): {
  body: THREE.BufferGeometry
  accent: THREE.BufferGeometry | null
} {
  switch (kind) {
    case 'tree': {
      const trunk = new THREE.CylinderGeometry(0.12, 0.18, height * 0.35, 6)
      trunk.translate(0, height * 0.175, 0)
      const c1 = new THREE.ConeGeometry(height * 0.32, height * 0.5, 7)
      c1.translate(0, height * 0.55, 0)
      const c2 = new THREE.ConeGeometry(height * 0.24, height * 0.4, 7)
      c2.translate(0, height * 0.8, 0)
      const foliage = BufferGeometryUtils.mergeGeometries([c1, c2])!
      return { body: trunk, accent: foliage }
    }
    case 'building': {
      const b = new THREE.BoxGeometry(2.2, height, 2.2)
      b.translate(0, height / 2, 0)
      // window strips: thin emissive boxes on the front face
      const wins: THREE.BufferGeometry[] = []
      const rows = Math.max(3, Math.floor(height / 1.5))
      for (let r = 0; r < rows; r++) {
        const w = new THREE.BoxGeometry(1.6, 0.18, 0.05)
        w.translate(0, 0.9 + r * (height / rows) * 0.9, 1.11)
        wins.push(w)
      }
      return { body: b, accent: BufferGeometryUtils.mergeGeometries(wins)! }
    }
    case 'cactus': {
      const parts: THREE.BufferGeometry[] = []
      const trunk = new THREE.CapsuleGeometry(0.35, height * 0.7, 4, 8)
      trunk.translate(0, height * 0.45, 0)
      parts.push(trunk)
      const armL = new THREE.CapsuleGeometry(0.22, height * 0.3, 4, 8)
      armL.rotateZ(Math.PI / 2.4)
      armL.translate(-0.55, height * 0.55, 0)
      parts.push(armL)
      const armR = new THREE.CapsuleGeometry(0.22, height * 0.28, 4, 8)
      armR.rotateZ(-Math.PI / 2.4)
      armR.translate(0.55, height * 0.45, 0)
      parts.push(armR)
      return { body: BufferGeometryUtils.mergeGeometries(parts)!, accent: null }
    }
    case 'lollipop': {
      const stick = new THREE.CylinderGeometry(0.08, 0.08, height * 0.7, 6)
      stick.translate(0, height * 0.35, 0)
      const candy = new THREE.SphereGeometry(height * 0.28, 12, 10)
      candy.translate(0, height * 0.85, 0)
      return { body: stick, accent: candy }
    }
    case 'crystal': {
      const parts: THREE.BufferGeometry[] = []
      const main = new THREE.OctahedronGeometry(height * 0.35, 0)
      main.scale(1, 1.8, 1)
      main.translate(0, height * 0.5, 0)
      parts.push(main)
      const shard = new THREE.OctahedronGeometry(height * 0.18, 0)
      shard.scale(1, 1.6, 1)
      shard.translate(0.5, height * 0.28, 0.2)
      parts.push(shard)
      return { body: BufferGeometryUtils.mergeGeometries(parts)!, accent: null }
    }
  }
}

interface SlotData {
  /** jittered X magnitude beyond the shoulder */
  x: number
  /** uniform scale */
  scale: number
  /** y-rotation */
  rot: number
}

export function RoadsideProps({ themeId }: { themeId: string }) {
  const cfg = sceneryFor(themeId)
  const { body, accent } = useMemo(() => buildProp(cfg.prop.kind, cfg.prop.height), [cfg.prop.kind, cfg.prop.height])

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.prop.color),
        roughness: 0.85,
        metalness: 0,
      }),
    [cfg.prop.color],
  )
  const accentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.prop.accent),
        emissive: new THREE.Color(cfg.prop.accent),
        emissiveIntensity: cfg.prop.glow,
        roughness: 0.7,
        metalness: 0,
        toneMapped: cfg.prop.glow === 0,
      }),
    [cfg.prop.accent, cfg.prop.glow],
  )

  // dispose geometries/materials when the theme changes
  const disposables = useRef<{ geoms: THREE.BufferGeometry[]; mats: THREE.Material[] }>({ geoms: [], mats: [] })
  useEffect(() => {
    const prev = disposables.current
    disposables.current = {
      geoms: accent ? [body, accent] : [body],
      mats: [bodyMat, accentMat],
    }
    return () => {
      for (const g of prev.geoms) g.dispose()
      for (const m of prev.mats) m.dispose()
    }
  }, [body, accent, bodyMat, accentMat])

  // deterministic per-slot placement data, 2 sides × COUNT
  const slots = useMemo<SlotData[]>(() => {
    const out: SlotData[] = []
    let seed = cfg.prop.kind.length * 7 + 13
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < COUNT; i++) {
        out.push({
          x: SIDE_OFFSET + rnd() * 14, // 0..14 units further out
          scale: 0.7 + rnd() * 0.7,
          rot: rnd() * Math.PI * 2,
        })
      }
    }
    return out
  }, [cfg.prop.kind])

  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const accentRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const TOTAL = 2 * COUNT

  // initialise + recycle each frame
  const inited = useRef(false)
  useFrame(() => {
    const bm = bodyRef.current
    if (!bm) return
    const am = accentRef.current
    // -Z is forward. Lay props from a baseline just behind the camera (carZ+9)
    // stepping forward; baseline snaps in SPACING steps so each prop is world-
    // static between snaps, then recycles seamlessly one period at a time.
    const baseline = (Math.floor(carState.z / SPACING) + 1) * SPACING
    let k = 0
    for (let s = 0; s < 2; s++) {
      const sign = s === 0 ? 1 : -1
      for (let i = 0; i < COUNT; i++) {
        const slot = slots[k]
        const z = baseline - i * SPACING // stretches forward into -Z
        dummy.position.set(sign * slot.x, 0, z)
        dummy.rotation.set(0, slot.rot, 0)
        dummy.scale.setScalar(slot.scale)
        dummy.updateMatrix()
        bm.setMatrixAt(k, dummy.matrix)
        if (am) am.setMatrixAt(k, dummy.matrix)
        k++
      }
    }
    bm.instanceMatrix.needsUpdate = true
    if (am) am.instanceMatrix.needsUpdate = true
    if (!inited.current) {
      bm.computeBoundingSphere()
      if (am) am.computeBoundingSphere()
      inited.current = true
    }
  })

  // reset init flag when geometry changes so bounds recompute
  useEffect(() => {
    inited.current = false
  }, [body])

  return (
    <>
      <instancedMesh ref={bodyRef} args={[body, bodyMat, TOTAL]} castShadow receiveShadow frustumCulled={false} />
      {accent && (
        <instancedMesh ref={accentRef} args={[accent, accentMat, TOTAL]} castShadow frustumCulled={false} />
      )}
    </>
  )
}
