import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { type Theme } from '../data/themes'
import { carState } from './carState'
import { CandyScene } from './CandyScene'
import { isTouchDevice } from '../util/device'
import { SFScene } from './SFScene'
import { MountainScene } from './MountainScene'
import { DesertScene } from './DesertScene'
import { SpaceScene } from './SpaceScene'
import { Backdrop, ImageEnvironment } from './Backdrop'

// Deep Space: a painted galaxy backdrop (flat quad, same as the other themes) +
// textured planets (NASA-derived public-domain maps) streaming in front for depth.
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
        shadow-mapSize-width={isTouchDevice ? 1024 : 2048}
        shadow-mapSize-height={isTouchDevice ? 1024 : 2048}
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
          {/* painted galaxy backdrop; planets + stars stream in front for depth,
              plus a scattered crystal/asteroid field flanking the road */}
          <SpaceScene />
          <Planet tex="/tex/planet_jupiter.jpg" size={20} dir={[-0.28, 0.18, -0.94]} spin={0.04} />
          <Planet tex="/tex/planet_mars.jpg" size={12} dir={[0.3, 0.1, -0.95]} spin={0.06} />
          <FollowStars />
          <Suspense fallback={null}>
            {/* deep nebula-purple fog + sky so the open void matches the purple
                galaxy backdrop (no stark-black horizon) — it all reads as one space */}
            <Backdrop image="/backdrops/space.jpg" offsetY={0.24} fogColor="#332a5c" skyColor="#231b46" />
            <ImageEnvironment image="/backdrops/space.jpg" intensity={0.6} />
          </Suspense>
        </>
      ) : theme.id === 'city' ? (
        <>
          <SFScene />
          {/* flat painted SF skyline (LDR jpg) instead of the HDR skybox. This is
              now the Marin Headlands at golden hour — the city + Golden Gate sit
              warm in the painted distance, so we drive the scene fog/sky with a
              soft warm golden haze (not the old bay blue). The lower-edge feather
              follows scene.fog, so the golden-green hills dissolve into the same
              warm haze where they meet the painted sunset horizon. */}
          <Suspense fallback={null}>
            <Backdrop image="/backdrops/city.jpg" fogColor="#E3C79E" skyColor="#F1D9B2" offsetY={0.24} />
            <ImageEnvironment image="/backdrops/city.jpg" intensity={0.9} />
          </Suspense>
        </>
      ) : theme.id === 'candy' ? (
        <>
          <CandyScene />
          {/* painted candy horizon (LDR jpg) replaces the old gradient CandySky.
              Uses the same default framing as mountain/desert. */}
          <Suspense fallback={null}>
            <Backdrop image="/backdrops/candy.jpg" offsetY={0.24} />
            <ImageEnvironment image="/backdrops/candy.jpg" intensity={0.85} />
          </Suspense>
        </>
      ) : theme.id === 'mountain' ? (
        <>
          <MountainScene />
          {/* flat painted alpine horizon (LDR jpg) instead of the HDR skybox */}
          <Suspense fallback={null}>
            <Backdrop image="/backdrops/mountain.jpg" />
            <ImageEnvironment image="/backdrops/mountain.jpg" intensity={1} />
          </Suspense>
        </>
      ) : theme.id === 'desert' ? (
        <>
          <DesertScene />
          {/* flat painted sky (cheap LDR jpg) instead of a 5 MB HDR skybox, plus a
              small reflection map built from the same image for the car's shine */}
          <Suspense fallback={null}>
            <Backdrop image="/backdrops/desert.jpg" />
            <ImageEnvironment image="/backdrops/desert.jpg" intensity={1} />
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
