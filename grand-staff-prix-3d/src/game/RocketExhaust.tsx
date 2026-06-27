import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { input } from './input'
import { carState } from './carState'
import { CAR_Y, MAX_VISUAL_SPEED } from './constants'

// SPACE-ONLY. Twin glowing rocket-engine plumes on the back of the player's car.
// Each nozzle has a hot white-blue core cone, a cyan/violet outer flame and a
// soft additive glow puff at the mouth. The flame length/intensity scale with
// speed + boost, and a per-frame flicker keeps it alive. Sits just behind the
// car's rear-centre and trails backward (+Z, since forward is -Z), following
// the live carState the same way the smoke Exhaust does.

const REAR_Z = 1.95 // just behind the car body (car half-length ~1.85)
const NOZZLE_X = 0.42 // lateral offset of each of the two nozzles
const NOZZLE_Y = CAR_Y - 0.07 // a touch below body centre

// Cone geometry: base sits at the nozzle mouth (local z=0), apex trails to +Z.
function makeFlameGeo(radius: number) {
  const g = new THREE.ConeGeometry(radius, 1, 16, 1, true)
  g.translate(0, 0.5, 0) // base at origin, apex at +Y
  g.rotateX(Math.PI / 2) // +Y -> +Z, so apex trails backward
  return g
}

export function RocketExhaust() {
  const group = useRef<THREE.Group>(null)
  const cores = useRef<(THREE.Mesh | null)[]>([])
  const flames = useRef<(THREE.Mesh | null)[]>([])
  const glows = useRef<(THREE.Mesh | null)[]>([])

  const coreGeo = useMemo(() => makeFlameGeo(0.13), [])
  const flameGeo = useMemo(() => makeFlameGeo(0.22), [])
  const glowGeo = useMemo(() => new THREE.SphereGeometry(0.28, 12, 12), [])

  const nozzles = useMemo(() => [-NOZZLE_X, NOZZLE_X], [])

  useFrame(() => {
    const grp = group.current
    if (!grp) return
    const g = useGame.getState()
    const playing = g.screen === 'playing'

    // throttle: speed-driven, with a kick while boosting; fades to near-zero idle
    const n = playing ? Math.min(1.2, carState.speed / MAX_VISUAL_SPEED) : 0
    const throttle = Math.max(0, n + (input.boost && playing ? 0.25 : 0))

    grp.visible = throttle > 0.04
    if (!grp.visible) return

    // follow the car's live position + yaw/lean
    grp.position.set(carState.x, NOZZLE_Y, carState.z + REAR_Z)
    grp.rotation.set(0, carState.yaw, carState.steer * 0.05)

    const t = performance.now() / 1000
    // two overlapping sines = lively flicker
    const flicker = 0.82 + 0.18 * Math.sin(t * 47) * Math.sin(t * 29)
    const baseLen = (0.5 + throttle * 2.6) * flicker

    for (let i = 0; i < nozzles.length; i++) {
      const core = cores.current[i]
      const flame = flames.current[i]
      const glow = glows.current[i]
      const jitter = 0.9 + 0.1 * Math.sin(t * 61 + i * 3.1)
      if (core) core.scale.set(1, 1, baseLen * 1.05 * jitter)
      if (flame) {
        flame.scale.set(1, 1, baseLen * jitter)
        const fm = flame.material as THREE.MeshBasicMaterial
        fm.opacity = 0.35 + throttle * 0.4
      }
      if (glow) {
        const s = (0.7 + throttle * 0.7) * flicker
        glow.scale.setScalar(s)
        const gm = glow.material as THREE.MeshBasicMaterial
        gm.opacity = (0.3 + throttle * 0.45) * flicker
      }
    }
  })

  return (
    <group ref={group} visible={false}>
      {nozzles.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          {/* soft glow puff at the nozzle mouth */}
          <mesh ref={(m) => { glows.current[i] = m }} geometry={glowGeo}>
            <meshBasicMaterial
              color="#7fd8ff"
              transparent
              opacity={0.4}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          {/* outer flame: cyan/violet */}
          <mesh ref={(m) => { flames.current[i] = m }} geometry={flameGeo}>
            <meshBasicMaterial
              color="#56b6ff"
              transparent
              opacity={0.5}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          {/* hot white-blue core */}
          <mesh ref={(m) => { cores.current[i] = m }} geometry={coreGeo}>
            <meshBasicMaterial
              color="#eaf6ff"
              transparent
              opacity={0.95}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
