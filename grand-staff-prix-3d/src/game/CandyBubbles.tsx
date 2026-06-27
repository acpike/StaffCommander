import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { carState } from './carState'
import { CAR_Y, MAX_VISUAL_SPEED } from './constants'

// CANDY-ONLY. The car blows candy-coloured soap bubbles instead of exhaust —
// a playful touch for the younger kids who tend to pick Candy Canyon. Bubbles
// spawn at the car's rear, drift up + backward, wobble, grow a little and fade
// (pop). They live in WORLD space (detached from the car), so they trail behind
// as the car drives on. Spawn cadence scales with speed.

const N = 24
const REAR_Z = 1.9 // just behind the car body (forward is -Z, so the rear is +Z)
const PASTELS = ['#ffd1ec', '#bfe6ff', '#fff2ad', '#caf7d8', '#e7cdff', '#ffd9b8']

interface Bubble {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number; ttl: number; size: number; active: boolean
}

export function CandyBubbles() {
  const refs = useRef<(THREE.Group | null)[]>([])
  const bubbles = useMemo<Bubble[]>(
    () => Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, ttl: 1, size: 0.2, active: false })),
    [],
  )
  const spawnT = useRef(0)
  const colorObjs = useMemo(() => PASTELS.map((c) => new THREE.Color(c)), [])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const g = useGame.getState()
    const playing = g.screen === 'playing'
    const n = playing ? Math.min(1.2, carState.speed / MAX_VISUAL_SPEED) : 0
    const t = performance.now() / 1000

    // spawn a bubble at the rear; faster cadence the faster you go
    spawnT.current -= dt
    if (playing && n > 0.05 && spawnT.current <= 0) {
      spawnT.current = 0.05 + (1 - n) * 0.18
      const idx = bubbles.findIndex((b) => !b.active)
      if (idx >= 0) {
        const b = bubbles[idx]
        // emit from the rear CORNERS (not the centre) so the bubbles clear the
        // road's centre line, and drift OUTWARD to the sides where they're visible
        const sideSign = Math.random() < 0.5 ? -1 : 1
        b.x = carState.x + sideSign * (0.42 + Math.random() * 0.18)
        b.y = CAR_Y - 0.02 + Math.random() * 0.25
        b.z = carState.z + REAR_Z + Math.random() * 0.3
        b.vx = sideSign * (0.35 + Math.random() * 0.45) // outward toward the sides
        b.vy = 0.26 + Math.random() * 0.26 // slower rise
        b.vz = 0.22 + Math.random() * 0.5 // slower backward drift (they linger)
        b.ttl = 2.6 + Math.random() * 1.8 // live much longer so they're easy to see
        b.life = b.ttl
        b.size = 0.17 + Math.random() * 0.22 // a bit bigger
        b.active = true
        const grp = refs.current[idx]
        if (grp) {
          const shell = grp.children[0] as THREE.Mesh
          ;(shell.material as THREE.MeshBasicMaterial).color.copy(colorObjs[(Math.random() * colorObjs.length) | 0])
        }
      }
    }

    for (let i = 0; i < N; i++) {
      const b = bubbles[i]
      const grp = refs.current[i]
      if (!grp) continue
      if (!b.active) { grp.visible = false; continue }
      b.life -= dt
      if (b.life <= 0) { b.active = false; grp.visible = false; continue }
      b.vy += dt * 0.3 // gentle buoyancy
      b.x += (b.vx + Math.sin(t * 3 + i) * 0.22) * dt
      b.y += b.vy * dt
      b.z += b.vz * dt
      const k = b.life / b.ttl // 1 → 0 over its life
      grp.visible = true
      grp.position.set(b.x, b.y, b.z)
      grp.scale.setScalar(b.size * (1.05 + (1 - k) * 0.35)) // grows slightly as it rises
      const op = Math.min(1, k * 2)
      ;((grp.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.3 * op
      ;((grp.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 * op
    }
  })

  return (
    <group>
      {bubbles.map((_, i) => (
        <group key={i} ref={(m) => { refs.current[i] = m }} visible={false}>
          {/* translucent candy shell */}
          <mesh>
            <sphereGeometry args={[1, 14, 12]} />
            <meshBasicMaterial color="#ffd1ec" transparent opacity={0.3} depthWrite={false} />
          </mesh>
          {/* bright highlight for the soap-bubble shine */}
          <mesh position={[-0.34, 0.4, 0.42]} scale={0.22}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
