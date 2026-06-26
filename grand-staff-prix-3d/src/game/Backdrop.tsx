import { useRef, useMemo, useEffect } from 'react'
import { useLoader, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleBandFromImage } from '../util/sampleImageBand'

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

// Live vertical-tuning override: append ?bg=<fraction> (e.g. ?bg=0.1) to slide
// EVERY backdrop up/down without a rebuild — for dialing a horizon in. NaN when
// absent, so each <Backdrop> falls back to its own offsetY prop.
const BG_OVERRIDE =
  typeof location !== 'undefined'
    ? parseFloat(new URLSearchParams(location.search).get('bg') ?? 'NaN')
    : NaN

const _fwd = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _up = new THREE.Vector3()

// `offsetY` lifts the image up (fraction of the on-screen view height) so its
// painted horizon/mountains rise ABOVE the 3D ground line instead of hiding
// behind it. Tune per backdrop image (its horizon sits at a different height).
export function Backdrop({
  image,
  intensity = 1,
  offsetY = 0.18,
}: {
  image: string
  intensity?: number
  offsetY?: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  const tex = useLoader(THREE.TextureLoader, image)
  const { scene } = useThree()

  const aspect = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    const img = tex.image as { width: number; height: number } | undefined
    return img && img.height ? img.width / img.height : 1.5
  }, [tex])

  // Seamless seam: sample the backdrop's OWN colours and drive the 3D scene's
  // fog (the band where the road melts into the horizon) and the sky-gap
  // background from them — so the painted image and the 3D world blend with no
  // visible line. Sampled once per image from a 32×32 downscaled copy: a horizon
  // band → fog colour, the top strip → background colour.
  useEffect(() => {
    const img = tex.image as HTMLImageElement | undefined
    if (!img || !img.width) return
    // horizon band → fog colour; top strip → sky-gap background colour.
    const horizon = sampleBandFromImage(img, 0.52, 0.7)
    const sky = sampleBandFromImage(img, 0, 0.18)
    if (horizon && scene.fog && 'color' in scene.fog) (scene.fog as THREE.Fog).color.copy(horizon)
    if (sky && scene.background instanceof THREE.Color) scene.background.copy(sky)
  }, [tex, scene])

  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    const cam = camera as THREE.PerspectiveCamera
    // place a screen-aligned quad DIST in front of the camera, facing it
    cam.getWorldDirection(_fwd)
    _pos.copy(cam.position).addScaledVector(_fwd, DIST)
    const vFov = (cam.fov * Math.PI) / 180
    const viewH = 2 * Math.tan(vFov / 2) * DIST
    const viewW = viewH * cam.aspect
    // FIT the image to the full frustum WIDTH (whole width always shown, no side
    // crop) and keep its true aspect — so the painting isn't over-zoomed into a
    // small centre band. A wide image then sits as an upper "sky strip" with the
    // 3D ground filling in below it.
    const planeW = viewW * 1.02
    const planeH = planeW / aspect
    // slide vertically so the painted horizon meets the 3D ground line; tune per
    // image with the offsetY prop, or live for any image with ?bg=<n>.
    const oy = Number.isFinite(BG_OVERRIDE) ? BG_OVERRIDE : offsetY
    _up.set(0, 1, 0).applyQuaternion(cam.quaternion)
    _pos.addScaledVector(_up, oy * viewH)
    m.position.copy(_pos)
    m.quaternion.copy(cam.quaternion)
    m.scale.set(planeW, planeH, 1)
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
