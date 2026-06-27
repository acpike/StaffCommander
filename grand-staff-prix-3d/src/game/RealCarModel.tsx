import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useGame, activeProfile } from '../state/store'
import { avatarById, type AvatarSpec } from '../data/avatars'
import { carById, CAR_MODEL_PATHS } from '../data/cars'
import { visibleBox } from './RealCar'

/**
 * RealCarModel — a drop-in replacement for CarModel with the SAME public API:
 *
 *   <RealCarModel color="#FF4E2E" accent="#2A1410" />
 *
 * Orientation matches the legacy CarModel exactly:
 *   - the NOSE / headlights point toward -Z
 *   - the TAIL / wing / taillights point toward +Z
 *   - footprint ~1.8 wide x 3.7 long, wheels resting near y = -0.18
 * so it drops into game/Car.tsx and ui/MenuCar3D.tsx without any other change.
 *
 * Loading strategy
 * ----------------
 * If the active car in data/cars.ts declares a `model` path (a GLB under
 * /public/models), we load + clone it via drei's useGLTF and re-tint its body
 * material to `color` (trim/accents to `accent`). If no model is declared — or
 * for any car that ships without one — we render a richly detailed PROCEDURAL
 * car built from curved Lathe/Extrude/Capsule geometry with PBR clearcoat
 * paint. Both paths render inside the existing <Canvas>; neither adds its own.
 *
 * NOTE (build agent): no GLB assets are bundled in this repo yet — the outbound
 * network was sandboxed at build time, so the procedural path is what renders
 * today. Drop a sleek GLB into /public/models, set `model`/`modelScale`/etc. on
 * a car in data/cars.ts, and the GltfBody path below lights up automatically.
 */

export function RealCarModel({ color, accent }: { color: string; accent: string }) {
  const profile = useGame(activeProfile)
  const avatar = avatarById(profile?.avatar)
  const carId = useGame((s) => s.settings.carId)
  const spec = carById(carId)

  return (
    <group>
      {/* seated driver, read from the active profile's chosen avatar */}
      <Driver avatar={avatar} />
      {spec.model ? (
        <GltfBody
          color={color}
          accent={accent}
          src={spec.model}
          scale={spec.modelScale ?? 1}
          rotationY={spec.modelRotation ?? 0}
          yOffset={spec.modelYOffset ?? 0}
        />
      ) : (
        <ProceduralBody color={color} accent={accent} />
      )}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  GLB path                                                                   */
/* -------------------------------------------------------------------------- */

function GltfBody({
  color,
  accent,
  src,
  scale,
  rotationY,
  yOffset,
}: {
  color: string
  accent: string
  src: string
  scale: number
  rotationY: number
  yOffset: number
}) {
  const { scene } = useGLTF(src)

  // Clone once per (src,color,accent) so every car instance gets its own
  // materials to tint without mutating the cached source scene.
  const cloned = useMemo(() => {
    const root = scene.clone(true)
    const paint = makePaint(color)
    const trim = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.6, roughness: 0.35 })

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const name = (mesh.name + ' ' + (mesh.material as THREE.Material)?.name).toLowerCase()

      // Heuristic re-tint: leave glass / tyres / lights alone, recolor body.
      if (/glass|window|windscreen|windshield|screen/.test(name)) return
      if (/tire|tyre|wheel|rubber|rim/.test(name)) return
      if (/light|lamp|head|tail|glow|emiss/.test(name)) return
      if (/trim|accent|stripe|detail|spoiler|wing|chrome/.test(name)) {
        mesh.material = trim
        return
      }
      // Everything else is treated as paintable bodywork.
      mesh.material = paint.clone()
    })

    // Auto-ground: centre on x/z and drop the lowest visible point (wheels) to
    // y = 0 so the model rests on the road no matter where its GLB origin sits.
    // The outer group's `yOffset` then nudges from that grounded baseline.
    const box = visibleBox(root)
    const ctr = new THREE.Vector3()
    box.getCenter(ctr)
    root.position.x -= ctr.x
    root.position.z -= ctr.z
    root.position.y -= box.min.y
    return root
  }, [scene, color, accent])

  return (
    <group rotation={[0, rotationY, 0]} position={[0, yOffset, 0]} scale={scale}>
      <primitive object={cloned} />
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Shared material helpers                                                     */
/* -------------------------------------------------------------------------- */

function makePaint(color: string) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.55,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.4,
  })
}

/* -------------------------------------------------------------------------- */
/*  Procedural path — a detailed sports car from curved geometry               */
/* -------------------------------------------------------------------------- */

