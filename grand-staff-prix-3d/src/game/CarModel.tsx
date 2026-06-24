import { type CarSpec } from '../data/cars'
import { composerById } from '../data/composers'
import { useGame } from '../state/store'
import { RealCar } from './RealCar'
import { DriverModel } from './DriverModel'

// Single source of truth for the car, used by BOTH the in-game car (game/Car.tsx)
// and the menu showroom (ui/MenuCar3D.tsx). A real artist-made model tinted per
// car color (or the car's own GLB), plus the chosen composer seated in open cockpits.
export function CarModel({ car }: { car: CarSpec }) {
  const composerId = useGame((s) => s.settings.composerId)
  const composer = composerById(composerId)
  return (
    <group>
      <RealCar color={car.color} modelUrl={car.model} rotationY={car.modelRotation} />
      {car.openCockpit && (
        <group position={car.driverSeat ?? [0, 0.55, 0.1]} scale={car.driverScale ?? 1}>
          <DriverModel composer={composer} />
        </group>
      )}
    </group>
  )
}
