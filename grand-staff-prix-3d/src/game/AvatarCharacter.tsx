import { useMemo } from 'react'
import * as THREE from 'three'
import type { AvatarConfig, FaceShapeId } from '../data/avatars'

// ──────────────────────────────────────────────────────────────────────────
// Parametric stylized character built entirely from primitives. Friendly,
// rounded "kart racer" proportions: a big head, small body. Driven by an
// AvatarConfig so face shape, skin, hair, eyes and outfit all change live.
// Shown both as a seated driver (CarModel) and a fuller figure in the
// builder preview (AvatarPreview3D).
// ──────────────────────────────────────────────────────────────────────────

// Per face-shape head scaling. The head is a sphere; non-uniform scale +
// a slight vertical offset gives round/oval/square/heart silhouettes.
const FACE: Record<FaceShapeId, { scale: [number, number, number]; jaw: number }> = {
  round: { scale: [1, 0.98, 0.96], jaw: 0.92 },
  oval: { scale: [0.9, 1.12, 0.92], jaw: 0.82 },
  square: { scale: [1.04, 1.0, 0.96], jaw: 1.0 },
  heart: { scale: [1.06, 1.02, 0.94], jaw: 0.7 },
}

function darken(hex: string, amt: number): string {
  const c = new THREE.Color(hex)
  c.multiplyScalar(1 - amt)
  return `#${c.getHexString()}`
}
function lighten(hex: string, amt: number): string {
  const c = new THREE.Color(hex)
  c.lerp(new THREE.Color('#ffffff'), amt)
  return `#${c.getHexString()}`
}

