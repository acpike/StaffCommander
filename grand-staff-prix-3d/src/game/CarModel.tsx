import { RoundedBox } from '@react-three/drei'
import { useGame, activeProfile } from '../state/store'
import { DEFAULT_AVATAR } from '../data/avatars'
import { AvatarCharacter } from './AvatarCharacter'

// The single source of truth for what a car looks like. Used by BOTH the in-game
// car (game/Car.tsx) and the menu showroom (ui/MenuCar3D.tsx) so they are
// pixel-identical. Pure visual — no physics, animation or refs.

function Wheel({ position, accent }: { position: [number, number, number]; accent: string }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.44, 0.44, 0.34, 24]} />
        <meshStandardMaterial color="#16151c" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* hub + spokes */}
      <mesh position={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.12, 16]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0.18, 0, 0]}>
        <boxGeometry args={[0.06, 0.6, 0.12]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0.18, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.06, 0.6, 0.12]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  )
}

export function CarModel({ color, accent }: { color: string; accent: string }) {
  const profile = useGame(activeProfile)
  const avatar = profile?.avatar ?? DEFAULT_AVATAR
  return (
    <group>
      {/* seated driver — the player's built character, fitted under the canopy */}
      <group position={[0, 0.5, 0.25]} scale={0.42}>
        <AvatarCharacter config={avatar} />
      </group>
      {/* main body */}
      <RoundedBox args={[1.8, 0.55, 3.7]} radius={0.16} smoothness={4} position={[0, 0.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} envMapIntensity={1.3} />
      </RoundedBox>
      {/* lower nose wedge */}
      <RoundedBox args={[1.7, 0.3, 1.2]} radius={0.12} smoothness={3} position={[0, -0.12, -1.45]} castShadow>
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} envMapIntensity={1.3} />
      </RoundedBox>
      {/* cabin / canopy */}
      <RoundedBox args={[1.32, 0.5, 1.5]} radius={0.18} smoothness={4} position={[0, 0.42, 0.15]} castShadow>
        <meshStandardMaterial color="#0c0e16" metalness={0.4} roughness={0.07} envMapIntensity={2} />
      </RoundedBox>
      {/* accent dorsal stripe */}
      <mesh position={[0, 0.34, -0.4]}>
        <boxGeometry args={[0.28, 0.05, 2.6]} />
        <meshStandardMaterial color={accent} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* rear wing */}
      <mesh position={[0, 0.55, 1.78]} castShadow>
        <boxGeometry args={[1.7, 0.06, 0.4]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} envMapIntensity={1.3} />
      </mesh>
      <mesh position={[0.7, 0.42, 1.78]}>
        <boxGeometry args={[0.08, 0.32, 0.3]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh position={[-0.7, 0.42, 1.78]}>
        <boxGeometry args={[0.08, 0.32, 0.3]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} />
      </mesh>
      {/* headlights */}
      <mesh position={[0.55, -0.05, -1.95]}>
        <boxGeometry args={[0.34, 0.14, 0.08]} />
        <meshStandardMaterial color="#fff7e0" emissive="#fff2cf" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <mesh position={[-0.55, -0.05, -1.95]}>
        <boxGeometry args={[0.34, 0.14, 0.08]} />
        <meshStandardMaterial color="#fff7e0" emissive="#fff2cf" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      {/* taillights */}
      <mesh position={[0.55, 0.1, 1.96]}>
        <boxGeometry args={[0.4, 0.12, 0.06]} />
        <meshStandardMaterial color="#ff2b2b" emissive="#ff1a1a" emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
      <mesh position={[-0.55, 0.1, 1.96]}>
        <boxGeometry args={[0.4, 0.12, 0.06]} />
        <meshStandardMaterial color="#ff2b2b" emissive="#ff1a1a" emissiveIntensity={2.6} toneMapped={false} />
      </mesh>

      {/* wheels */}
      <Wheel position={[0.96, -0.18, -1.2]} accent={accent} />
      <Wheel position={[-0.96, -0.18, -1.2]} accent={accent} />
      <Wheel position={[0.96, -0.18, 1.3]} accent={accent} />
      <Wheel position={[-0.96, -0.18, 1.3]} accent={accent} />
    </group>
  )
}
