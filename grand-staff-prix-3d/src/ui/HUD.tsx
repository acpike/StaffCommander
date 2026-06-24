import { useEffect, useRef } from 'react'
import { useGame, START_LIVES } from '../state/store'
import { drawNoteCard, ensureMusicFont } from '../util/staffTexture'
import { Icon } from './icons'

export function HUD() {
  const score = useGame((s) => s.score)
  const stage = useGame((s) => s.stage)
  const streak = useGame((s) => s.streak)
  const lives = useGame((s) => s.lives)
  const note = useGame((s) => s.note)
  const lastResult = useGame((s) => s.lastResult)
  const flashTick = useGame((s) => s.flashTick)
  const goMenu = useGame((s) => s.goMenu)

  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!note || !canvas.current) return
    const el = canvas.current
    const draw = () => drawNoteCard(el, note, { bg: '#f7f5fa', staff: '#2a2733', note: '#14121c', clef: '#14121c' })
    draw()
    ensureMusicFont().then(draw)
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [note])

  return (
    <div className="hud">
      <div className="hudTop">
        <button className="pill btnPill" onClick={goMenu}>
          {Icon.back} Exit
        </button>
        <div className="hudStats">
          <div className="pill">⭐ {score}</div>
          <div className="pill">STAGE {stage}</div>
          {streak > 1 && <div className="pill streak">🔥 ×{streak}</div>}
          <div className="pill">
            {'❤️'.repeat(lives)}
            {'🤍'.repeat(Math.max(0, START_LIVES - lives))}
          </div>
        </div>
      </div>

      {note && (
        <div className="noteCard">
          <canvas ref={canvas} />
          <div className="cap">Name this note</div>
        </div>
      )}

      {flashTick > 0 && lastResult && <div key={flashTick} className={`flash ${lastResult}`} />}
    </div>
  )
}
