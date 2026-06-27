// Touch devices (phones/tablets) get a lighter render path: lower pixel ratio,
// trimmed post-processing, smaller shadow map — so the framerate stays smooth.
export const isTouchDevice =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
