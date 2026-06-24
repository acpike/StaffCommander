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
const CACHE_VERSION = 'v3'

export function useThumbnails(items: ThumbItem[], size: number | { w: number; h: number } = 320): Record<string, string> {
  const W = typeof size === 'number' ? size : size.w
  const H = typeof size === 'number' ? size : size.h
  const key = items.map((i) => i.id + i.model).join('|')
  const cacheKey = `gsp3d.thumbs.${CACHE_VERSION}.${key}`
  // hydrate synchronously from cache so cached thumbnails show instantly (no lag)
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => {
    try {
      const c = localStorage.getItem(cacheKey)
      if (c) return JSON.parse(c)
    } catch { /* ignore */ }
    return {}
  })
  const done = useRef('')

  useEffect(() => {
    if (done.current === key) return
    // already have a full cached set? skip the expensive GLB render entirely.
    if (Object.keys(thumbs).length >= items.length) {
      done.current = key
      return
    }
    done.current = key
    let alive = true
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(W, H)
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
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.01, 100)
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
          // cars: zoom in tight so the car fills the (wide) frame; busts: portrait
          const fit = it.kind === 'car' ? 0.5 : 1.0
          const dist = (r / Math.sin((32 * Math.PI) / 180 / 2)) * fit
          if (it.kind === 'car') {
            camera.position.set(dist * 0.42, dist * 0.32, dist * 0.85) // front 3/4 from above
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
