import { useEffect, useMemo, useState } from 'react'
import { useStore, activeProfile, type GameId } from './shared/store'
import { setMasterVolume } from './shared/audio/clock'
import { rankForXp, dailyChallenges, todayKey } from './shared/progression'
import { ProfilePicker, Leaderboard, Button } from './shared/ui'
import type { GameMeta, GameProps } from './shared/gameModule'

import Echo, { meta as echoMeta } from './games/echo'
import Detective, { meta as detectiveMeta } from './games/detective'
import Builder, { meta as builderMeta } from './games/builder'
import './App.css'

interface GameEntry {
  meta: GameMeta
  Component: (props: GameProps) => React.ReactElement
}

const GAMES: GameEntry[] = [
  { meta: echoMeta, Component: Echo },
  { meta: detectiveMeta, Component: Detective },
  { meta: builderMeta, Component: Builder },
]

type Modal = null | 'profiles' | 'leaderboard'

export default function App() {
  const profiles = useStore((s) => s.profiles)
  const currentId = useStore((s) => s.currentId)
  const profile = useStore(activeProfile)
  const daily = useStore((s) => s.daily)
  const volume = useStore((s) => s.settings.volume)

  const [route, setRoute] = useState<GameId | null>(null)
  const [modal, setModal] = useState<Modal>(null)

  // Force the profile picker on first load if nobody is selected.
  useEffect(() => {
    if (!currentId && profiles.length === 0) setModal('profiles')
  }, [currentId, profiles.length])

  // Keep the audio master volume in sync with the persisted setting.
  useEffect(() => {
    setMasterVolume(volume)
  }, [volume])

  const dailies = useMemo(() => {
    const key = todayKey()
    return dailyChallenges(key).map((c) => ({
      ...c,
      progress: daily.date === key ? daily.progress[c.id] ?? 0 : 0,
      done: daily.date === key && daily.done.includes(c.id),
    }))
  }, [daily])

  if (route) {
    const entry = GAMES.find((g) => g.meta.id === route)
    if (entry) {
      const Game = entry.Component
      return <Game onExit={() => setRoute(null)} />
    }
  }

  const rank = profile ? rankForXp(profile.xp) : null

  return (
    <div className="rg-app">
      <header className="rg-app__header">
        <div className="rg-app__brand">
          <span className="rg-app__logo">♪</span>
          <span className="rg-app__brandtext">
            Rhythm <span className="rg-grad-text">Games</span>
          </span>
        </div>
        <div className="rg-app__headeractions">
          <Button variant="ghost" size="sm" onClick={() => setModal('leaderboard')}>
            🏆 Leaderboard
          </Button>
          <button className="rg-app__player" onClick={() => setModal('profiles')}>
            {profile ? (
              <>
                <span className="rg-app__playeravatar">{profile.name.slice(0, 1).toUpperCase()}</span>
                <span className="rg-app__playermeta">
                  <span className="rg-app__playername">{profile.name}</span>
                  <span className="rg-app__playerrank">
                    {rank?.name} · ◆ {profile.gems}
                  </span>
                </span>
              </>
            ) : (
              <span className="rg-app__playername">Choose player</span>
            )}
          </button>
        </div>
      </header>

      <main className="rg-app__main">
        <section className="rg-app__hero">
          <h1 className="rg-app__title">
            Three ways to <span className="rg-grad-text">feel the beat</span>.
          </h1>
          <p className="rg-app__subtitle">
            Clap it back, catch the impostor, or build it block by block. One profile — your XP, gems and
            rank follow you across all three.
          </p>
        </section>

        {rank && (
          <section className="rg-app__rankstrip">
            <div className="rg-app__rankbadge">{rank.level}</div>
            <div className="rg-app__rankinfo">
              <div className="rg-app__rankname">{rank.name}</div>
              <div className="rg-app__rankbar">
                <div className="rg-app__rankfill" style={{ width: `${Math.round(rank.progress * 100)}%` }} />
              </div>
              <div className="rg-app__rankxp">
                {rank.nextName ? `${rank.xpInto}/${rank.xpForNext} XP → ${rank.nextName}` : 'Max rank reached'}
              </div>
            </div>
            <div className="rg-app__rankgems">
              <span className="rg-app__gem">◆</span> {profile?.gems ?? 0}
            </div>
          </section>
        )}

        <section className="rg-app__cards">
          {GAMES.map((g, i) => (
            <button
              key={g.meta.id}
              className="rg-card"
              style={
                {
                  '--card-accent': g.meta.accent,
                  '--card-accent2': g.meta.accent2 ?? g.meta.accent,
                  animationDelay: `${i * 80}ms`,
                } as React.CSSProperties
              }
              onClick={() => {
                if (!currentId) {
                  setModal('profiles')
                  return
                }
                setRoute(g.meta.id)
              }}
            >
              <div className="rg-card__glow" />
              <div className="rg-card__icon">{g.meta.icon}</div>
              <h3 className="rg-card__title">{g.meta.title}</h3>
              <p className="rg-card__tag">{g.meta.tagline}</p>
              <span className="rg-card__cta">Play →</span>
            </button>
          ))}
        </section>

        <section className="rg-app__daily">
          <h2 className="rg-app__dailytitle">Today's Challenges</h2>
          <div className="rg-app__dailylist">
            {dailies.map((c) => (
              <div key={c.id} className={`rg-daily ${c.done ? 'is-done' : ''}`}>
                <div className="rg-daily__top">
                  <span className="rg-daily__desc">{c.desc}</span>
                  <span className="rg-daily__reward">◆ {c.reward}</span>
                </div>
                <div className="rg-daily__bar">
                  <div
                    className="rg-daily__fill"
                    style={{ width: `${Math.min(100, Math.round((c.progress / c.target) * 100))}%` }}
                  />
                </div>
                <span className="rg-daily__status">
                  {c.done ? '✓ Complete' : `${Math.min(c.progress, c.target)} / ${c.target}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="rg-app__footer">
        <span>Staff Commander · Rhythm Games</span>
      </footer>

      {modal && (
        <div className="rg-modal" onClick={() => setModal(null)}>
          <div className="rg-modal__panel rg-glass" onClick={(e) => e.stopPropagation()}>
            <button className="rg-modal__close" onClick={() => setModal(null)} aria-label="Close">
              ✕
            </button>
            {modal === 'profiles' && <ProfilePicker onDone={() => setModal(null)} />}
            {modal === 'leaderboard' && <Leaderboard />}
          </div>
        </div>
      )}
    </div>
  )
}
