import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_HALF } from './constants'
import { carState } from './carState'

// Candy Canyon: a deliberately stylized candy world (no real-world equivalent) —
// pink gradient sky, pastel gumdrop hills, and streaming roadside lollipops.

const SKY_VERT = `
  varying vec3 vDir;
  void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const SKY_FRAG = `
  uniform vec3 top; uniform vec3 bot;
  varying vec3 vDir;
  void main() {
    float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(mix(bot, top, pow(t, 0.8)), 1.0);
  }
`

function CandySky() {
  const ref = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const uniforms = useMemo(
    () => ({ top: { value: new THREE.Color('#ff79c0') }, bot: { value: new THREE.Color('#ffe3f4') } }),
    [],
  )
  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position)
  })
  return (
    <mesh ref={ref} frustumCulled={false}>
      <sphereGeometry args={[290, 32, 16]} />
      <shaderMaterial vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}

const HILL_COLORS = ['#ff9ed6', '#b39cff', '#9ff0d6', '#ffd58a', '#ff8fb0']

function CandyHills() {
  const ref = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  // soft pastel gumdrop domes ringing the far horizon
  const hills = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const ang = (i / 5) * Math.PI * 2
        return {
          x: Math.sin(ang) * 230,
          z: -Math.cos(ang) * 230,
          r: 50 + ((i * 13) % 35),
          color: HILL_COLORS[i % HILL_COLORS.length],
        }
      }),
    [],
  )
  useFrame(() => {
    if (ref.current) ref.current.position.set(camera.position.x, 0, camera.position.z)
  })
  return (
    <group ref={ref}>
      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, -h.r * 0.55, h.z]}>
          <sphereGeometry args={[h.r, 16, 10]} />
          <meshStandardMaterial color={h.color} roughness={0.85} metalness={0} fog={false} />
        </mesh>
      ))}
    </group>
  )
}

const POPS = 10
const POP_SPACING = 22
const POP_COLORS = ['#ff5fa2', '#ffd35c', '#5fe0c0', '#c79bff', '#ff8fc7', '#8fd0ff']
const POP_H = 3.4

function Lollipops() {
  const left = useRef<(THREE.Group | null)[]>([])
  const right = useRef<(THREE.Group | null)[]>([])
  // shared geometries + materials (perf: no per-lollipop allocation, no shadow casters)
  const stickGeo = useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, POP_H, 8), [])
  const discGeo = useMemo(() => new THREE.TorusGeometry(0.95, 0.42, 10, 18), [])
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.55, 12, 12), [])
  const stickMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff3fa', roughness: 0.5 }), [])
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 }), [])
  const colorMats = useMemo(() => POP_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.05 })), [])

  useFrame(() => {
    const baseline = (Math.floor(carState.z / POP_SPACING) + 2) * POP_SPACING
    for (let j = 0; j < POPS; j++) {
      const z = baseline - j * POP_SPACING
      const l = left.current[j]
      const r = right.current[j]
      if (l) l.position.z = z
      if (r) r.position.z = z
    }
  })
  const lolly = (key: string, side: number, j: number, ref: (g: THREE.Group | null) => void) => {
    const mat = colorMats[(j + (side > 0 ? 0 : 3)) % colorMats.length]
    return (
      <group key={key} ref={ref} position={[side * (TRACK_HALF + 3.5), 0, 0]}>
        <mesh position={[0, POP_H / 2, 0]} geometry={stickGeo} material={stickMat} />
        <mesh position={[0, POP_H + 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={discGeo} material={mat} />
        <mesh position={[0, POP_H + 1.1, 0.02]} geometry={sphereGeo} material={whiteMat} />
      </group>
    )
  }
  return (
    <>
      {Array.from({ length: POPS }).map((_, j) => lolly(`ll${j}`, 1, j, (g) => { left.current[j] = g }))}
      {Array.from({ length: POPS }).map((_, j) => lolly(`lr${j}`, -1, j, (g) => { right.current[j] = g }))}
    </>
  )
}

export function CandyScene() {
  return (
    <>
      <CandySky />
      <CandyHills />
      <Lollipops />
    </>
  )
}
