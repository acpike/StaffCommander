import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// Real artist-made car models, auto-fitted to the game footprint.
// Default: Khronos "CarConcept" (orig. CC0, optimized glTF CC BY 4.0 — see
// CREDITS.md), tinted per car color via its named "Paint" materials.
// A car may override with its own GLB (cars.ts `model`).
const DEFAULT_MODEL = '/models/car_concept.glb'
useGLTF.preload(DEFAULT_MODEL)
useGLTF.preload('/models/user_sportscar.glb')

const TARGET_LEN = 4.2 // world units, front-to-back

export function RealCar({
  color,
  modelUrl = DEFAULT_MODEL,
  rotationY = Math.PI,
}: {
  color: string
  modelUrl?: string
  rotationY?: number
}) {
  const { scene } = useGLTF(modelUrl)
  const car = useMemo(() => {
    const c = scene.clone(true)
    const col = new THREE.Color(color)
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const name = mesh.name || ''
      // cull the full interior (invisible from the chase view, huge perf cost)
      if (/^Interior|^Engine|Pedal|Steering|Seat|Dash|Floormat|Cage|Hatch/i.test(name)) {
        mesh.visible = false
        return
      }
      mesh.castShadow = true
      mesh.receiveShadow = false
      // tint only painted body panels (CarConcept); baked-texture models have no
      // "Paint" material, so this is a harmless no-op for them.
      const tint = (mat: THREE.Material) => {
        if (mat && mat.name && mat.name.startsWith('Paint')) {
          const nm = (mat as THREE.MeshStandardMaterial).clone()
          nm.color = col
          return nm
        }
        return mat
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material)
    })

    // auto-fit: scale so the longest horizontal axis == TARGET_LEN, drop to ground, centre
    const box = new THREE.Box3().setFromObject(c)
    const size = new THREE.Vector3()
    box.getSize(size)
    c.scale.setScalar(TARGET_LEN / Math.max(size.x, size.z))
    const box2 = new THREE.Box3().setFromObject(c)
    const ctr = new THREE.Vector3()
    box2.getCenter(ctr)
    c.position.x -= ctr.x
    c.position.z -= ctr.z
    c.position.y -= box2.min.y
    return c
  }, [scene, color])

  return (
    <group rotation={[0, rotationY, 0]}>
      <primitive object={car} />
    </group>
  )
}
