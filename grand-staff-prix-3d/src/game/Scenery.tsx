import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { type Theme } from '../data/themes'
import { carState } from './carState'
import { CandyScene } from './CandyScene'
import { SFScene } from './SFScene'

// Deep Space: a real Milky-Way galaxy sky (public-domain equirect) + textured
// planets (NASA-derived public-domain maps), so the map matches its name.
function SpaceSky() {
  const camera = useThree((s) => s.camera)
  const ref = useRef<THREE.Mesh>(null)
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load('/tex/stars_milkyway.jpg')
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position)
  })
  return (
    <mesh ref={ref} frustumCulled={false}>
      <sphereGeometry args={[300, 48, 24]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

function Planet({ tex, size, dir, spin }: { tex: string; size: number; dir: [number, number, number]; spin: number }) {
  const camera = useThree((s) => s.camera)
  const ref = useRef<THREE.Mesh>(null)
  const map = useMemo(() => {
    const t = new THREE.TextureLoader().load(tex)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [tex])
  const d = useMemo(() => new THREE.Vector3(...dir).normalize(), [dir])
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.position.copy(camera.position).addScaledVector(d, 190)
    ref.current.rotation.y += Math.min(delta, 0.05) * spin
  })
  return (
    <mesh ref={ref} frustumCulled={false}>
      <sphereGeometry args={[size, 48, 32]} />
      <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.35} roughness={1} metalness={0} fog={false} />
    </mesh>
  )
}

// Real photographic skies: each theme loads a self-hosted CC0 HDRI (public/hdri)
// as both the background and the image-based lighting. This replaces the old
// procedural gradient dome + cheap silhouette mountains.

function Sun({ theme }: { theme: Theme }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useRef<THREE.Object3D>(null)
  useFrame(() => {
    const l = light.current
    const t = target.current
    if (!l || !t) return
    // keep the lit/shadowed area on the car + the gates just ahead
    l.position.set(carState.x + theme.sunDir[0], theme.sunDir[1], carState.z - 30 + theme.sunDir[2])
    t.position.set(carState.x, 0, carState.z - 30)
    t.updateMatrixWorld()
    l.target = t
  })
  return (
    <>
      <directionalLight
        ref={light}
        color={theme.sun}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0004}
      />
      <object3D ref={target} />
    </>
  )
}

function FollowStars() {
  const ref = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position)
  })
  return (
    <group ref={ref}>
      <Stars radius={120} depth={50} count={2600} factor={4} saturation={0} fade speed={0.5} />
    </group>
  )
}

export function Scenery({ theme }: { theme: Theme }) {
  return (
    <>
      {/* fallback colour shown only until the HDRI background loads */}
      <color attach="background" args={[theme.skyBottom]} />
      {/* light fog so the ground melts into the horizon without hiding the sky */}
      <fog attach="fog" args={[theme.fog, theme.fogNear + 60, theme.fogFar + 160]} />

      <ambientLight intensity={0.3} color={theme.ambient} />
      <hemisphereLight args={[theme.skyTop, theme.ground, 0.35]} />
      <Sun theme={theme} />

      {theme.id === 'space' ? (
        <>
          <SpaceSky />
          <Planet tex="/tex/planet_jupiter.jpg" size={34} dir={[-0.24, 0.12, -0.96]} spin={0.04} />
          <Planet tex="/tex/planet_mars.jpg" size={12} dir={[0.3, 0.09, -0.95]} spin={0.06} />
          <FollowStars />
          {/* dim IBL so the car still catches light in space */}
          <Suspense fallback={null}>
            <Environment files="/hdri/space.hdr" environmentIntensity={0.6} />
          </Suspense>
        </>
      ) : theme.id === 'city' ? (
        <>
          <SFScene />
          <Suspense fallback={null}>
            <Environment files="/hdri/city.hdr" environmentIntensity={0.7} />
          </Suspense>
        </>
      ) : theme.id === 'candy' ? (
        <>
          <CandyScene />
          {/* warm IBL only; the pink CandySky is the visible backdrop */}
          <Suspense fallback={null}>
            <Environment files="/hdri/candy.hdr" environmentIntensity={0.8} />
          </Suspense>
        </>
      ) : (
        /* photographic sky + image-based lighting (loads async; fallback colour above) */
        <Suspense fallback={null}>
          <Environment files={`/hdri/${theme.id}.hdr`} background backgroundBlurriness={0} environmentIntensity={1} />
        </Suspense>
      )}
    </>
  )
}
