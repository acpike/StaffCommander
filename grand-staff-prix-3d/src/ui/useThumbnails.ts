import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface ThumbItem {
  id: string
  model: string
  /** base Y rotation of the model in-game (we add PI to face the camera) */
  rotationY?: number
  kind: 'car' | 'bust'
}

// Render each GLB ONCE to a PNG data URL using a single offscreen renderer, then
// the UI shows cheap <img> thumbnails. Avoids many live WebGL canvases (which
// lag/crash on iPad Safari). Returns { id: dataURL }.
export function useThumbnails(items: ThumbItem[], size = 320): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const key = items.map((i) => i.id + i.model).join('|')
  const done = useRef('')

  useEffect(() => {
    if (done.current === key) return
    done.current = key
    let alive = true
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(size, size)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const kk = new THREE.DirectionalLight(0xffffff, 2.0)
    kk.position.set(3, 5, 4)
    scene.add(kk)
    const fill = new THREE.DirectionalLight(0xffffff, 0.7)
    fill.position.set(-4, 2, 2)
    scene.add(fill)
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100)
    const loader = new GLTFLoader()

    ;(async () => {
      const out: Record<string, string> = {}
      for (const it of items) {
        try {
          const gltf = await loader.loadAsync(it.model)
          if (!alive) break
          const obj = gltf.scene
          obj.rotation.y = (it.rotationY ?? 0) + Math.PI // face the camera
          const box = new THREE.Box3().setFromObject(obj)
          const sphere = box.getBoundingSphere(new THREE.Sphere())
          obj.position.sub(sphere.center)
          scene.add(obj)

          const r = sphere.radius || 1
          const dist = (r / Math.sin((32 * Math.PI) / 180 / 2)) * 1.02
          if (it.kind === 'car') {
            camera.position.set(dist * 0.45, dist * 0.34, dist * 0.82) // front 3/4 from above
          } else {
            camera.position.set(0, dist * 0.06, dist) // head-on portrait
          }
          camera.lookAt(0, 0, 0)
          renderer.render(scene, camera)
          out[it.id] = renderer.domElement.toDataURL('image/png')

          scene.remove(obj)
          obj.traverse((o) => {
            const m = o as THREE.Mesh
            if (m.isMesh) {
              m.geometry?.dispose()
              const mat = m.material
              ;(Array.isArray(mat) ? mat : [mat]).forEach((x) => x?.dispose())
            }
          })
        } catch {
          /* skip a model that fails to load */
        }
      }
      if (alive) setThumbs(out)
      renderer.dispose()
    })()

    return () => {
      alive = false
      renderer.dispose()
    }
  }, [key, items, size])

  return thumbs
}
