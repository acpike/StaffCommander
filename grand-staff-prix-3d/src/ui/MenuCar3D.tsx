// Live showroom car for the menu. Renders the shared CarModel on a glowing
// pedestal, slowly rotating, inside its own <Canvas>. The camera AUTO-FRAMES
// each car to its rotation-safe bounding sphere and re-fits on resize, so every
// car (tall buggy or flat F1) fills the frame identically in any orientation.

import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { carById, type CarSpec } from '../data/cars'
import { CarModel } from '../game/CarModel'

const VIEW_DIR = new THREE.Vector3(3.4, 2.0, 5.0).normalize() // 3/4 high angle

function Showroom({ car }: { car: CarSpec }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const ref = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const need = useRef(true)

  // re-fit whenever the car or the canvas size changes
  useEffect(() => {
    need.current = true
  }, [car.id, size.width, size.height])

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.45

    if (!need.current || !ref.current) return
    const box = new THREE.Box3().setFromObject(ref.current)
    const sz = box.getSize(new THREE.Vector3())
    if (sz.x < 0.05 || sz.y < 0.05) return // model not loaded yet
    need.current = false

    // rotation-safe radius: the horizontal footprint sweeps a circle as the car
    // spins, so use its diagonal (overestimate → never clips at any angle).
    const rXZ = Math.hypot(sz.x, sz.z) / 2
    const radius = Math.hypot(rXZ, sz.y / 2)
    const cy = (box.min.y + box.max.y) / 2

    const vFov = THREE.MathUtils.degToRad(camera.fov)
    const aspect = size.width / Math.max(1, size.height)
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const dist = (radius * 1.12) / Math.sin(Math.min(vFov, hFov) / 2)

    const center = new THREE.Vector3(0, cy, 0)
    camera.position.copy(center).addScaledVector(VIEW_DIR, dist)
    camera.lookAt(center)
    camera.updateProjectionMatrix()
  })

  return (
    <group ref={spin} rotation={[0, -0.7, 0]}>
      <group ref={ref}>
        <CarModel car={car} />
      </group>
    </group>
  )
}

function Pedestal({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <ringGeometry args={[1.7, 1.9, 64]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function MenuCar3D({ carId }: { carId: string }) {
  const spec = carById(carId)
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      shadows
      camera={{ position: [3.4, 2.0, 5.0], fov: 32 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.1
      }}
    >
      <ambientLight intensity={0.6} />
      <spotLight position={[5, 7, 4]} angle={0.5} penumbra={0.8} intensity={140} castShadow color="#ffffff" />
      <spotLight position={[-6, 4, -3]} angle={0.6} penumbra={1} intensity={60} color={spec.accent} />
      <pointLight position={[0, 3, -5]} intensity={35} color={spec.color} />

      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <Showroom key={spec.id} car={spec} />
      <Pedestal color={spec.color} />
      <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={4} blur={3} far={2.5} resolution={512} color="#000000" />

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.7} luminanceSmoothing={0.3} />
      </EffectComposer>
    </Canvas>
  )
}