/**
 * Smooth, full-length body silhouette via LatheGeometry rotated to lie along Z,
 * then squashed in X so it reads as a low, wide car rather than a tube.
 * Profile points are (radius, height) sampled along the car's centre line.
 */
function bodyGeometry(): THREE.BufferGeometry {
  // (z, halfHeight) silhouette from nose (-1.95) to tail (+1.95)
  const profile: Array<[number, number]> = [
    [-1.95, 0.16],
    [-1.7, 0.26],
    [-1.3, 0.34],
    [-0.8, 0.42],
    [-0.2, 0.46],
    [0.3, 0.45],
    [0.9, 0.4],
    [1.5, 0.34],
    [1.9, 0.26],
    [1.95, 0.18],
  ]
  // Build a lathe-like surface by sweeping a half-ellipse cross-section along Z.
  const radial = 18
  const positions: number[] = []
  const indices: number[] = []
  const halfWidth = 0.92
  const ringCount = profile.length
  for (let i = 0; i < ringCount; i++) {
    const [z, h] = profile[i]
    // taper width with height profile a touch so nose/tail pinch in
    const w = halfWidth * (0.55 + 0.45 * (h / 0.46))
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI // top half only (0..PI), flat floor
      const x = Math.cos(a) * w
      const y = Math.sin(a) * h
      positions.push(x, y, z)
    }
  }
  const stride = radial + 1
  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j
      const b = a + 1
      const c = a + stride
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export function ProceduralBody({ color, accent }: { color: string; accent: string }) {
  const body = useMemo(bodyGeometry, [])
  const paint = useMemo(() => makePaint(color), [color])

  return (
    <group>
      {/* main moulded body shell */}
      <mesh geometry={body} material={paint} position={[0, -0.06, 0]} castShadow receiveShadow />

      {/* underbody floor so there's no see-through gap under the open lathe */}
      <mesh position={[0, -0.07, 0]} receiveShadow>
        <boxGeometry args={[1.7, 0.16, 3.7]} />
        <primitive object={paint} attach="material" />
      </mesh>

      {/* glass canopy / greenhouse */}
      <mesh position={[0, 0.46, 0.1]} castShadow>
        <sphereGeometry args={[0.6, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshPhysicalMaterial
          color="#10131c"
          metalness={0.2}
          roughness={0.04}
          transmission={0.25}
          thickness={0.4}
          envMapIntensity={2}
          clearcoat={1}
        />
      </mesh>
      {/* canopy frame fairing to blend glass into body */}
      <mesh position={[0, 0.34, 0.12]} scale={[1, 1, 1.45]} castShadow>
        <sphereGeometry args={[0.6, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <primitive object={paint} attach="material" />
      </mesh>

      {/* accent dorsal stripe down the spine */}
      <mesh position={[0, 0.5, -0.5]}>
        <boxGeometry args={[0.22, 0.04, 2.4]} />
        <meshStandardMaterial color={accent} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* side mirrors */}
      <Mirror side={1} accent={accent} />
      <Mirror side={-1} accent={accent} />

      {/* front splitter */}
      <mesh position={[0, -0.18, -1.92]} castShadow>
        <boxGeometry args={[1.6, 0.06, 0.3]} />
        <meshStandardMaterial color={accent} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* rear diffuser */}
      <mesh position={[0, -0.16, 1.92]} castShadow>
        <boxGeometry args={[1.5, 0.16, 0.28]} />
        <meshStandardMaterial color="#16151c" metalness={0.3} roughness={0.6} />
      </mesh>

      {/* rear wing */}
      <mesh position={[0, 0.6, 1.85]} castShadow>
        <boxGeometry args={[1.7, 0.05, 0.42]} />
        <primitive object={paint} attach="material" />
      </mesh>
      <mesh position={[0.72, 0.46, 1.85]} castShadow>
        <boxGeometry args={[0.07, 0.34, 0.28]} />
        <meshStandardMaterial color="#16151c" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[-0.72, 0.46, 1.85]} castShadow>
        <boxGeometry args={[0.07, 0.34, 0.28]} />
        <meshStandardMaterial color="#16151c" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* headlights (point -Z) */}
      <Light position={[0.56, 0.02, -1.88]} color="#fff7e0" emissive="#fff2cf" intensity={2.6} w={0.32} h={0.16} />
      <Light position={[-0.56, 0.02, -1.88]} color="#fff7e0" emissive="#fff2cf" intensity={2.6} w={0.32} h={0.16} />

      {/* taillight bar (point +Z) */}
      <Light position={[0.5, 0.18, 1.9]} color="#ff2b2b" emissive="#ff1a1a" intensity={2.8} w={0.42} h={0.12} />
      <Light position={[-0.5, 0.18, 1.9]} color="#ff2b2b" emissive="#ff1a1a" intensity={2.8} w={0.42} h={0.12} />

      {/* wheels */}
      <DetailedWheel position={[0.96, -0.18, -1.2]} accent={accent} />
      <DetailedWheel position={[-0.96, -0.18, -1.2]} accent={accent} />
      <DetailedWheel position={[0.96, -0.18, 1.3]} accent={accent} />
      <DetailedWheel position={[-0.96, -0.18, 1.3]} accent={accent} />
    </group>
  )
}

