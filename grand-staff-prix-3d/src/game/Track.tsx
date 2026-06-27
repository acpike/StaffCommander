import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { type Theme } from '../data/themes'
import { carState } from './carState'
import { TRACK_HALF } from './constants'
import { sampleImageBand, asTint } from '../util/sampleImageBand'

// Road/ground length. Centered on the car, so it reaches ROAD_LEN/2 ahead — kept
// past where the fog goes fully opaque (~380) so the streaming roadside scenery
// (trees etc., which fade in out at distance) always has ground under it instead
// of floating against the backdrop.
const ROAD_LEN = 800
const DASH_PERIOD = 8 // world units per dash cycle
const POSTS_PER_SIDE = 24
const POST_SPACING = 14

// real CC0 ground textures per theme (public/tex)
const GROUND_TEX: Record<string, string> = {
  mountain: '/tex/grass.jpg',
  city: '/tex/grass.jpg', // Marin Headlands grass (was asphalt for the old bridge deck)
  desert: '/tex/sand.jpg',
  candy: '/tex/grass.jpg',
  space: '/tex/rock.jpg',
}

// Themes with a painted photographic backdrop (see Scenery.tsx). The ground tint
// is sampled from the foreground (bottom strip) of this image so the grass/sand/
// candy/rock reads as the same patch of land the painting shows — not an
// arbitrary hue. Every theme now has a painting to match.
export const BACKDROP_TINT_SRC: Record<string, string | undefined> = {
  mountain: '/backdrops/mountain.jpg',
  city: '/backdrops/city.jpg',
  desert: '/backdrops/desert.jpg',
  candy: '/backdrops/candy.jpg',
  space: '/backdrops/space.jpg',
}

function makeRoadTexture(road: string, line: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  // surface
  ctx.fillStyle = road
  ctx.fillRect(0, 0, 256, 256)
  // subtle asphalt noise
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
  // edge lines
  ctx.fillStyle = line
  ctx.fillRect(10, 0, 7, 256)
  ctx.fillRect(239, 0, 7, 256)
  // dashed centre line (one dash per tile)
  ctx.fillStyle = line
  ctx.fillRect(124, 40, 8, 120)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, ROAD_LEN / DASH_PERIOD)
  tex.anisotropy = 8
  return tex
}

export function Track({ theme }: { theme: Theme }) {
  const roadTex = useMemo(() => makeRoadTexture(theme.road, theme.line), [theme.road, theme.line])
  const groundTex = useMemo(() => {
    const t = new THREE.TextureLoader().load(GROUND_TEX[theme.id] ?? '/tex/grass.jpg')
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(120, ROAD_LEN / 4) // keep tile density when ROAD_LEN changes
    t.anisotropy = 8
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [theme.id])

  // Ground tint sampled from the theme's painted backdrop foreground (bottom
  // strip), normalised to a pure hue/sat tint so it recolours the grass/sand
  // texture toward the landscape without darkening it. Falls back to white (no
  // tint) until the sample resolves, or for themes with no painted backdrop.
  const [groundTint, setGroundTint] = useState<string | null>(null)
  useEffect(() => {
    setGroundTint(null)
    const src = BACKDROP_TINT_SRC[theme.id]
    if (!src) return
    let alive = true
    // foreground band: the lowest ~18% of the painting (the ground nearest us)
    sampleImageBand(src, 0.82, 1.0)
      .then((c) => { if (alive) setGroundTint('#' + asTint(c).getHexString()) })
      .catch(() => { /* keep the untinted fallback */ })
    return () => { alive = false }
  }, [theme.id])

  // City is the Marin Headlands: the painted backdrop foreground is warm sunset
  // city, which would tint the grass pavement-warm — so override the sampled tint
  // with a fixed sun-dried golden-green so the roadside reads as headland grass.
  const groundColor =
    theme.id === 'city'
      ? '#BCC07E'
      : groundTint ?? (theme.id === 'candy' ? '#ffb3de' : '#ffffff')

  const follow = useRef<THREE.Group>(null)
  const leftPosts = useRef<(THREE.Mesh | null)[]>([])
  const rightPosts = useRef<(THREE.Mesh | null)[]>([])

  // dispose the canvas/loaded textures when the track unmounts or theme changes
  useEffect(() => () => { roadTex.dispose(); groundTex.dispose() }, [roadTex, groundTex])

  useFrame(() => {
    // the whole road/ground group rides with the car along Z …
    if (follow.current) follow.current.position.z = carState.z
    // … while the texture scrolls so the markings appear world-fixed (= speed)
    roadTex.offset.y = carState.z / DASH_PERIOD

    // recycle roadside posts: world-static between discrete steps, seamless loop.
    // +2 spacings of bias keeps the nearest post (where the recycle seam jumps)
    // behind the camera (car.z + 9), so the wrap is never visible.
    const baseline = (Math.floor(carState.z / POST_SPACING) + 2) * POST_SPACING
    for (let j = 0; j < POSTS_PER_SIDE; j++) {
      const z = baseline - j * POST_SPACING
      const l = leftPosts.current[j]
      const r = rightPosts.current[j]
      if (l) l.position.z = z
      if (r) r.position.z = z
    }
  })

  return (
    <>
      <group ref={follow}>
        {/* ground apron */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
          <planeGeometry args={[500, ROAD_LEN]} />
          <meshStandardMaterial map={groundTex} color={groundColor} roughness={1} metalness={0} />
        </mesh>
        {/* road surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[TRACK_HALF * 2, ROAD_LEN]} />
          <meshStandardMaterial map={roadTex} roughness={0.7} metalness={0.05} />
        </mesh>
        {/* glowing edge rails */}
        <mesh position={[TRACK_HALF, 0.18, 0]}>
          <boxGeometry args={[0.18, 0.36, ROAD_LEN]} />
          <meshStandardMaterial color={theme.line} emissive={theme.line} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
        <mesh position={[-TRACK_HALF, 0.18, 0]}>
          <boxGeometry args={[0.18, 0.36, ROAD_LEN]} />
          <meshStandardMaterial color={theme.line} emissive={theme.line} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      </group>

      {/* recycling roadside posts (world space) */}
      {Array.from({ length: POSTS_PER_SIDE }).map((_, j) => (
        <mesh key={`lp${j}`} ref={(m) => { leftPosts.current[j] = m }} position={[TRACK_HALF + 1.1, 0.8, 0]} castShadow>
          <boxGeometry args={[0.16, 1.6, 0.16]} />
          <meshStandardMaterial color={theme.sun} emissive={theme.sun} emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: POSTS_PER_SIDE }).map((_, j) => (
        <mesh key={`rp${j}`} ref={(m) => { rightPosts.current[j] = m }} position={[-TRACK_HALF - 1.1, 0.8, 0]} castShadow>
          <boxGeometry args={[0.16, 1.6, 0.16]} />
          <meshStandardMaterial color={theme.sun} emissive={theme.sun} emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}
