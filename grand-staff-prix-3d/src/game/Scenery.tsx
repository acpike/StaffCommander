import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { type Theme } from '../data/themes'
import { carState } from './carState'
import { Mountains } from './Mountains'
import { Terrain } from './Terrain'
import { RoadsideProps } from './RoadsideProps'

const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SKY_FRAG = `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    t = pow(t, 0.7);
    vec3 sky = mix(bottomColor, topColor, t);
    // brighter haze band right at the horizon for depth
    float horizon = 1.0 - smoothstep(0.0, 0.22, abs(dir.y));
    sky = mix(sky, mix(bottomColor, vec3(1.0), 0.18), horizon * 0.5);
    // soft sun glow toward the light direction
    float sd = max(dot(dir, normalize(sunDir)), 0.0);
    float glow = pow(sd, 8.0) * 0.6 + pow(sd, 64.0) * 0.9;
    sky += sunColor * glow * smoothstep(-0.05, 0.15, dir.y);
    gl_FragColor = vec4(sky, 1.0);
  }
`

function SkyDome({ theme }: { theme: Theme }) {
  const ref = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(theme.skyTop) },
      bottomColor: { value: new THREE.Color(theme.skyBottom) },
      sunColor: { value: new THREE.Color(theme.sun) },
      sunDir: { value: new THREE.Vector3(...theme.sunDir).normalize() },
    }),
    [theme.skyTop, theme.skyBottom, theme.sun, theme.sunDir],
  )
  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position)
  })
  return (
    <mesh ref={ref} frustumCulled={false}>
      <sphereGeometry args={[300, 32, 16]} />
      <shaderMaterial
        key={theme.id}
        vertexShader={SKY_VERT}
        fragmentShader={SKY_FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}

function Sun({ theme }: { theme: Theme }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useRef<THREE.Object3D>(null)
  useFrame(() => {
    const l = light.current
    const t = target.current
    if (!l || !t) return
    // bias the lit area ahead of the car so approaching gates cast contact shadows
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
        intensity={1.7}
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
      <Stars radius={120} depth={50} count={2200} factor={4} saturation={0} fade speed={0.5} />
    </group>
  )
}

export function Scenery({ theme }: { theme: Theme }) {
  return (
    <>
      <color attach="background" args={[theme.skyBottom]} />
      <fog attach="fog" args={[theme.fog, theme.fogNear, theme.fogFar]} />

      <ambientLight intensity={0.55} color={theme.ambient} />
      <hemisphereLight args={[theme.skyTop, theme.ground, 0.6]} />
      <Sun theme={theme} />

      <SkyDome theme={theme} />
      {theme.id === 'space' && <FollowStars />}

      {/* distant silhouette ranges, rolling flank terrain, streaming props */}
      <Mountains themeId={theme.id} />
      <Terrain themeId={theme.id} />
      <RoadsideProps themeId={theme.id} />

      {/* image-based lighting for reflections; loads async so the scene shows
          instantly via the gradient dome above */}
      <Suspense fallback={null}>
        <Environment preset={theme.envPreset} />
      </Suspense>
    </>
  )
}
