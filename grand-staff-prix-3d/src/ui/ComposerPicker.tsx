import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { COMPOSERS, type Composer } from '../data/composers'
import { useGame } from '../state/store'
import { DriverModel } from '../game/DriverModel'

// Visual composer picker: each option renders the actual 3D bust facing the
// camera, with the name below. Click to select.
function Bust({ composer }: { composer: Composer }) {
  // face the camera for the portrait (in-car the bust faces -Z / away)
  return (
    <group position={[0, -0.62, 0]}>
      <DriverModel composer={{ ...composer, rotationY: composer.rotationY + Math.PI }} />
    </group>
  )
}

export function ComposerPicker() {
  const composerId = useGame((s) => s.settings.composerId)
  const setComposer = useGame((s) => s.setComposer)
  return (
    <div className="composerThumbs">
      {COMPOSERS.map((c) => (
        <button
          key={c.id}
          className={`composerThumb${composerId === c.id ? ' on' : ''}`}
          onClick={() => setComposer(c.id)}
          aria-label={c.name}
        >
          <div className="composerCanvas">
            <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.05, 1.5], fov: 32 }} gl={{ alpha: true }}>
              <ambientLight intensity={0.95} />
              <directionalLight position={[2, 3, 3]} intensity={1.4} />
              <directionalLight position={[-2, 1, 2]} intensity={0.5} />
              <Suspense fallback={null}>
                <Bust composer={c} />
              </Suspense>
            </Canvas>
          </div>
          <span className="composerName">{c.name}</span>
        </button>
      ))}
    </div>
  )
}
