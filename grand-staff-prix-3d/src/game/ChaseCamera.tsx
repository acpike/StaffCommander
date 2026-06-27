import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { carState } from './carState'

export function ChaseCamera() {
  const camera = useThree((s) => s.camera)
  const shake = useRef(0)
  const desired = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    // trigger a shake whenever a wrong answer lands
    const unsub = useGame.subscribe((s, prev) => {
      if (s.flashTick !== prev.flashTick && s.lastResult === 'wrong') shake.current = 1
    })
    return unsub
  }, [])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    desired.set(carState.x * 0.55, 4.3, carState.z + 9)
    const k = 1 - Math.pow(0.0015, dt)
    camera.position.lerp(desired, k)

    shake.current = Math.max(0, shake.current - dt * 3)
    if (shake.current > 0) {
      const s = shake.current * 0.45
      camera.position.x += (Math.random() - 0.5) * s
      camera.position.y += (Math.random() - 0.5) * s
    }

    look.set(carState.x * 0.5, 1.1, carState.z - 13)
    camera.lookAt(look)
  })

  return null
}
