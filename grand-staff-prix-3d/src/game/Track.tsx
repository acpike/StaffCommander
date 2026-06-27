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

// '#RRGGBB' → 'rgba(r,g,b,a)' so the canvas can paint translucent neon.
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

// DEEP SPACE lane: a holographic light-bridge instead of asphalt. The base is
// (almost) transparent — only a faint violet energy field with a soft trough in
// the middle and a few lengthwise streaks — with BRIGHT neon edges and a glowing
// dashed centre line painted on top. The texture's alpha drives the plane's
// transparency, and its RGB also feeds the emissive map so the markings glow.
// Same size/repeat as makeRoadTexture, so the dashed centre still scrolls with
// speed and the gates/car line up exactly.
function makeSpaceLaneTexture(line: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 256, 256) // transparent base — open space shows through
  // faint energy field: brighter toward the edges, near-clear down the middle
  const grad = ctx.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0.0, hexA(line, 0.34))
  grad.addColorStop(0.12, hexA(line, 0.1))
  grad.addColorStop(0.5, hexA(line, 0.05))
  grad.addColorStop(0.88, hexA(line, 0.1))
  grad.addColorStop(1.0, hexA(line, 0.34))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)
  // faint lengthwise energy streaks
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = hexA(line, 0.04 + Math.random() * 0.05)
    ctx.fillRect(Math.random() * 256, 0, 1, 256)
  }
  // bright neon edges + a soft inner glow alongside them
  ctx.fillStyle = hexA(line, 0.95)
  ctx.fillRect(8, 0, 9, 256)
  ctx.fillRect(239, 0, 9, 256)
  ctx.fillStyle = hexA(line, 0.35)
  ctx.fillRect(17, 0, 6, 256)
  ctx.fillRect(233, 0, 6, 256)
  // glowing dashed centre line (one dash per tile), near-white core
  ctx.fillStyle = 'rgba(236,230,255,0.95)'
  ctx.fillRect(122, 40, 12, 120)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, ROAD_LEN / DASH_PERIOD)
  tex.anisotropy = 8
  return tex
}

export function Track({ theme }: { theme: Theme }) {
  const isSpace = theme.id === 'space'
  const roadTex = useMemo(
    () => (isSpace ? makeSpaceLaneTexture(theme.line) : makeRoadTexture(theme.road, theme.line)),
    [isSpace, theme.road, theme.line],
  )
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

  // San Francisco is the Marin Headlands: cut the grass apron's FAR (ahead) extent
  // short so the headland ends on a bluff ~170 units ahead, beyond which the
  // distant Bay water (SFScene's BayWater) and the painted city are revealed —
  // instead of flat grass running all the way into the haze. Behind/near the car
  // is unchanged. Other themes keep the full centred apron.
  const isCity = theme.id === 'city'
  const apronLen = isCity ? 570 : ROAD_LEN
  const apronZ = isCity ? 115 : 0 // shift the (shorter) apron back so it ends ~170 ahead

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
        {/* ground apron (shortened ahead for the city/headland bluff — see above).
            Skipped for space: open void below, no flat ground plane. */}
        {!isSpace && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, apronZ]} receiveShadow>
            <planeGeometry args={[500, apronLen]} />
            <meshStandardMaterial map={groundTex} color={groundColor} roughness={1} metalness={0} />
          </mesh>
        )}
        {/* lane surface: asphalt for most themes; a translucent glowing
            light-bridge through space for the 'space' theme (same size/y so the
            gates + car still line up). receiveShadow keeps the car's shadow on it. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[TRACK_HALF * 2, ROAD_LEN]} />
          {isSpace ? (
            <meshStandardMaterial
              map={roadTex}
              emissive={theme.line}
              emissiveMap={roadTex}
              emissiveIntensity={1.4}
              transparent
              depthWrite={false}
              roughness={1}
              metalness={0}
              toneMapped={false}
            />
          ) : (
            <meshStandardMaterial map={roadTex} roughness={0.7} metalness={0.05} />
          )}
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

      {/* recycling roadside markers (world space): ground fence-posts for most
          themes; small floating glowing light-orbs flanking the light-bridge for
          space (no posts standing on a ground that isn't there). */}
      {Array.from({ length: POSTS_PER_SIDE }).map((_, j) => (
        <mesh
          key={`lp${j}`}
          ref={(m) => { leftPosts.current[j] = m }}
          position={[TRACK_HALF + 1.1, isSpace ? 1.3 : 0.8, 0]}
          castShadow={!isSpace}
        >
          {isSpace ? <sphereGeometry args={[0.22, 16, 16]} /> : <boxGeometry args={[0.16, 1.6, 0.16]} />}
          <meshStandardMaterial color={theme.sun} emissive={theme.sun} emissiveIntensity={isSpace ? 1.5 : 0.5} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: POSTS_PER_SIDE }).map((_, j) => (
        <mesh
          key={`rp${j}`}
          ref={(m) => { rightPosts.current[j] = m }}
          position={[-TRACK_HALF - 1.1, isSpace ? 1.3 : 0.8, 0]}
          castShadow={!isSpace}
        >
          {isSpace ? <sphereGeometry args={[0.22, 16, 16]} /> : <boxGeometry args={[0.16, 1.6, 0.16]} />}
          <meshStandardMaterial color={theme.sun} emissive={theme.sun} emissiveIntensity={isSpace ? 1.5 : 0.5} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}
