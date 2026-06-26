import { useRef, useMemo, useEffect } from 'react'
import { useLoader, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// A flat landscape backdrop for the sky. Because the camera only ever looks
// forward down the track, a single image on a screen-filling quad that rides
// with the camera reads as a distant horizon — no 360° HDR needed. Each frame
// the quad is sized to exactly cover the camera frustum (so it fills any aspect
// ratio) and oriented to face the camera; the material ignores fog/depth so it
// always sits behind the 3D world like a sky.
//
// `image` is a normal LDR jpg/png (cheap to load, no PMREM hitch). Pair it with
// <ImageEnvironment> for the car's reflections.

const DIST = 300 // just inside the camera far plane (320); size scales with it

const _fwd = new THREE.Vector3()
const _pos = new THREE.Vector3()

export function Backdrop({ image, intensity = 1 }: { image: string; intensity?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const tex = useLoader(THREE.TextureLoader, image)

  const aspect = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    const img = tex.image as { width: number; height: number } | undefined
    return img && img.height ? img.width / img.height : 1.5
  }, [tex])

  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    const cam = camera as THREE.PerspectiveCamera
    // place a screen-aligned quad DIST in front of the camera, facing it
    cam.getWorldDirection(_fwd)
    _pos.copy(cam.position).addScaledVector(_fwd, DIST)
    m.position.copy(_pos)
    m.quaternion.copy(cam.quaternion)
    // size it to COVER the frustum at that distance (fill the screen, no stretch)
    const vFov = (cam.fov * Math.PI) / 180
    const viewH = 2 * Math.tan(vFov / 2) * DIST
    const viewW = viewH * cam.aspect
    const planeH = Math.max(viewH, viewW / aspect) * 1.08 // 8% margin
    m.scale.set(planeH * aspect, planeH, 1)
  })

  return (
    <mesh ref={ref} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
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
