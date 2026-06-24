// Opening splash: the title art, tap to enter the menu. Shown once on load.
export function Splash({ onStart }: { onStart: () => void }) {
  return (
    <div className="splash" onClick={onStart} role="button" aria-label="Start">
      <img className="splashImg" src="./title.png" alt="Grand Staff Prix — a racing game for note naming" />
      <div className="splashFade" />
      <button className="splashStart" onClick={onStart}>Tap to Start</button>
    </div>
  )
}
