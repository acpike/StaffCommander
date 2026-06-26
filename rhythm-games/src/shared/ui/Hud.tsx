import { rankForXp } from '../progression'
import './Hud.css'

interface Props {
  /** Player name to show (optional). */
  name?: string
  /** Lifetime XP — drives rank + progress bar. */
  xp: number
  /** Lifetime gems. */
  gems: number
  /** Live run score (optional — hide if undefined). */
  score?: number
  /** Lives remaining this run (optional). */
  lives?: number
  /** Max lives, for rendering empty pips. Default 3. */
  maxLives?: number
  /** Live combo streak (optional). */
  streak?: number
  /** Accent color for the game context (optional). */
  accent?: string
  /** Compact mode for in-game top bar. */
  compact?: boolean
}

/** Shared HUD chrome: rank + XP bar, gems, and optional run stats. */
export function Hud({
  name,
  xp,
  gems,
  score,
  lives,
  maxLives = 3,
  streak,
  accent,
  compact,
}: Props) {
  const rank = rankForXp(xp)
  return (
    <div
      className={`rg-hud ${compact ? 'rg-hud--compact' : ''}`}
      style={accent ? ({ '--hud-accent': accent } as React.CSSProperties) : undefined}
    >
      <div className="rg-hud__rank">
        <div className="rg-hud__rankbadge" aria-hidden>
          {rank.level}
        </div>
        <div className="rg-hud__rankmeta">
          <div className="rg-hud__rankname">
            {name ? <span className="rg-hud__name">{name}</span> : null}
            {rank.name}
          </div>
          <div className="rg-hud__bar" aria-hidden>
            <div
              className="rg-hud__barfill"
              style={{ width: `${Math.round(rank.progress * 100)}%` }}
            />
          </div>
          <div className="rg-hud__xp">
            {rank.nextName
              ? `${rank.xpInto} / ${rank.xpForNext} XP → ${rank.nextName}`
              : `${xp} XP · Max rank`}
          </div>
        </div>
      </div>

      <div className="rg-hud__stats">
        {score !== undefined && (
          <div className="rg-hud__stat rg-hud__stat--score">
            <span className="rg-hud__statlabel">Score</span>
            <span className="rg-hud__statval">{score.toLocaleString()}</span>
          </div>
        )}
        {streak !== undefined && streak > 0 && (
          <div className="rg-hud__stat rg-hud__stat--streak">
            <span className="rg-hud__statval">🔥 {streak}</span>
          </div>
        )}
        {lives !== undefined && (
          <div className="rg-hud__lives" aria-label={`${lives} lives`}>
            {Array.from({ length: maxLives }).map((_, i) => (
              <span key={i} className={`rg-hud__life ${i < lives ? 'is-on' : ''}`}>
                ♥
              </span>
            ))}
          </div>
        )}
        <div className="rg-hud__stat rg-hud__stat--gems">
          <span className="rg-hud__statval">
            <span className="rg-hud__gem">◆</span> {gems.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
