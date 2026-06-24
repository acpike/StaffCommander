import { useState } from 'react'

// Prefer a static thumbnail image (/thumbs/...); if it isn't there yet, fall back
// to a runtime-rendered data URL, or a spinner while that loads.
export function AssetThumb({ src, fallback, alt }: { src: string; fallback?: string; alt: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return fallback ? <img src={fallback} alt={alt} /> : <span className="thumbSpin" />
  }
  return <img src={src} alt={alt} onError={() => setBroken(true)} />
}
