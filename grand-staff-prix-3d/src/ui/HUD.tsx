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

      {/* mastery meter — shows the unlock bar (Stage 4 · 30 notes · 90%+) */}
      <div
        style={{
          position: 'absolute',
          top: 'min(300px, calc(env(safe-area-inset-top) + 82px + 26vh))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(300px, 80vw)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 12,
          background: 'rgba(10,9,16,0.55)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.09)',
          font: '600 12px "Space Grotesk", system-ui, sans-serif',
          color: '#f4f3f8',
          pointerEvents: 'none',
        }}
      >
        {alreadyMastered ? (
          <span style={{ color: '#46d27a', letterSpacing: 1 }}>✓ MASTERED — chasing high score</span>
        ) : (
          <>
            <span style={{ color: '#9a96a6', letterSpacing: 1, fontSize: 10 }}>MASTERY</span>
            <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${notesPct}%`,
                  borderRadius: 3,
                  background: onTrack ? 'linear-gradient(90deg,#34d17a,#46d27a)' : 'linear-gradient(90deg,#ff8a3d,#ff5a2e)',
                  transition: 'width .2s',
                }}
              />
            </span>
            <span style={{ color: onTrack ? '#46d27a' : '#ff9c6a', minWidth: 34, textAlign: 'right' }}>
              {Math.round(accuracy * 100)}%
            </span>
          </>
        )}
      </div>

      {flashTick > 0 && lastResult && <div key={flashTick} className={`flash ${lastResult}`} />}
    </div>
  )
}
