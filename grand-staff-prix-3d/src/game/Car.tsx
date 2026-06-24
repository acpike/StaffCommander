import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { carById } from '../data/cars'
import { input } from './input'
import { audio } from '../audio/sound'
import { carState } from './carState'
import { CarModel } from './CarModel'
import { CAR_Y, CLAMP_X, BASE_SPEED, STAGE_SPEED, BOOST_SPEED, STEER_RATE, MAX_VISUAL_SPEED } from './constants'

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

export function Car() {
  const carId = useGame((s) => s.settings.carId)
  const spec = useMemo(() => carById(carId), [carId])

  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)

  const quat = useMemo(() => new THREE.Quaternion(), [])
  const euler = useMemo(() => new THREE.Euler(), [])

  useFrame((_, rawDelta) => {
    const rb = body.current
    if (!rb) return
    const dt = Math.min(rawDelta, 0.05)
    const g = useGame.getState()
    const playing = g.screen === 'playing'

    // smooth steering toward input
    const target = input.steer
    carState.steer += (target - carState.steer) * Math.min(1, dt * 10)

    if (playing) {
      carState.x = clamp(carState.x + carState.steer * STEER_RATE * spec.turnMul * dt, -CLAMP_X, CLAMP_X)
      const speed = (BASE_SPEED + (g.stage - 1) * STAGE_SPEED) * spec.topSpeedMul + (input.boost ? BOOST_SPEED : 0)
      carState.speed = speed
      carState.z -= speed * dt
    } else {
      carState.speed = 0
    }

    // engine pitch tracks speed (idles when stopped)
    audio.setEngineSpeed(carState.speed / MAX_VISUAL_SPEED)

    // bank / yaw into the turn
    carState.yaw = -carState.steer * 0.26
    rb.setNextKinematicTranslation({ x: carState.x, y: CAR_Y, z: carState.z })
    euler.set(0, carState.yaw, -carState.steer * 0.1)
    quat.setFromEuler(euler)
    rb.setNextKinematicRotation(quat)

    // suspension bob + lean (visual only)
    if (visual.current) {
      const t = performance.now() / 1000
      visual.current.position.y = Math.sin(t * 9) * 0.012 * (carState.speed > 1 ? 1 : 0)
      visual.current.rotation.z = carState.steer * 0.05
    }
  })

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[0, CAR_Y, 0]}
      userData={{ kind: 'car' }}
      name="car"
    >
      {/* collision proxy used for gate sensor intersections */}
      <CuboidCollider args={[0.9, 0.5, 1.85]} />
      <group ref={visual}>
        <Suspense fallback={null}>
          <CarModel car={spec} />
        </Suspense>
      </group>
    </RigidBody>
  )
}
