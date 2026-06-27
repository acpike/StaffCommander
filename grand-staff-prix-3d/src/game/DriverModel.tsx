import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { COMPOSERS, type Composer } from '../data/composers'

// A composer-driver bust (baked-texture character) seated in an open cockpit.
// Auto-fitted to a head+shoulders height; rotation/scale come from the composer.
COMPOSERS.forEach((c) => useGLTF.preload(c.model))

const TARGET_H = 0.9 // world units, base-to-top of the bust

export function DriverModel({ composer }: { composer: Composer }) {
  const { scene } = useGLTF(composer.model)
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
    c.scale.setScalar((TARGET_H * composer.scale) / size.y)
    const box2 = new THREE.Box3().setFromObject(c)
    const ctr = new THREE.Vector3()
    box2.getCenter(ctr)
    c.position.x -= ctr.x
    c.position.z -= ctr.z
    c.position.y -= box2.min.y // base at y = 0
    return c
  }, [scene, composer.scale])

  return (
    <group rotation={[0, composer.rotationY, 0]}>
      <primitive object={bust} />
    </group>
  )
}
