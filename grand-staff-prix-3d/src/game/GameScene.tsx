import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { PerformanceMonitor } from '@react-three/drei'
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

// Adaptive pixel ratio: starts moderate, climbs when the framerate is healthy,
// drops when it's struggling — so a weak/old GPU stays smooth while a strong one
// stays crisp. No hard-coded quality downgrade for capable devices.
const DPR_HIGH = isTouchDevice ? 1.5 : 2
const DPR_LOW = isTouchDevice ? 0.85 : 1.25
const DPR_START = isTouchDevice ? 1.1 : 1.5

export function GameScene() {
  const themeId = useGame((s) => s.settings.themeId)
  const theme = themeById(themeId)
  const [dpr, setDpr] = useState(DPR_START)

  return (
    <Canvas
      className="fill"
      shadows
      flat
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 4.3, 9], fov: 55, near: 0.1, far: 320 }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(DPR_HIGH)}
        onDecline={() => setDpr(DPR_LOW)}
        flipflops={3}
        onFallback={() => setDpr(DPR_LOW)}
      />
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
