import { useGame, activeProfile } from '../state/store'
import { NOTE_SETS } from '../data/notes'
import { Icon } from './icons'

export function GameOver() {
  const score = useGame((s) => s.score)
  const stage = useGame((s) => s.stage)
  const levelId = useGame((s) => s.settings.levelId)
  const unlocked = useGame((s) => s.unlockedThisRun)
  const profile = useGame(activeProfile)
  const startGame = useGame((s) => s.startGame)
  const goMenu = useGame((s) => s.goMenu)

  const best = profile?.best[levelId] ?? score
  const levelName = NOTE_SETS.find((s) => s.id === levelId)?.name ?? ''

  return (
    <div className="overlay">
      <div className="overCard">
        <div className="lbl">Race Complete · {levelName}</div>
        <div className="big">{score}</div>

        <div className="overStats">
          <div className="overStat">
            <div className="v">{stage}</div>
            <div className="k">Stage</div>
          </div>
          <div className="overStat">
            <div className="v">{best}</div>
            <div className="k">Best</div>
          </div>
          <div className="overStat">
            <div className="v">{profile ? 1 + Math.floor(profile.xp / 500) : 1}</div>
            <div className="k">Level</div>
          </div>
        </div>

        {unlocked && <div className="unlockBanner">🔓 New level unlocked: {unlocked}</div>}

        <div className="startWrap" style={{ width: '100%' }}>
          <button className="btn" onClick={startGame}>
            {Icon.play} Race Again
          </button>
          <button className="btn ghost" onClick={goMenu}>
            {Icon.trophy} Back to Menu
          </button>
        </div>
      </div>
    </div>
  )
}
