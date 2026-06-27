// Ambient animated backdrop for the menu: a slow drifting aurora of brand-accent
// light blobs plus a faint vignette grid. Pure CSS/DOM (no extra WebGL context),
// so it stays cheap while the showroom <Canvas> renders the hero car.

export function MenuBackground() {
  return (
    <div className="menuBg" aria-hidden>
      <div className="auroraA" />
      <div className="auroraB" />
      <div className="auroraC" />
      <div className="bgGrid" />
      <div className="bgVignette" />
    </div>
  )
}
