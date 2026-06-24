import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneryFor, type RidgeKind } from './envConfig'

// Distant silhouette ridge bands. Each band is a single tall mesh whose top edge
// is shaped per theme (jagged peaks, blocky skyline, flat-top mesas, soft rolling
// hills, chunky asteroid clusters). The bands ring the horizon and follow the
// camera on X/Z so the world reads as infinite. They are deliberately far out and
// fog-blended so they cost almost nothing and never reveal a seam.

const SEG = 96 // horizontal segments across one ridge band

// Deterministic value noise so a theme always builds the same skyline.
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}
function smoothNoise(x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return hash(i) * (1 - u) + hash(i + 1) * u
}

/** Returns a 0..1 silhouette height for the given normalised position t (0..1). */
function silhouette(kind: RidgeKind, t: number, seed: number): number {
  const x = t * 12 + seed * 17.3
  switch (kind) {
    case 'peaks': {
      const a = smoothNoise(x * 0.9)
      const b = smoothNoise(x * 2.3) * 0.5
      const c = smoothNoise(x * 5.1) * 0.22
      return Math.min(1, (a + b + c) / 1.5)
    }
    case 'skyline': {
      // quantise into building blocks with varied heights
      const block = Math.floor(x * 1.6)
      return 0.25 + hash(block + seed * 31) * 0.75
    }
    case 'mesas': {
      // flat-topped plateaus: round the noise into terraces
      const n = smoothNoise(x * 0.7) + smoothNoise(x * 1.9) * 0.35
      return Math.min(1, Math.round((n / 1.35) * 4) / 4)
    }
    case 'rolling': {
      const a = smoothNoise(x * 0.8)
      const b = smoothNoise(x * 1.7) * 0.4
      return (a + b) / 1.4
    }
    case 'asteroids': {
      // sparse lumps with gaps near the horizon
      const lump = smoothNoise(x * 2.6)
      return lump > 0.55 ? (lump - 0.55) / 0.45 : 0
    }
  }
}

/** Build a band geometry: a wide vertical strip whose top edge is the silhouette. */
function makeBandGeometry(kind: RidgeKind, width: number, height: number, seed: number): THREE.BufferGeometry {
  const positions: number[] = []
  const half = width / 2
  for (let i = 0; i < SEG; i++) {
    const t0 = i / SEG
    const t1 = (i + 1) / SEG
    const x0 = -half + t0 * width
    const x1 = -half + t1 * width
    const h0 = silhouette(kind, t0, seed) * height
    const h1 = silhouette(kind, t1, seed) * height
    // two triangles forming the quad from baseline (y=-2) up to the silhouette
    const yb = -2
    positions.push(x0, yb, 0, x1, yb, 0, x1, h1, 0)
    positions.push(x0, yb, 0, x1, h1, 0, x0, h0, 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}

interface BandDef {
  geom: THREE.BufferGeometry
  color: string
  /** Distance out from camera (the band wraps the horizon at this radius). */
  radius: number
}

export function Mountains({ themeId }: { themeId: string }) {
  const cfg = sceneryFor(themeId)
  const group = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)

  const bands = useMemo<BandDef[]>(() => {
    const out: BandDef[] = []
    const n = cfg.ridge.bands.length
    cfg.ridge.bands.forEach((color, i) => {
      // farthest band is index 0 → largest radius, tallest; nearer bands shrink in
      const far = n - 1 - i
      const radius = 150 + far * 45
      const width = radius * 4
      const height = cfg.ridge.height * (0.6 + 0.4 * (i / Math.max(1, n - 1)))
      out.push({ geom: makeBandGeometry(cfg.ridge.kind, width, height, i + 1), color, radius })
    })
    return out
  }, [cfg.ridge.kind, cfg.ridge.height, cfg.ridge.bands])

  // dispose geometries when the theme changes / on unmount
  useEffect(() => {
    return () => {
      for (const b of bands) b.geom.dispose()
    }
  }, [bands])

  useFrame(() => {
    if (group.current) {
      group.current.position.x = camera.position.x
      group.current.position.z = camera.position.z
    }
  })

  return (
    <group ref={group}>
      {bands.map((b, i) => (
        // four copies ring the horizon (front/back/left/right) so the silhouette
        // is continuous all the way around as the camera turns/moves.
        <group key={i}>
          <mesh geometry={b.geom} position={[0, 0, -b.radius]} renderOrder={-10}>
            <meshBasicMaterial color={b.color} fog side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh geometry={b.geom} position={[0, 0, b.radius]} rotation={[0, Math.PI, 0]} renderOrder={-10}>
            <meshBasicMaterial color={b.color} fog side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh geometry={b.geom} position={[-b.radius, 0, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={-10}>
            <meshBasicMaterial color={b.color} fog side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh geometry={b.geom} position={[b.radius, 0, 0]} rotation={[0, -Math.PI / 2, 0]} renderOrder={-10}>
            <meshBasicMaterial color={b.color} fog side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
