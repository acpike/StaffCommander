import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { useGame } from '../state/store'
import { themeById } from '../data/themes'
import { Scenery } from './Scenery'
import { ChaseCamera } from './ChaseCamera'
import { Track } from './Track'
import { SkidMarks } from './SkidMarks'
import { Exhaust } from './Exhaust'
import { Car } from './Car'
import { Gates } from './Gates'
import { Explosions } from './Explosions'
import { Effects } from './Effects'
import { isTouchDevice } from '../util/device'

export function GameScene() {
  const themeId = useGame((s) => s.settings.themeId)
  const theme = themeById(themeId)

  return (
    <Canvas
      className="fill"
      shadows
      flat
      dpr={isTouchDevice ? [1, 1.5] : [1, 2]}
      gl={{ antialias: !isTouchDevice, powerPreference: 'high-performance' }}
      camera={{ position: [0, 4.3, 9], fov: 55, near: 0.1, far: 320 }}
    >
      <Scenery theme={theme} />
      <ChaseCamera />
      <Track theme={theme} />
      <SkidMarks />
      <Exhaust />
      <Physics gravity={[0, 0, 0]}>
        <Car />
        <Gates />
      </Physics>
      <Explosions />
      <Effects />
    </Canvas>
  )
}
