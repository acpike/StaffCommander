import * as THREE from 'three'

// Sample the average colour of a horizontal band of an image. Used to harmonise
// the 3D world with each theme's painted backdrop: the same image that paints the
// sky also seeds the fog colour (horizon band), the sky-gap background (top strip)
// and the ground tint (foreground/bottom strip), so nothing is an arbitrary
// hand-picked hex — every landscape colour is *sampled from that landscape*.
//
// Bands are given as fractions of image height (0 = top, 1 = bottom). Sampling is
// done on a tiny 32×32 downscale so it's a few hundred bytes of pixel work.

const SIZE = 32

/** Average an already-decoded image element over the rows [y0frac, y1frac). */
export function sampleBandFromImage(
  img: HTMLImageElement | HTMLCanvasElement,
  y0frac: number,
  y1frac: number,
): THREE.Color | null {
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, SIZE, SIZE)
  const y0 = Math.max(0, Math.min(SIZE - 1, Math.floor(y0frac * SIZE)))
  const y1 = Math.max(y0 + 1, Math.min(SIZE, Math.floor(y1frac * SIZE)))
  const d = ctx.getImageData(0, y0, SIZE, y1 - y0).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
  if (!n) return null
  return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace)
}

/** Load `src`, then average the rows [y0frac, y1frac). Rejects on load error. */
export function sampleImageBand(
  src: string,
  y0frac: number,
  y1frac: number,
): Promise<THREE.Color> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const col = sampleBandFromImage(img, y0frac, y1frac)
      if (col) resolve(col)
      else reject(new Error('sampleImageBand: no pixels'))
    }
    img.onerror = () => reject(new Error(`sampleImageBand: failed to load ${src}`))
    img.src = src
  })
}

/**
 * Rescale a sampled colour to full value (brightest channel → 1) so it acts as a
 * pure hue/saturation tint when multiplied over a texture, without darkening it.
 * A near-black sample is left alone (nothing meaningful to normalise).
 */
export function asTint(c: THREE.Color): THREE.Color {
  const max = Math.max(c.r, c.g, c.b)
  if (max < 0.04) return c.clone()
  return c.clone().multiplyScalar(1 / max)
}
