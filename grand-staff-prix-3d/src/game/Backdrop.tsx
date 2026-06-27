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

// Live horizon-feather override: append ?fade=<fraction> (e.g. ?fade=0.4) to set
// how much of the backdrop's lower edge dissolves into the scene fog colour, so
// the painting melts into the 3D ground instead of ending on a hard line. NaN
// when absent → each <Backdrop> uses its own horizonFade prop.
const FADE_OVERRIDE =
  typeof location !== 'undefined'
    ? parseFloat(new URLSearchParams(location.search).get('fade') ?? 'NaN')
    : NaN

const _fwd = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _n = new THREE.Vector3()
const Z_AXIS = new THREE.Vector3(0, 0, 1)

// `offsetY` lifts the image up (fraction of the on-screen view height) so its
// painted horizon/mountains rise ABOVE the 3D ground line instead of hiding
// behind it. Tune per backdrop image (its horizon sits at a different height).
export function Backdrop({
  image,
  intensity = 1,
  offsetY = 0.18,
  horizonFade = 0.32,
}: {
  image: string
  intensity?: number
  offsetY?: number
  /** Fraction of the backdrop's lower edge that feathers into the fog colour. */
  horizonFade?: number
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

  // Feather the backdrop's lower edge into the scene fog colour. Done in-shader
  // (still an OPAQUE material, so it keeps drawing behind the 3D world and never
  // paints over the car) by mixing each texel toward `uFadeColor` over the lowest
  // `horizonFade` of the image height. uFadeColor tracks scene.fog each frame, so
  // the dissolve always matches the colour the 3D ground melts into → no hard line.
  const fade = Number.isFinite(FADE_OVERRIDE) ? FADE_OVERRIDE : horizonFade
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
      fog: false,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      color: new THREE.Color(intensity, intensity, intensity),
    })
    const fadeColor = new THREE.Color('#9FC2DE')
    m.userData.fadeColor = fadeColor
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uFadeColor = { value: fadeColor }
      shader.uniforms.uFadeEnd = { value: Math.max(0.001, fade) }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vBkY;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvBkY = uv.y;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vBkY;\nuniform vec3 uFadeColor;\nuniform float uFadeEnd;',
        )
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\n\tfloat _bf = 1.0 - smoothstep(0.0, uFadeEnd, vBkY);\n\tdiffuseColor.rgb = mix(diffuseColor.rgb, uFadeColor, _bf);',
        )
    }
    return m
  }, [tex, intensity, fade])

  useEffect(() => () => material.dispose(), [material])

  useFrame(({ camera }) => {
    // keep the feather colour locked to whatever the 3D ground fades into
    if (scene.fog && 'color' in scene.fog) {
      (material.userData.fadeColor as THREE.Color).copy((scene.fog as THREE.Fog).color)
    }
    const m = ref.current
    if (!m) return
    const cam = camera as THREE.PerspectiveCamera
    const vFov = (cam.fov * Math.PI) / 180
    const viewH = 2 * Math.tan(vFov / 2) * DIST
    const viewW = viewH * cam.aspect
    // FIT the image to the full frustum WIDTH (whole width always shown, no side
    // crop) and keep its true aspect. Slightly oversized so the (yaw-locked) quad
    // still covers the frustum when the camera yaws a touch while steering.
    const planeW = viewW * 1.05
    const planeH = planeW / aspect
    // slide vertically so the painted horizon meets the 3D ground line; tune per
    // image with the offsetY prop, or live for any image with ?bg=<n>.
    const oy = Number.isFinite(BG_OVERRIDE) ? BG_OVERRIDE : offsetY

    // Forward with YAW removed (keep the camera's pitch). Pinning the backdrop to
    // this yaw-free axis stops the painted horizon from swinging sideways when the
    // car steers — it reads as a fixed, distant sky instead of a layer that slides
    // around. Follows the camera position so there's still no parallax pop.
    cam.getWorldDirection(_fwd)
    _fwd.x = 0
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1)
    _fwd.normalize()
    _pos.copy(cam.position).addScaledVector(_fwd, DIST)
    _pos.y += oy * viewH // world-up vertical slide (no roll/yaw)
    m.position.copy(_pos)
    _n.copy(_fwd).multiplyScalar(-1) // face back toward the camera
    m.quaternion.setFromUnitVectors(Z_AXIS, _n) // pure pitch — no yaw, no roll
    m.scale.set(planeW, planeH, 1)
  })

  return (
    <mesh ref={ref} renderOrder={-1} frustumCulled={false} material={material}>
      <planeGeometry args={[1, 1]} />
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