function Mirror({ side, accent }: { side: 1 | -1; accent: string }) {
  return (
    <group position={[side * 0.92, 0.34, -0.2]}>
      <mesh rotation={[0, 0, side * -0.3]} castShadow>
        <boxGeometry args={[0.18, 0.04, 0.12]} />
        <meshStandardMaterial color={accent} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[side * 0.12, 0.04, 0]} castShadow>
        <boxGeometry args={[0.05, 0.12, 0.14]} />
        <meshStandardMaterial color="#0c0e16" metalness={0.6} roughness={0.2} />
      </mesh>
    </group>
  )
}

function Light({
  position,
  color,
  emissive,
  intensity,
  w,
  h,
}: {
  position: [number, number, number]
  color: string
  emissive: string
  intensity: number
  w: number
  h: number
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={[w, h, 0.06]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={intensity} toneMapped={false} />
    </mesh>
  )
}

/** A proper wheel: rubber tyre + alloy rim with spokes + brake disc. */
function DetailedWheel({
  position,
  accent,
}: {
  position: [number, number, number]
  accent: string
}) {
  const spokes = useMemo(() => [0, 1, 2, 3, 4].map((i) => (i / 5) * Math.PI * 2), [])
  const outer = position[0] > 0 ? 0.17 : -0.17
  return (
    <group position={position}>
      {/* tyre */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.44, 0.44, 0.34, 28]} />
        <meshStandardMaterial color="#15141a" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* tyre sidewall bevel */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.4, 0.32, 28]} />
        <meshStandardMaterial color="#0d0c11" roughness={0.95} metalness={0.05} />
      </mesh>
      {/* brake disc */}
      <mesh position={[outer * 0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.26, 0.26, 0.04, 24]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.4} />
      </mesh>
      {/* alloy rim hub */}
      <mesh position={[outer, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.06, 20]} />
        <meshStandardMaterial color={accent} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* spokes */}
      {spokes.map((a, i) => (
        <mesh key={i} position={[outer, 0, 0]} rotation={[a, 0, 0]}>
          <boxGeometry args={[0.05, 0.56, 0.1]} />
          <meshStandardMaterial color={accent} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* centre cap */}
      <mesh position={[outer + (position[0] > 0 ? 0.02 : -0.02), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
        <meshStandardMaterial color="#1a1a22" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Driver — mirrors the figure from CarModel so the cockpit isn't empty       */
/* -------------------------------------------------------------------------- */

function Driver({ avatar }: { avatar: AvatarSpec }) {
  const helmetY = avatar.shape === 'tall' ? 0.06 : 0
  const helmetScaleY = avatar.shape === 'tall' ? 1.18 : 1
  return (
    <group position={[0, 0.5, 0.25]} scale={0.5}>
      <mesh position={[0, -0.32, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.22, 4, 12]} />
        <meshStandardMaterial color={avatar.suit} roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.12, 12]} />
        <meshStandardMaterial color={avatar.suit} roughness={0.6} metalness={0.1} />
      </mesh>
      <group position={[0, helmetY, 0]} scale={[1, helmetScaleY, 1]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <sphereGeometry args={[0.21, 20, 20]} />
          <meshStandardMaterial color={avatar.helmet} roughness={0.28} metalness={0.35} envMapIntensity={1.2} />
        </mesh>
        {avatar.shape === 'crested' && (
          <mesh position={[0, 0.27, -0.02]} castShadow>
            <boxGeometry args={[0.05, 0.16, 0.26]} />
            <meshStandardMaterial color={avatar.helmet} roughness={0.3} metalness={0.4} />
          </mesh>
        )}
        <mesh position={[0, 0.1, 0.16]}>
          <boxGeometry args={[0.3, 0.12, 0.12]} />
          <meshStandardMaterial
            color={avatar.visor}
            roughness={0.08}
            metalness={0.7}
            emissive={avatar.visor}
            emissiveIntensity={0.25}
            envMapIntensity={2}
          />
        </mesh>
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Preload any car models declared in data/cars.ts                            */
/* -------------------------------------------------------------------------- */

for (const m of CAR_MODEL_PATHS) {
  useGLTF.preload(m)
}
