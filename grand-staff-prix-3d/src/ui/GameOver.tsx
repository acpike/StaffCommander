import { useGame, activeProfile } from '../state/store'
import { NOTE_SETS, nextLevel } from '../data/notes'
import { rankForXp, achievementById } from '../data/progression'
import { Icon } from './icons'

// A handful of confetti pieces for the mastery celebration (CSS-animated).
const CONFETTI = Array.from({ length: 28 }, (_, i) => i)
const CONFETTI_COLORS = ['#ffd479', '#46d27a', '#ff8a3d', '#4aa3ff', '#ff5a8a', '#b07bff']

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
  const setLevel = useGame((s) => s.setLevel)
  const goMenu = useGame((s) => s.goMenu)

  const best = profile?.best[levelId] ?? score
  const curSet = [...NOTE_SETS, ...customLevels].find((s) => s.id === levelId)
  const levelName = curSet?.name ?? ''
  const rank = rankForXp(profile?.xp ?? 0)

  // The next tier in this clef track, if it exists and is now unlocked.
  const next = curSet ? nextLevel(curSet) : undefined
  const nextUnlocked = !!next && (profile?.unlocked.includes(next.id) ?? false)
  const playNext = () => {
    if (!next) return
    setLevel(next.id)
    startGame()
  }

  return (
    <div className="overlay">
      {mastered && (
        <div className="confetti" aria-hidden>
          {CONFETTI.map((i) => (
            <span
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${(i % 10) * 0.15}s`,
                animationDuration: `${1.8 + (i % 5) * 0.35}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className={`overCard${mastered ? ' mastered' : ''}`}>
        {mastered ? (
          <>
            <div className="masterTitle">🏁 Track Complete!</div>
            <div className="masterSub">You mastered {levelName}</div>
          </>
        ) : (
          <div className="lbl">Race Complete · {levelName}</div>
        )}
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
          {nextUnlocked && (
            <button className="btn" onClick={playNext}>
              {Icon.play} Next Level: {next!.name}
            </button>
          )}
          <button className={`btn${nextUnlocked ? ' ghost' : ''}`} onClick={startGame}>
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
