import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { carState } from './carState'

// Pool of skid decals laid on the road behind the rear wheels when the car is
// turning hard at speed. Marks are world-fixed (they stay where laid and recede
// as the car drives on) and fade out, then recycle from the pool.

const POOL = 80 // 40 left/right pairs
const STEER_THRESHOLD = 0.5
const EMIT_DISTANCE = 0.55 // world units between marks
const FADE = 1.6 // seconds

export function SkidMarks() {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const life = useRef<number[]>(new Array(POOL).fill(0))
  const cursor = useRef(0)
  const lastEmitZ = useRef(0)

  const geo = useMemo(() => new THREE.PlaneGeometry(0.34, 0.62), [])

  const emit = (x: number) => {
    const m = meshes.current[cursor.current]
    if (m) {
      m.position.set(x, 0.02, carState.z + 1.25)
      m.visible = true
      life.current[cursor.current] = FADE
    }
    cursor.current = (cursor.current + 1) % POOL
  }

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const g = useGame.getState()
    const turningHard = g.screen === 'playing' && Math.abs(carState.steer) > STEER_THRESHOLD && carState.speed > 5

    if (turningHard && Math.abs(carState.z - lastEmitZ.current) > EMIT_DISTANCE) {
      lastEmitZ.current = carState.z
      // both rear wheels
      emit(carState.x + 0.9)
      emit(carState.x - 0.9)
    }

    // fade existing marks
    for (let i = 0; i < POOL; i++) {
      if (life.current[i] <= 0) continue
      life.current[i] -= dt
      const m = meshes.current[i]
      if (!m) continue
      if (life.current[i] <= 0) {
        m.visible = false
      } else {
        const mat = m.material as THREE.MeshBasicMaterial
        mat.opacity = Math.min(0.5, (life.current[i] / FADE) * 0.5)
      }
    }
  })

  return (
    <group>
      {Array.from({ length: POOL }).map((_, i) => (
        <mesh
          key={i}
          ref={(m) => { meshes.current[i] = m }}
          geometry={geo}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <meshBasicMaterial color="#0a0a0c" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
