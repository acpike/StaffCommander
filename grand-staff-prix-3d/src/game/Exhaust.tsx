import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { input } from './input'
import { carState } from './carState'
import { MAX_VISUAL_SPEED } from './constants'

// World-fixed exhaust puffs emitted from the tailpipe; they drift up/back, grow
// and fade. Emission rate and darkness rise with speed, and a boost belches more.

const POOL = 44
const LIFE = 0.85

interface Puff {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
}

export function Exhaust() {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const puffs = useRef<Puff[]>(
    Array.from({ length: POOL }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0 })),
  )
  const cursor = useRef(0)
  const acc = useRef(0)
  const geo = useMemo(() => new THREE.SphereGeometry(0.22, 8, 8), [])

  const emit = (boost: boolean) => {
    const p = puffs.current[cursor.current]
    p.pos.set(carState.x + (Math.random() - 0.5) * 0.5, 0.4, carState.z + 2.0)
    p.vel.set((Math.random() - 0.5) * 0.8, 0.7 + Math.random() * 0.5, 1.4 + Math.random() * (boost ? 2.5 : 1))
    p.life = LIFE
    cursor.current = (cursor.current + 1) % POOL
  }

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const g = useGame.getState()
    const driving = g.screen === 'playing' && carState.speed > 4
    const n = carState.speed / MAX_VISUAL_SPEED
    const boost = input.boost

    if (driving) {
      acc.current += dt
      const every = boost ? 0.03 : 0.06 + (1 - n) * 0.08
      while (acc.current >= every) {
        acc.current -= every
        emit(boost)
      }
    }

    for (let i = 0; i < POOL; i++) {
      const p = puffs.current[i]
      const m = meshes.current[i]
      if (!m) continue
      if (p.life <= 0) {
        m.visible = false
        continue
      }
      p.life -= dt
      p.vel.y += 1.2 * dt // smoke rises
      p.vel.multiplyScalar(0.96)
      p.pos.addScaledVector(p.vel, dt)
      const k = p.life / LIFE
      m.visible = true
      m.position.copy(p.pos)
      m.scale.setScalar(0.5 + (1 - k) * 2.2)
      const mat = m.material as THREE.MeshBasicMaterial
      mat.opacity = k * 0.4
    }
  })

  return (
    <group>
      {Array.from({ length: POOL }).map((_, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m }} geometry={geo} visible={false}>
          <meshBasicMaterial color="#6b6b72" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
