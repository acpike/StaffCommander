import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// A real helmeted-driver bust (artist/AI model, baked textures) for open cockpits.
// Auto-fitted to a head+shoulders height and seated via the car's driverSeat.
useGLTF.preload('/models/driver_bust.glb')

const TARGET_H = 0.62 // world units, base-to-top of the bust

export function DriverModel({ rotationY = 0 }: { rotationY?: number }) {
  const { scene } = useGLTF('/models/driver_bust.glb')
  const bust = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = false
      }
    })
    const box = new THREE.Box3().setFromObject(c)
    const size = new THREE.Vector3()
    box.getSize(size)
    c.scale.setScalar(TARGET_H / size.y)
    const box2 = new THREE.Box3().setFromObject(c)
    const ctr = new THREE.Vector3()
    box2.getCenter(ctr)
    c.position.x -= ctr.x
    c.position.z -= ctr.z
    c.position.y -= box2.min.y // base at y = 0
    return c
  }, [scene])

  return (
    <group rotation={[0, rotationY, 0]}>
      <primitive object={bust} />
    </group>
  )
}
