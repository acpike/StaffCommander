import { useEffect, useRef, useState } from 'react'
import { useGame, activeProfile } from '../state/store'
import { NOTE_SETS, startCountOf } from '../data/notes'
import { ladderProgress } from '../data/ladder'
import { drawNoteCard, ensureMusicFont } from '../util/staffTexture'
import { Icon } from './icons'

export function HUD() {
  const score = useGame((s) => s.score)
  const stage = useGame((s) => s.stage)
  const streak = useGame((s) => s.streak)
  const lives = useGame((s) => s.lives)
  const startLives = useGame((s) => s.startLives)
  const note = useGame((s) => s.note)
  const noteMode = useGame((s) => s.noteMode)
  const lastResult = useGame((s) => s.lastResult)
  const flashTick = useGame((s) => s.flashTick)
  const goMenu = useGame((s) => s.goMenu)
  const levelId = useGame((s) => s.settings.levelId)
  const customLevels = useGame((s) => s.customLevels)
  const meterM = useGame((s) => s.meterM)
  const activeCount = useGame((s) => s.activeCount)
  const unlockTick = useGame((s) => s.unlockTick)
  const profile = useGame(activeProfile)

  const set = [...NOTE_SETS, ...customLevels].find((s) => s.id === levelId)
  const isLadder = !!set?.group // curriculum levels grow a note ladder; custom levels don't
  const alreadyMastered = profile?.mastered.includes(levelId) ?? false
  const prog = set
    ? ladderProgress(meterM, activeCount, set.notes.length, startCountOf(set))
    : { activeCount, total: activeCount, full: false, toNext: 0 }
  const fillPct = alreadyMastered ? 100 : Math.round(prog.toNext * 100)

  // brief "new note unlocked!" celebration whenever the ladder reveals a note
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (unlockTick <= 0) return
    setCelebrate(true)
    const t = setTimeout(() => setCelebrate(false), 1600)
    return () => clearTimeout(t)
  }, [unlockTick])

  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!note || !canvas.current || noteMode !== 'name') return
    const el = canvas.current
    const draw = () => drawNoteCard(el, note, { bg: 'transparent', staff: '#2a2733', note: '#14121c', clef: '#14121c' })
    draw()
    ensureMusicFont().then(draw)
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [note, noteMode])

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
            {'🤍'.repeat(Math.max(0, startLives - lives))}
          </div>
        </div>
      </div>

      {note &&
        (noteMode === 'find' ? (
          <div className="noteCard letterCard">
            <div className="bigLetter">{note.letter}</div>
            <div className="cap">Find this note</div>
          </div>
        ) : (
          <div className="noteCard">
            <canvas ref={canvas} />
            <div className="cap">Name this note</div>
          </div>
        ))}

      {/* note-ladder meter — vertical bar pinned to the right edge (out of the play area).
          Fills toward the next note to unlock (or toward mastery when the pool is full). */}
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
        <span style={{ fontSize: 14, lineHeight: 1 }}>
          {alreadyMastered ? '✓' : prog.full ? '🏁' : '🎵'}
        </span>
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
              height: `${fillPct}%`,
              borderRadius: 5,
              background: prog.full
                ? 'linear-gradient(0deg,#f5b94a,#ffd479)' // gold near the finish line
                : 'linear-gradient(0deg,#2fae62,#46d27a)',
              boxShadow: celebrate ? '0 0 12px 2px rgba(70,210,122,0.9)' : 'none',
              transition: 'height .25s, box-shadow .25s',
            }}
          />
        </div>
        <span
          style={{
            font: '700 11px "Space Grotesk", system-ui, sans-serif',
            color: prog.full ? '#ffd479' : '#46d27a',
            minWidth: 28,
            textAlign: 'center',
          }}
        >
          {isLadder ? `${prog.activeCount}/${prog.total}` : '🎵'}
        </span>
      </div>

      {/* fleeting celebration when the ladder reveals a new note */}
      {celebrate && isLadder && (
        <div
          key={unlockTick}
          className="noteUnlockToast"
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            borderRadius: 999,
            background: 'linear-gradient(90deg,#2fae62,#46d27a)',
            color: '#06120b',
            font: '800 15px "Space Grotesk", system-ui, sans-serif',
            boxShadow: '0 6px 20px rgba(70,210,122,0.5)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          🎵 New note unlocked!
        </div>
      )}

      {flashTick > 0 && lastResult && <div key={flashTick} className={`flash ${lastResult}`} />}
    </div>
  )
}
