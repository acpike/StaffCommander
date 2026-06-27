import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { input } from './input'
import { carState } from './carState'
import { MAX_VISUAL_SPEED } from './constants'

// SPACE-ONLY. Star-Wars-style hyperspace streaks: bright thin light bars that
// radiate from a vanishing point ahead and rush past the camera. Length, count
// (via opacity) and travel speed all scale with carState.speed, with an extra
// burst when the car is accelerating hard. Kept as an accent: sparse in the
// centre, densest toward the screen edges, additive so it glows but never
// washes out the note gates.

const COUNT = 150
const Z_NEAR = 12 // local z behind the camera where a streak recycles
const Z_FAR = -190 // local z far ahead where a streak is reborn
const SPAN = Z_NEAR - Z_FAR

// Cool deep-space palette: white, cyan, violet.
const COLORS = [
  new THREE.Color('#ffffff'),
  new THREE.Color('#9fe9ff'),
  new THREE.Color('#69d2ff'),
  new THREE.Color('#b79bff'),
  new THREE.Color('#8a7bff'),
]

interface Streak {
  angle: number
  radius: number
  z: number
  lenMul: number
}

export function HyperStreaks() {
  const camera = useThree((s) => s.camera)
  const inst = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const hold = useRef(0)

  const streaks = useMemo<Streak[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        // bias the angle distribution slightly toward the horizontal edges
        angle: Math.random() * Math.PI * 2,
        // min radius keeps the screen centre (where gates live) clear; the bulk
        // sits out toward the edges
        radius: 3.2 + Math.pow(Math.random(), 0.7) * 24,
        z: Z_FAR + Math.random() * SPAN,
        lenMul: 0.6 + Math.random() * 0.9,
      })),
    [],
  )

  // bake per-instance colours once
  const colors = useMemo(
    () => streaks.map(() => COLORS[(Math.random() * COLORS.length) | 0]),
    [streaks],
  )

  useFrame((_, rawDelta) => {
    const m = inst.current
    if (!m) return
    const dt = Math.min(rawDelta, 0.05)
    const g = useGame.getState()
    const playing = g.screen === 'playing'

    // normalised speed 0..~1 (clamped); near-zero when stopped
    const n = playing ? Math.min(1.15, carState.speed / MAX_VISUAL_SPEED) : 0

    // streaks show the WHOLE time the accelerate input is held (up-arrow / throttle
    // button) and the car is moving — they stay up while you hold it and fade out
    // smoothly when you let go (not on a timer).
    const held = playing && input.boost && n > 0.04
    const target = held ? 1 : 0
    // quick rise while held, graceful fall on release
    hold.current += (target - hold.current) * Math.min(1, dt * (target > hold.current ? 10 : 4))
    const presence = hold.current

    m.visible = presence > 0.03
    if (!m.visible) return

    // follow the camera so the streaks always frame the view
    m.position.copy(camera.position)

    // rush fast (it's hyperspace); length/speed scale with velocity, gated by presence
    const travel = (50 + n * 160) * dt
    const baseLen = (2 + n * 16) * (0.4 + presence * 0.6)

    for (let i = 0; i < COUNT; i++) {
      const s = streaks[i]
      s.z += travel
      if (s.z > Z_NEAR) s.z -= SPAN
      const len = baseLen * s.lenMul
      dummy.position.set(Math.cos(s.angle) * s.radius, Math.sin(s.angle) * s.radius, s.z - len * 0.5)
      dummy.scale.set(1, 1, len)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, colors[i])
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true

    const mat = m.material as THREE.MeshBasicMaterial
    mat.opacity = Math.min(0.95, presence * 0.95)
  })

  return (
    <instancedMesh
      ref={inst}
      args={[undefined, undefined, COUNT]}
      frustumCulled={false}
      visible={false}
    >
      <boxGeometry args={[0.06, 0.06, 1]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
