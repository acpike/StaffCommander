import { useGame, activeProfile } from '../state/store'
import { NOTE_SETS } from '../data/notes'
import { rankForXp, achievementById } from '../data/progression'
import { Icon } from './icons'

export function GameOver() {
  const score = useGame((s) => s.score)
  const stage = useGame((s) => s.stage)
  const levelId = useGame((s) => s.settings.levelId)
  const unlocked = useGame((s) => s.unlockedThisRun)
  const mastered = useGame((s) => s.masteredThisRun)
  const gemsEarned = useGame((s) => s.gemsEarned)
  const newAchievements = useGame((s) => s.newAchievements)
  const customLevels = useGame((s) => s.customLevels)
  const profile = useGame(activeProfile)
  const startGame = useGame((s) => s.startGame)
  const goMenu = useGame((s) => s.goMenu)

  const best = profile?.best[levelId] ?? score
  const levelName = [...NOTE_SETS, ...customLevels].find((s) => s.id === levelId)?.name ?? ''
  const rank = rankForXp(profile?.xp ?? 0)

  return (
    <div className="overlay">
      <div className="overCard">
        <div className="lbl">{mastered ? `🏁 Track Complete · ${levelName}` : `Race Complete · ${levelName}`}</div>
        <div className="big">{score}</div>

        <div className="overStats">
          <div className="overStat">
            <div className="v">{stage}</div>
            <div className="k">Stage</div>
          </div>
          <div className="overStat">
            <div className="v">💎 {gemsEarned}</div>
            <div className="k">Gems</div>
          </div>
          <div className="overStat">
            <div className="v">{best}</div>
            <div className="k">Best</div>
          </div>
        </div>

        {mastered && <div className="unlockBanner">⭐ You mastered {mastered}!</div>}
        {unlocked && <div className="unlockBanner">🔓 New level unlocked: {unlocked}</div>}
        {newAchievements.length > 0 && (
          <div className="achWon">
            🏆 New badge{newAchievements.length > 1 ? 's' : ''}:{' '}
            {newAchievements.map((id) => achievementById(id)?.name).filter(Boolean).join(', ')}
          </div>
        )}

        <div className="lbl" style={{ marginTop: 2 }}>
          {rank.name} · Lv {rank.level}
        </div>

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
