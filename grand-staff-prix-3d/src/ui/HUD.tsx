import { useEffect, useRef } from 'react'
import { useGame, activeProfile, START_LIVES } from '../state/store'
import { drawNoteCard, ensureMusicFont } from '../util/staffTexture'
import { Icon } from './icons'

const MASTERY_NOTES = 30

export function HUD() {
  const score = useGame((s) => s.score)
  const stage = useGame((s) => s.stage)
  const streak = useGame((s) => s.streak)
  const lives = useGame((s) => s.lives)
  const note = useGame((s) => s.note)
  const lastResult = useGame((s) => s.lastResult)
  const flashTick = useGame((s) => s.flashTick)
  const goMenu = useGame((s) => s.goMenu)
  const correctCount = useGame((s) => s.correctCount)
  const wrongCount = useGame((s) => s.wrongCount)
  const levelId = useGame((s) => s.settings.levelId)
  const profile = useGame(activeProfile)

  const total = correctCount + wrongCount
  const accuracy = total > 0 ? correctCount / total : 1
  const alreadyMastered = profile?.mastered.includes(levelId) ?? false
  const notesPct = Math.min(100, Math.round((total / MASTERY_NOTES) * 100))
  const onTrack = accuracy >= 0.9

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

      {/* mastery meter — vertical bar pinned to the right edge (out of the play area) */}
      <div
        style={{
          position: 'absolute',
          right: 'max(10px, calc(env(safe-area-inset-right) + 6px))',
          top: '46%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 7,
          padding: '9px 7px',
          borderRadius: 16,
          background: 'rgba(10,9,16,0.5)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.09)',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{alreadyMastered ? '✓' : '⭐'}</span>
        <div
          style={{
            position: 'relative',
            width: 9,
            height: '32vh',
            minHeight: 110,
            maxHeight: 230,
            borderRadius: 5,
            background: 'rgba(255,255,255,0.14)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '100%',
              height: alreadyMastered ? '100%' : `${notesPct}%`,
              borderRadius: 5,
              background:
                alreadyMastered || onTrack
                  ? 'linear-gradient(0deg,#2fae62,#46d27a)'
                  : 'linear-gradient(0deg,#ff5a2e,#ff8a3d)',
              transition: 'height .2s',
            }}
          />
        </div>
        <span
          style={{
            font: '700 11px "Space Grotesk", system-ui, sans-serif',
            color: alreadyMastered || onTrack ? '#46d27a' : '#ff9c6a',
            minWidth: 28,
            textAlign: 'center',
          }}
        >
          {alreadyMastered ? 'MAX' : `${Math.round(accuracy * 100)}%`}
        </span>
      </div>

      {flashTick > 0 && lastResult && <div key={flashTick} className={`flash ${lastResult}`} />}
    </div>
  )
}
