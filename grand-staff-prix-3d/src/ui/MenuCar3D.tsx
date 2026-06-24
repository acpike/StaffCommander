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

  useFrame((s) => {
    // gentle sway (stays ~3/4 view so the car can be framed tight + big)
    if (spin.current) spin.current.rotation.y = -0.5 + Math.sin(s.clock.elapsedTime * 0.5) * 0.4

    if (!need.current || !ref.current) return
    const box = new THREE.Box3().setFromObject(ref.current)
    const sz = box.getSize(new THREE.Vector3())
    if (sz.x < 0.05 || sz.y < 0.05) return // model not loaded yet
    need.current = false

    // Fit by the car's ACTUAL projected silhouette (not its sphere): place the
    // camera at a reference distance, project the 8 box corners, then scale the
    // distance so the limiting screen dimension fills TARGET of the frame.
    const ctr = box.getCenter(new THREE.Vector3())
    const D0 = 14
    camera.position.copy(ctr).addScaledVector(VIEW_DIR, D0)
    camera.lookAt(ctr)
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    let mx = 0
    let my = 0
    const c = new THREE.Vector3()
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera)
      mx = Math.max(mx, Math.abs(c.x))
      my = Math.max(my, Math.abs(c.y))
    }
    const fill = Math.max(mx, my)
    const TARGET = 0.9 // limiting dimension fills ~90% (AABB overestimate → ~85% real)
    const dist = D0 * (fill / TARGET)
    camera.position.copy(ctr).addScaledVector(VIEW_DIR, dist)
    camera.lookAt(ctr)
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
