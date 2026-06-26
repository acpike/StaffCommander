// Echo menu + level-select screens. Picks a mode (Beat Battle / Rhythm Simon),
// and within Battle, a level (gated by unlock progress in the shared store).

import { useStore, activeProfile } from '../../shared/store'
import { Button } from '../../shared/ui'
import { LEVELS, STAGE_INFO, type EchoLevel } from './levels'

interface MenuProps {
  onBattle: () => void
  onSimon: () => void
}

export function Menu({ onBattle, onSimon }: MenuProps) {
  const profile = useStore(activeProfile)
  const echo = profile?.games.echo
  const battleBest = echo
    ? Math.max(0, ...LEVELS.map((l) => echo.best[l.id] ?? 0))
    : 0
  const simonBest = echo?.best.simon ?? 0
  const cleared = echo?.mastered.length ?? 0

  return (
    <div className="echo-scroll">
      <div className="echo-menu">
        <div className="echo-hero-icon" aria-hidden>
          🥁
        </div>
        <h1 className="echo-title">ECHO</h1>
        <p className="echo-tag">Hear the beat, clap it back. Trade fours in a rhythm battle.</p>

        <div className="echo-modecards">
          <button
            className="echo-modecard"
            style={{ ['--cardc' as string]: 'var(--echo)' }}
            onClick={onBattle}
          >
            <div className="echo-modecard__icon" aria-hidden>
              🥊
            </div>
            <div className="echo-modecard__title">Beat Battle</div>
            <div className="echo-modecard__desc">
              Trade fours with escalating opponents across {LEVELS.length} levels. Lives, combos,
              mastery.
            </div>
            <div className="echo-modecard__best">
              {cleared > 0 ? `⭐ ${cleared} mastered · ` : ''}
              {battleBest > 0 ? `Best ${battleBest.toLocaleString()}` : 'Start your journey'}
            </div>
          </button>

          <button
            className="echo-modecard"
            style={{ ['--cardc' as string]: 'var(--echo-2)' }}
            onClick={onSimon}
          >
            <div className="echo-modecard__icon" aria-hidden>
              🧠
            </div>
            <div className="echo-modecard__title">Rhythm Simon</div>
            <div className="echo-modecard__desc">
              A melody-rhythm grows by one note each round. Echo the whole thing back. One slip ends
              the run.
            </div>
            <div className="echo-modecard__best">
              {simonBest > 0 ? `Best ${simonBest.toLocaleString()}` : 'How long can you remember?'}
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

interface LevelSelectProps {
  onPick: (level: EchoLevel) => void
  onBack: () => void
}

export function LevelSelect({ onPick, onBack }: LevelSelectProps) {
  const profile = useStore(activeProfile)
  const echo = profile?.games.echo
  // Global "Show beat lines" setting (persisted): 'auto' follows each level's
  // default; 'on'/'off' override it everywhere. Cycles auto → on → off → auto.
  const beatLines = useStore((s) => s.settings.beatLines)
  const setBeatLines = useStore((s) => s.setBeatLines)
  const cycleBeatLines = () =>
    setBeatLines(beatLines === 'auto' ? 'on' : beatLines === 'on' ? 'off' : 'auto')
  const beatLinesLabel =
    beatLines === 'on' ? 'Beat lines: On' : beatLines === 'off' ? 'Beat lines: Off' : 'Beat lines: Auto'

  // TEST: append ?unlock (or ?dev) to the URL to make every level playable.
  const devUnlockAll =
    typeof window !== 'undefined' &&
    /[?&](unlock|unlockall|dev)\b/.test(window.location.search)

  // A level is playable if it's the first, already unlocked, or already mastered.
  // Index is the level's position in the global LEVELS ladder (drives sequence).
  const isUnlocked = (l: EchoLevel): boolean => {
    if (devUnlockAll) return true
    const i = LEVELS.indexOf(l)
    if (i === 0) return true
    if (echo?.unlocked.includes(l.id)) return true
    // also unlocked if the previous level in the ladder is mastered
    const prev = LEVELS[i - 1]
    return !!echo?.mastered.includes(prev.id)
  }

  const kindLabel = (l: EchoLevel): string =>
    l.kind === 'feature' ? 'Feature' : l.kind === 'remix' ? '★ Remix' : 'Practice'

  return (
    <div className="echo-scroll">
      <div className="echo-ls">
        <div className="echo-ls__head">
          <div className="echo-ls__title">Beat Battle — World Map</div>
          <div className="echo-ls__actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleBeatLines}
              title="Show dashed beat-grid lines during play (Auto follows each level)"
            >
              ▦ {beatLinesLabel}
            </Button>
            <Button variant="ghost" size="sm" onClick={onBack}>
              ← Modes
            </Button>
          </div>
        </div>

        <div className="echo-map">
          {STAGE_INFO.map((stg) => {
            const levels = LEVELS.filter((l) => l.stage === stg.stage)
            if (levels.length === 0) return null
            // Stage progress: stars (mastered levels) earned / total in stage.
            const stars = levels.filter((l) => echo?.mastered.includes(l.id)).length
            const stageUnlocked = levels.some((l) => isUnlocked(l))
            const stageDone = stars === levels.length && levels.length > 0

            return (
              <section
                key={stg.stage}
                className={`echo-stagesec ${stageUnlocked ? '' : 'is-locked'} ${stageDone ? 'is-done' : ''}`}
              >
                <header className="echo-stagesec__head">
                  <div className="echo-stagesec__badge" aria-hidden>
                    {stg.opponent.emoji}
                  </div>
                  <div className="echo-stagesec__titles">
                    <div className="echo-stagesec__eyebrow">
                      Stage {stg.stage} · {stg.meters} · {stg.opponent.name}
                    </div>
                    <div className="echo-stagesec__title">{stg.title}</div>
                    <div className="echo-stagesec__blurb">{stg.blurb}</div>
                  </div>
                  <div
                    className="echo-stagesec__progress"
                    title={`${stars} of ${levels.length} levels mastered`}
                    aria-label={`${stars} of ${levels.length} levels mastered`}
                  >
                    <span className="echo-stagesec__stars">★</span>
                    <span>
                      {stars}/{levels.length}
                    </span>
                  </div>
                </header>

                <div className="echo-stagesec__grid">
                  {levels.map((l) => {
                    const unlocked = isUnlocked(l)
                    const mastered = !!echo?.mastered.includes(l.id)
                    const best = echo?.best[l.id] ?? 0
                    // cleared = played/unlocked-onward but not yet mastered.
                    const cleared = !mastered && (best > 0 || !!echo?.unlocked.includes(l.id))
                    const state = !unlocked
                      ? 'locked'
                      : mastered
                        ? 'mastered'
                        : cleared
                          ? 'cleared'
                          : 'unlocked'
                    return (
                      <button
                        key={l.id}
                        className={`echo-node is-${state} is-${l.kind}`}
                        disabled={!unlocked}
                        onClick={() => unlocked && onPick(l)}
                        title={`${l.title} — ${kindLabel(l)}`}
                      >
                        <div className="echo-node__corner" aria-hidden>
                          {state === 'mastered'
                            ? '⭐'
                            : state === 'locked'
                              ? '🔒'
                              : state === 'cleared'
                                ? '✓'
                                : ''}
                        </div>
                        <div className="echo-node__num">{l.id}</div>
                        <div className="echo-node__title">{l.title}</div>
                        <div className="echo-node__blurb">{l.blurb}</div>
                        <div className="echo-node__meta">
                          <span className={`echo-node__kind is-${l.kind}`}>{kindLabel(l)}</span>
                          <span className="echo-node__bpm">{l.bpm} BPM</span>
                          {best > 0 && (
                            <span className="echo-node__best">★ {best.toLocaleString()}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
