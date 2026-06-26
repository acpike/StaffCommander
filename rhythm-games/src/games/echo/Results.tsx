// Round/level/run results screen — celebrates the recordRun() outcome with XP,
// gems, rank-up, mastery, unlocks, and new achievements. Used by both modes.

import { useEffect } from 'react'
import type { RunOutcome } from '../../shared/store'
import { achievementById } from '../../shared/progression'
import { sound } from '../../shared/audio/sound'
import { Button } from '../../shared/ui'

export interface ResultsData {
  /** Big headline, e.g. "Level Cleared!" or "Run Over". */
  title: string
  subtitle: string
  crown: string
  score: number
  accuracy: number // 0..1
  outcome: RunOutcome
  /** Whether the player succeeded (won the level / good run) vs ran out of lives. */
  win: boolean
}

interface Props {
  data: ResultsData
  onReplay: () => void
  onNext?: () => void
  onMenu: () => void
  nextLabel?: string
}

export function Results({ data, onReplay, onNext, onMenu, nextLabel }: Props) {
  const { outcome } = data

  useEffect(() => {
    if (data.outcome.masteredNow || data.outcome.leveledUp) sound.fanfare()
    else if (data.win) sound.success()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="echo-results">
      <div className="echo-results__crown" aria-hidden>
        {data.crown}
      </div>
      <div className="echo-results__title">{data.title}</div>
      <div className="echo-results__sub">{data.subtitle}</div>

      <div className="echo-results__score">{data.score.toLocaleString()}</div>
      <div className="echo-results__acc">{Math.round(data.accuracy * 100)}% accuracy</div>

      {outcome.masteredNow && (
        <div className="echo-banner-mastered">⭐ Level Mastered! +50 bonus XP</div>
      )}
      {outcome.leveledUp && (
        <div className="echo-banner-unlock">⬆ Rank up — you're now {outcome.rank.name}!</div>
      )}
      {outcome.unlockedLevel && (
        <div className="echo-banner-unlock">🔓 New level unlocked!</div>
      )}

      <div className="echo-results__rewards">
        <div className="echo-reward echo-reward--xp">
          <span>XP</span>+{outcome.xpGained}
        </div>
        <div className="echo-reward echo-reward--gem">
          <span>Gems</span>+{outcome.gemsGained}
        </div>
        {data.outcome.newBest && (
          <div className="echo-reward">
            <span>Best</span>★ New!
          </div>
        )}
      </div>

      {outcome.newAchievements.length > 0 && (
        <div className="echo-ach-list">
          {outcome.newAchievements.map((id, i) => {
            const a = achievementById(id)
            if (!a) return null
            return (
              <div className="echo-ach" key={id} style={{ animationDelay: `${i * 90}ms` }}>
                <div className="echo-ach__icon">{a.icon}</div>
                <div>
                  <div className="echo-ach__name">{a.name}</div>
                  <div className="echo-ach__desc">{a.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="echo-results__btns">
        <Button variant="ghost" onClick={onMenu}>
          Menu
        </Button>
        <Button variant="outline" onClick={onReplay}>
          Replay
        </Button>
        {onNext && (
          <Button variant="primary" accent="var(--echo)" onClick={onNext}>
            {nextLabel ?? 'Next'}
          </Button>
        )}
      </div>
    </div>
  )
}
