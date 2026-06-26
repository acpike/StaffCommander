import { useRef, useMemo, useEffect } from 'react'
import { useLoader, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// A flat landscape backdrop for the sky. Because the camera only ever looks
// forward down the track, a single image on a large billboard that follows the
// camera (and faces it) reads as a distant horizon — no 360° HDR needed. The
// material ignores fog/depth so it always sits behind the 3D world like a sky.
//
// `image` is a normal LDR jpg/png (cheap to load, no PMREM hitch). Pair it with
// a small <Environment> for the car's reflections.

const DIST = 280 // just inside the camera far plane (320); reads as the horizon
const HEIGHT = 380 // tall enough to fill the vertical FOV with margin

const _fwd = new THREE.Vector3()

export function Backdrop({ image, intensity = 1 }: { image: string; intensity?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const tex = useLoader(THREE.TextureLoader, image)

  const { width } = useMemo(() => {
    const img = tex.image as { width: number; height: number } | undefined
    const aspect = img && img.height ? img.width / img.height : 1.5
    tex.colorSpace = THREE.SRGBColorSpace
    return { width: HEIGHT * aspect }
  }, [tex])

  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    // forward direction flattened to the ground plane → place the plane that far
    // ahead and yaw it to face the camera; keep its horizon at world y≈0.
    _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion)
    _fwd.y = 0
    if (_fwd.lengthSq() < 1e-4) _fwd.set(0, 0, -1)
    _fwd.normalize()
    m.position.set(camera.position.x + _fwd.x * DIST, 0, camera.position.z + _fwd.z * DIST)
    m.rotation.set(0, Math.atan2(_fwd.x, _fwd.z), 0)
  })

  return (
    <mesh ref={ref} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[width, HEIGHT]} />
      <meshBasicMaterial
        map={tex}
        side={THREE.DoubleSide}
        fog={false}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        color={new THREE.Color(intensity, intensity, intensity)}
      />
    </mesh>
  )
}

// Image-based lighting from a plain LDR image: PMREM-process it into a small
// reflection map and hang it on scene.environment so metallic surfaces (the car)
// still catch light — without loading a multi-megabyte HDR. The image is treated
// as equirectangular; reflections are blurred enough that the approximation reads
// fine. A clone is used so the Backdrop's own (UV-mapped) texture is untouched.
export function ImageEnvironment({ image, intensity = 1 }: { image: string; intensity?: number }) {
  const { gl, scene } = useThree()
  const tex = useLoader(THREE.TextureLoader, image)

  useEffect(() => {
    const env = tex.clone()
    env.mapping = THREE.EquirectangularReflectionMapping
    env.colorSpace = THREE.SRGBColorSpace
    env.needsUpdate = true
    const pmrem = new THREE.PMREMGenerator(gl)
    const rt = pmrem.fromEquirectangular(env)
    const prevEnv = scene.environment
    const prevIntensity = scene.environmentIntensity
    scene.environment = rt.texture
    scene.environmentIntensity = intensity
    return () => {
      scene.environment = prevEnv
      scene.environmentIntensity = prevIntensity
      rt.dispose()
      env.dispose()
      pmrem.dispose()
    }
  }, [tex, gl, scene, intensity])

  return null
}