function Hair({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  const mat = (
    <meshStandardMaterial color={color} roughness={0.55} metalness={0.04} />
  )
  // Cap shares the hair slot but uses the outfit accent feel; here it's just
  // a fabric cap colored by hairColor for simplicity of the data model.
  switch (style) {
    case 'buzz':
      return (
        <mesh position={[0, 0.16, -0.02]} scale={[1.02, 0.78, 1.02]} castShadow>
          <sphereGeometry args={[0.51, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          {mat}
        </mesh>
      )
    case 'spiky':
      return (
        <group>
          <mesh position={[0, 0.18, -0.02]} scale={[1.04, 0.88, 1.04]} castShadow>
            <sphereGeometry args={[0.51, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            {mat}
          </mesh>
          {[
            [0, 0.62, 0],
            [-0.22, 0.55, 0.05],
            [0.22, 0.55, 0.05],
            [-0.12, 0.58, -0.2],
            [0.12, 0.58, -0.2],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} rotation={[0.2, 0, (i - 2) * 0.1]} castShadow>
              <coneGeometry args={[0.1, 0.26, 6]} />
              <meshStandardMaterial color={color} roughness={0.55} metalness={0.04} />
            </mesh>
          ))}
        </group>
      )
    case 'long':
      return (
        <group>
          <mesh position={[0, 0.2, -0.02]} scale={[1.06, 1.0, 1.06]} castShadow>
            <sphereGeometry args={[0.52, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.66]} />
            {mat}
          </mesh>
          {/* falling hair down the back + sides */}
          <mesh position={[0, -0.1, -0.28]} scale={[1, 1, 0.6]} castShadow>
            <capsuleGeometry args={[0.34, 0.5, 6, 16]} />
            {mat}
          </mesh>
          <mesh position={[-0.4, -0.05, 0.04]} rotation={[0, 0, 0.2]} castShadow>
            <capsuleGeometry args={[0.13, 0.42, 5, 12]} />
            {mat}
          </mesh>
          <mesh position={[0.4, -0.05, 0.04]} rotation={[0, 0, -0.2]} castShadow>
            <capsuleGeometry args={[0.13, 0.42, 5, 12]} />
            {mat}
          </mesh>
        </group>
      )
    case 'ponytail':
      return (
        <group>
          <mesh position={[0, 0.18, -0.02]} scale={[1.04, 0.92, 1.04]} castShadow>
            <sphereGeometry args={[0.51, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.64]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.28, -0.42]} rotation={[0.5, 0, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.5, 6, 12]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.42, -0.34]} castShadow>
            <torusGeometry args={[0.12, 0.04, 8, 16]} />
            <meshStandardMaterial color={darken(color, 0.4)} roughness={0.5} />
          </mesh>
        </group>
      )
    case 'bun':
      return (
        <group>
          <mesh position={[0, 0.18, -0.02]} scale={[1.04, 0.92, 1.04]} castShadow>
            <sphereGeometry args={[0.51, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.64]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.6, -0.04]} castShadow>
            <sphereGeometry args={[0.18, 18, 16]} />
            {mat}
          </mesh>
        </group>
      )
    case 'cap':
      return (
        <group>
          {/* dome */}
          <mesh position={[0, 0.2, -0.02]} scale={[1.04, 0.82, 1.04]} castShadow>
            <sphereGeometry args={[0.51, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            {mat}
          </mesh>
          {/* brim */}
          <mesh position={[0, 0.28, 0.34]} rotation={[-0.3, 0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 20, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={darken(color, 0.2)} roughness={0.55} />
          </mesh>
          {/* button */}
          <mesh position={[0, 0.62, -0.02]}>
            <sphereGeometry args={[0.04, 10, 10]} />
            {mat}
          </mesh>
        </group>
      )
    case 'short':
    default:
      return (
        <group>
          <mesh position={[0, 0.18, -0.02]} scale={[1.05, 0.9, 1.05]} castShadow>
            <sphereGeometry args={[0.51, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            {mat}
          </mesh>
          {/* small fringe */}
          <mesh position={[0, 0.36, 0.34]} rotation={[0.5, 0, 0]} castShadow>
            <boxGeometry args={[0.6, 0.16, 0.12]} />
            {mat}
          </mesh>
        </group>
      )
  }
}

function Outfit({ outfit, color, accent }: { outfit: AvatarConfig['outfit']; color: string; accent: string }) {
  const body = <meshStandardMaterial color={color} roughness={0.6} metalness={0.06} />
  const trimMat = <meshStandardMaterial color={accent} roughness={0.5} metalness={0.1} />
  const collarY = 0.0

  return (
    <group>
      {/* torso — tapered capsule for friendly shoulders */}
      <mesh position={[0, -0.62, 0]} castShadow>
        <capsuleGeometry args={[0.42, 0.34, 6, 18]} />
        {body}
      </mesh>
      {/* shoulders */}
      <mesh position={[-0.46, -0.42, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 14]} />
        {body}
      </mesh>
      <mesh position={[0.46, -0.42, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 14]} />
        {body}
      </mesh>
      {/* arms */}
      <mesh position={[-0.54, -0.72, 0.02]} rotation={[0, 0, 0.32]} castShadow>
        <capsuleGeometry args={[0.13, 0.36, 5, 12]} />
        {body}
      </mesh>
      <mesh position={[0.54, -0.72, 0.02]} rotation={[0, 0, -0.32]} castShadow>
        <capsuleGeometry args={[0.13, 0.36, 5, 12]} />
        {body}
      </mesh>

      {/* outfit-specific detailing */}
      {outfit === 'racing' && (
        <>
          {/* center zip + collar */}
          <mesh position={[0, -0.62, 0.4]}>
            <boxGeometry args={[0.05, 0.7, 0.04]} />
            {trimMat}
          </mesh>
          <mesh position={[0, collarY - 0.32, 0.3]}>
            <torusGeometry args={[0.26, 0.04, 8, 20, Math.PI]} />
            {trimMat}
          </mesh>
          {/* shoulder stripes */}
          <mesh position={[-0.46, -0.34, 0.04]} rotation={[0, 0, 0.4]}>
            <boxGeometry args={[0.06, 0.34, 0.06]} />
            {trimMat}
          </mesh>
          <mesh position={[0.46, -0.34, 0.04]} rotation={[0, 0, -0.4]}>
            <boxGeometry args={[0.06, 0.34, 0.06]} />
            {trimMat}
          </mesh>
        </>
      )}
      {outfit === 'hoodie' && (
        <>
          {/* hood roll behind neck */}
          <mesh position={[0, -0.18, -0.18]} castShadow>
            <torusGeometry args={[0.24, 0.1, 12, 20]} />
            {body}
          </mesh>
          {/* pocket */}
          <mesh position={[0, -0.78, 0.34]}>
            <boxGeometry args={[0.42, 0.18, 0.06]} />
            <meshStandardMaterial color={darken(color, 0.18)} roughness={0.65} />
          </mesh>
          {/* drawstrings */}
          <mesh position={[-0.08, -0.4, 0.36]}>
            <cylinderGeometry args={[0.015, 0.015, 0.2, 6]} />
            {trimMat}
          </mesh>
          <mesh position={[0.08, -0.4, 0.36]}>
            <cylinderGeometry args={[0.015, 0.015, 0.2, 6]} />
            {trimMat}
          </mesh>
        </>
      )}
      {outfit === 'jacket' && (
        <>
          <mesh position={[0, -0.62, 0.4]}>
            <boxGeometry args={[0.04, 0.7, 0.04]} />
            {trimMat}
          </mesh>
          {/* lapels */}
          <mesh position={[-0.12, -0.36, 0.36]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.16, 0.3, 0.04]} />
            {trimMat}
          </mesh>
          <mesh position={[0.12, -0.36, 0.36]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.16, 0.3, 0.04]} />
            {trimMat}
          </mesh>
        </>
      )}
      {outfit === 'tee' && (
        <>
          {/* sleeve cuffs */}
          <mesh position={[-0.54, -0.56, 0.02]} rotation={[0, 0, 0.32]}>
            <torusGeometry args={[0.15, 0.03, 8, 16]} />
            {trimMat}
          </mesh>
          <mesh position={[0.54, -0.56, 0.02]} rotation={[0, 0, -0.32]}>
            <torusGeometry args={[0.15, 0.03, 8, 16]} />
            {trimMat}
          </mesh>
          {/* collar ring */}
          <mesh position={[0, -0.32, 0.18]} rotation={[Math.PI / 2.4, 0, 0]}>
            <torusGeometry args={[0.18, 0.025, 8, 18]} />
            {trimMat}
          </mesh>
        </>
      )}
      {outfit === 'overalls' && (
        <>
          {/* straps */}
          <mesh position={[-0.16, -0.42, 0.36]} rotation={[0, 0, 0.05]}>
            <boxGeometry args={[0.1, 0.5, 0.05]} />
            {trimMat}
          </mesh>
          <mesh position={[0.16, -0.42, 0.36]} rotation={[0, 0, -0.05]}>
            <boxGeometry args={[0.1, 0.5, 0.05]} />
            {trimMat}
          </mesh>
          {/* chest patch */}
          <mesh position={[0, -0.64, 0.38]}>
            <boxGeometry args={[0.3, 0.22, 0.05]} />
            <meshStandardMaterial color={lighten(color, 0.12)} roughness={0.6} />
          </mesh>
        </>
      )}
    </group>
  )
}

export function AvatarCharacter({ config }: { config: AvatarConfig }) {
  const face = FACE[config.faceShape] ?? FACE.round

  // Reuse skin material across head/neck/ears/nose.
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: config.skinTone, roughness: 0.52, metalness: 0.02 }),
    [config.skinTone],
  )
  const cheek = useMemo(() => darken(config.skinTone, 0.12), [config.skinTone])

  return (
    <group>
      {/* ── HEAD ── */}
      <group position={[0, 0.32, 0]}>
        {/* skull */}
        <mesh scale={face.scale} castShadow material={skinMat}>
          <sphereGeometry args={[0.5, 32, 28]} />
        </mesh>
        {/* jaw / chin shaping */}
        <mesh position={[0, -0.34, 0.02]} scale={[face.jaw, 0.7, 0.86]} castShadow material={skinMat}>
          <sphereGeometry args={[0.42, 26, 22]} />
        </mesh>

        {/* ears */}
        <mesh position={[-0.49, -0.02, 0]} scale={[0.5, 1, 0.7]} material={skinMat}>
          <sphereGeometry args={[0.12, 14, 12]} />
        </mesh>
        <mesh position={[0.49, -0.02, 0]} scale={[0.5, 1, 0.7]} material={skinMat}>
          <sphereGeometry args={[0.12, 14, 12]} />
        </mesh>

        {/* ── EYES ── whites + colored iris + pupil + brows */}
        {[-0.19, 0.19].map((x) => (
          <group key={x} position={[x, 0.0, 0.42]}>
            <mesh scale={[1, 1.15, 0.6]}>
              <sphereGeometry args={[0.115, 18, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={0.25} />
            </mesh>
            <mesh position={[0, 0, 0.06]}>
              <sphereGeometry args={[0.062, 16, 14]} />
              <meshStandardMaterial color={config.eyeColor} roughness={0.2} metalness={0.05} />
            </mesh>
            <mesh position={[0, 0, 0.1]}>
              <sphereGeometry args={[0.03, 12, 12]} />
              <meshStandardMaterial color="#0d0d12" roughness={0.1} />
            </mesh>
            {/* highlight */}
            <mesh position={[0.025, 0.03, 0.12]}>
              <sphereGeometry args={[0.013, 8, 8]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} toneMapped={false} />
            </mesh>
          </group>
        ))}
        {/* brows */}
        <mesh position={[-0.19, 0.16, 0.46]} rotation={[0, 0, -0.08]}>
          <boxGeometry args={[0.16, 0.03, 0.04]} />
          <meshStandardMaterial color={darken(config.hairColor, 0.1)} roughness={0.6} />
        </mesh>
        <mesh position={[0.19, 0.16, 0.46]} rotation={[0, 0, 0.08]}>
          <boxGeometry args={[0.16, 0.03, 0.04]} />
          <meshStandardMaterial color={darken(config.hairColor, 0.1)} roughness={0.6} />
        </mesh>

        {/* nose */}
        <mesh position={[0, -0.06, 0.5]} scale={[0.7, 1, 0.8]} material={skinMat}>
          <sphereGeometry args={[0.055, 12, 12]} />
        </mesh>

        {/* mouth — subtle smile */}
        <mesh position={[0, -0.22, 0.46]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.09, 0.018, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#9c4a4a" roughness={0.5} />
        </mesh>

        {/* cheeks blush */}
        <mesh position={[-0.27, -0.14, 0.42]} scale={[1, 0.7, 0.4]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color={cheek} roughness={0.6} transparent opacity={0.5} />
        </mesh>
        <mesh position={[0.27, -0.14, 0.42]} scale={[1, 0.7, 0.4]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color={cheek} roughness={0.6} transparent opacity={0.5} />
        </mesh>

        {/* ── HAIR ── (after the head so it sits on top) */}
        <Hair style={config.hairStyle} color={config.hairColor} />
      </group>

      {/* ── NECK ── */}
      <mesh position={[0, -0.08, 0]} material={skinMat}>
        <cylinderGeometry args={[0.14, 0.17, 0.2, 16]} />
      </mesh>

      {/* ── BODY / OUTFIT ── */}
      <Outfit outfit={config.outfit} color={config.outfitColor} accent={config.accent} />
    </group>
  )
}
