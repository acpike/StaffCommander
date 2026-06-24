import { useGame, activeProfile } from '../state/store'
import { DEFAULT_AVATAR } from '../data/avatars'
import { AvatarCharacter } from './AvatarCharacter'
import { ProceduralBody } from './RealCarModel'

// The single source of truth for what a car looks like. Used by BOTH the in-game
// car (game/Car.tsx) and the menu showroom (ui/MenuCar3D.tsx) so they are
// identical. The body is the detailed sculpted ProceduralBody (swept shell,
// glass canopy, wing, diffuser, detailed wheels); the seated driver is the
// player's chosen avatar, read from the active profile.
export function CarModel({ color, accent }: { color: string; accent: string }) {
  const profile = useGame(activeProfile)
  const avatar = profile?.avatar ?? DEFAULT_AVATAR
  return (
    <group>
      <ProceduralBody color={color} accent={accent} />
      {/* seated driver under the canopy */}
      <group position={[0, 0.34, 0.18]} scale={0.4}>
        <AvatarCharacter config={avatar} />
      </group>
    </group>
  )
}
