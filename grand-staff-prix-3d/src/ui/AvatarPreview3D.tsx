// Small live 3D preview of the player's built character. Its own <Canvas>,
// studio-lit, slowly rotating, used inside the AvatarBuilder so picking an
// option updates the figure instantly. Renders the SAME AvatarCharacter that
// rides in the car cockpit.

import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'
import type { AvatarConfig } from '../data/avatars'
import { AvatarCharacter } from '../game/AvatarCharacter'

function Turntable({ config }: { config: AvatarConfig }) {
  const root = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (root.current) root.current.rotation.y += delta * 0.5
  })
  return (
    <group ref={root}>
      <AvatarCharacter config={config} />
    </group>
  )
}

function AimCamera() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.lookAt(0, 0.05, 0)
  }, [camera])
  return null
}

export function AvatarPreview3D({ config }: { config: AvatarConfig }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      shadows
      camera={{ position: [0, 0.35, 2.7], fov: 34 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <AimCamera />

      <ambientLight intensity={0.7} />
      <spotLight position={[3, 5, 4]} angle={0.6} penumbra={0.9} intensity={90} castShadow color="#ffffff" />
      <spotLight position={[-4, 2, -2]} angle={0.7} penumbra={1} intensity={30} color="#ff8a3d" />
      <pointLight position={[0, 1.5, -3]} intensity={14} color="#6b8bff" />

      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <group position={[0, -0.45, 0]} scale={1.15}>
        <Turntable config={config} />
      </group>

      <ContactShadows position={[0, -1.05, 0]} opacity={0.3} scale={3} blur={3} far={2} resolution={512} color="#000000" />
    </Canvas>
  )
}
