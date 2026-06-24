import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { carState } from './carState'

interface BurstSpec {
  id: number
  x: number
  y: number
  z: number
  color: string
}

const LIFETIME = 0.7
const SHARDS = 16

function Burst({ id, x, y, z, color, onDone }: BurstSpec & { onDone: (id: number) => void }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const done = useRef(false)
  const life = useRef(0)

  const shards = useMemo(
    () =>
      Array.from({ length: SHARDS }, () => ({
        p: new THREE.Vector3(0, 0, 0),
        v: new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 7 + 2.5, (Math.random() - 0.5) * 9),
      })),
    [],
  )

  useFrame((_, rawDelta) => {
    if (done.current) return
    const dt = Math.min(rawDelta, 0.05)
    life.current += dt
    const fade = Math.max(0, 1 - life.current / LIFETIME)
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i]
      s.v.y -= 20 * dt
      s.p.addScaledVector(s.v, dt)
      const m = meshes.current[i]
      if (m) {
        m.position.copy(s.p)
        m.rotation.x += dt * 7
        m.rotation.y += dt * 6
        m.scale.setScalar(fade)
      }
    }
    if (life.current >= LIFETIME && !done.current) {
      done.current = true
      onDone(id)
    }
  })

  return (
    <group position={[x, y, z]}>
      {shards.map((_, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m }}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
      ))}
      <pointLight color={color} intensity={6} distance={12} decay={2} />
    </group>
  )
}

export function Explosions() {
  const [bursts, setBursts] = useState<BurstSpec[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    return useGame.subscribe((s, prev) => {
      if (s.flashTick === prev.flashTick || s.flashTick === 0) return
      const color = s.lastResult === 'correct' ? '#46d27a' : '#ff4030'
      nextId.current += 1
      const id = nextId.current
      setBursts((b) => [...b, { id, x: carState.x, y: 1.5, z: carState.z, color }])
    })
  }, [])

  const remove = (id: number) => setBursts((b) => b.filter((x) => x.id !== id))

  return (
    <>
      {bursts.map((b) => (
        <Burst key={b.id} {...b} onDone={remove} />
      ))}
    </>
  )
}
