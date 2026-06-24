import { type AvatarConfig } from '../data/avatars'

// A clean helmeted racer for an open cockpit — deliberately NO face (helmets are
// smooth forgiving shapes, so this reads well without being uncanny). Colors come
// from the player's avatar: helmet/suit = outfitColor, trim = accent, neck = skin,
// hair peeks out the back. Built at roughly head+shoulders scale (~0.8 tall).
export function HelmetedDriver({ avatar }: { avatar: AvatarConfig }) {
  const helmet = avatar.outfitColor
  const trim = avatar.accent
  const suit = avatar.outfitColor
  const skin = avatar.skinTone
  const hair = avatar.hairColor
  return (
    <group>
      {/* shoulders / torso in the suit color */}
      <mesh position={[0, -0.28, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.18, 6, 14]} />
        <meshStandardMaterial color={suit} roughness={0.55} />
      </mesh>
      {/* collar accent */}
      <mesh position={[0, -0.12, 0]} castShadow>
        <cylinderGeometry args={[0.115, 0.15, 0.07, 16]} />
        <meshStandardMaterial color={trim} roughness={0.45} metalness={0.1} />
      </mesh>
      {/* neck (skin) */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.08, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* hair peeking out the back, under the helmet rim */}
      <mesh position={[0, 0.03, -0.04]}>
        <sphereGeometry args={[0.145, 16, 14]} />
        <meshStandardMaterial color={hair} roughness={0.95} />
      </mesh>
      {/* helmet shell */}
      <mesh position={[0, 0.07, 0]} castShadow>
        <sphereGeometry args={[0.165, 24, 20]} />
        <meshStandardMaterial color={helmet} roughness={0.22} metalness={0.15} />
      </mesh>
      {/* chin bar (helmet color), wraps the lower front */}
      <mesh position={[0, 0.0, 0.05]} scale={[1, 0.7, 1]} castShadow>
        <sphereGeometry args={[0.16, 20, 16, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.4]} />
        <meshStandardMaterial color={helmet} roughness={0.22} metalness={0.15} />
      </mesh>
      {/* visor: dark glossy band across the front */}
      <mesh position={[0, 0.085, 0.075]} scale={[1, 0.55, 0.8]}>
        <sphereGeometry args={[0.16, 24, 16]} />
        <meshStandardMaterial color="#0b0d16" roughness={0.05} metalness={0.5} />
      </mesh>
      {/* visor trim accent */}
      <mesh position={[0, 0.165, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.135, 0.016, 8, 24, Math.PI]} />
        <meshStandardMaterial color={trim} roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  )
}
