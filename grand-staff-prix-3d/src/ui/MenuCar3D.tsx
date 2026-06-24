// Live showroom car for the main menu. Renders the SAME shared CarModel used by
// the in-game car (game/CarModel.tsx) on a studio pedestal, slowly rotating,
// inside its own <Canvas> (separate from the game scene — only one is ever
// mounted at a time, since the game canvas unmounts on the menu screen).

import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Float } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { carById } from '../data/cars'
import { CarModel } from '../game/CarModel'

function Turntable({ color, accent }: { color: string; accent: string }) {
  const root = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (root.current) root.current.rotation.y += delta * 0.45
  })
  return (
    <group ref={root} rotation={[0, -0.7, 0]}>
      <CarModel color={color} accent={accent} />
    </group>
  )
}

function Pedestal({ color }: { color: string }) {
  // Just a glowing ring on the floor — no solid disc, so nothing dark sits
  // behind the car.
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.58, 0]}>
      <ringGeometry args={[1.7, 1.9, 64]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function AimCamera() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.lookAt(0, 0.05, 0)
  }, [camera])
  return null
}

export function MenuCar3D({ carId }: { carId: string }) {
  const spec = carById(carId)

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      shadows
      camera={{ position: [3.8, 2.1, 5.6], fov: 38 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.1
      }}
    >
      <AimCamera />

      {/* studio key + rim lighting */}
      <ambientLight intensity={0.6} />
      <spotLight position={[5, 7, 4]} angle={0.5} penumbra={0.8} intensity={140} castShadow color="#ffffff" />
      <spotLight position={[-6, 4, -3]} angle={0.6} penumbra={1} intensity={60} color={spec.accent} />
      <pointLight position={[0, 3, -5]} intensity={35} color={spec.color} />

      {/* reflections — isolated so the car renders immediately even if the HDR is slow */}
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <Float speed={1.4} rotationIntensity={0} floatIntensity={0.4} floatingRange={[-0.04, 0.06]}>
        <Turntable key={spec.id} color={spec.color} accent={spec.accent} />
      </Float>

      <Pedestal color={spec.color} />

      <ContactShadows position={[0, -0.58, 0]} opacity={0.32} scale={4} blur={3} far={2.5} resolution={512} color="#000000" />

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.7} luminanceSmoothing={0.3} />
      </EffectComposer>
    </Canvas>
  )
}
