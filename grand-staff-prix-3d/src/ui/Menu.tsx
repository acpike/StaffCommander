import { useState } from 'react'
import { useGame, activeProfile } from '../state/store'
import { NOTE_SETS } from '../data/notes'
import { CARS, carById } from '../data/cars'
import { THEMES } from '../data/themes'
import { input } from '../game/input'
import { Icon } from './icons'
import { MenuBackground } from './MenuBackground'
import { MenuCar3D } from './MenuCar3D'
import { ComposerPicker } from './ComposerPicker'
import { useThumbnails, type ThumbItem } from './useThumbnails'
import { LevelCreator } from './LevelCreator'
import { DEFAULT_AVATAR } from '../data/avatars'
import { rankForXp, ACHIEVEMENTS, dailyChallenges } from '../data/progression'

function Hero() {
  return (
    <div className="hero">
      <div className="glow" />
      <div className="eyebrow">Note-Reading Racing</div>
      <span className="gs">GRAND STAFF</span>
      <h1>
        PRI<span className="x">X</span>
      </h1>
      <div className="heroRule" />
    </div>
  )
}

function Players({ onDone }: { onDone: () => void }) {
  const profiles = useGame((s) => s.profiles)
  const addProfile = useGame((s) => s.addProfile)
  const selectProfile = useGame((s) => s.selectProfile)
  const removeProfile = useGame((s) => s.removeProfile)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const save = () => {
    if (!name.trim()) return
    addProfile(name, { ...DEFAULT_AVATAR })
    setName('')
    setAdding(false)
    onDone()
  }

  return (
    <div className="sheet">
      <Hero />
      <div className="card sec">
        <div className="secLabel">Who's playing?</div>
        <div className="playerList">
          {profiles.length === 0 && <div className="empty">No players yet — add one to start.</div>}
          {profiles.map((p) => (
            <div
              key={p.id}
              className="playerRow"
              onClick={() => {
                selectProfile(p.id)
                onDone()
              }}
            >
              <span className="pName">
                <span
                  className="avatar"
                  style={{ ['--avHelmet' as string]: p.avatar.outfitColor }}
                  title="Driver"
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                {p.name}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="meta">{rankForXp(p.xp).name} · 💎 {p.gems}</span>
                <button
                  className="del"
                  aria-label="Delete player"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeProfile(p.id)
                  }}
                >
                  {Icon.trash}
                </button>
              </span>
            </div>
          ))}
        </div>
        {adding ? (
          <div className="addRow">
            <input
              className="input"
              maxLength={14}
              placeholder="Enter name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
            />
            <button className="btn mini" onClick={save}>
              Create
            </button>
          </div>
        ) : (
          <button className="btn ghost" onClick={() => setAdding(true)}>
            {Icon.plus}
            Add Player
          </button>
        )}
      </div>
    </div>
  )
}

const CAR_THUMB_ITEMS: ThumbItem[] = CARS.filter((c) => c.model).map((c) => ({
  id: c.id,
  model: c.model as string,
  rotationY: c.modelRotation,
  kind: 'car',
}))

function Setup({ onSwitch }: { onSwitch: () => void }) {
  const profile = useGame(activeProfile)
  const settings = useGame((s) => s.settings)
  const setLevel = useGame((s) => s.setLevel)
  const setCar = useGame((s) => s.setCar)
  const setTheme = useGame((s) => s.setTheme)
  const toggleMusic = useGame((s) => s.toggleMusic)
  const setSteering = useGame((s) => s.setSteering)
  const startGame = useGame((s) => s.startGame)
  const customLevels = useGame((s) => s.customLevels)
  const removeCustomLevel = useGame((s) => s.removeCustomLevel)
  const daily = useGame((s) => s.daily)

  // Level creator overlay.
  const [creating, setCreating] = useState(false)
  // static car thumbnails (real asset rendered once) for the selector
  const carThumbs = useThumbnails(CAR_THUMB_ITEMS, 320)

  const car = carById(settings.carId)
  const unlocked = new Set(profile?.unlocked ?? [NOTE_SETS[0].id])
  const mastered = new Set(profile?.mastered ?? [])
  const activeTheme = THEMES.find((t) => t.id === settings.themeId) ?? THEMES[0]

  const onStart = () => {
    input.setMode(settings.steering)
    startGame()
  }

  const steerOpts: { id: 'keys' | 'touch' | 'tilt'; label: string; icon: React.ReactNode }[] = [
    { id: 'keys', label: 'Keys', icon: Icon.keys },
    { id: 'touch', label: 'Touch', icon: Icon.touch },
    { id: 'tilt', label: 'Tilt', icon: Icon.tilt },
  ]

  return (
    <div className="sheet">
      <Hero />

      <div className="topbar">
        <div className="chip">
          <span className="dotName" />
          {profile?.name ?? 'Player'}
        </div>
        <button className="chip ghost" onClick={onSwitch}>
          Switch player {Icon.chevDown}
        </button>
      </div>

      {profile &&
        (() => {
          const r = rankForXp(profile.xp)
          const pct = r.xpForNext === Infinity ? 100 : Math.round((r.xpInto / r.xpForNext) * 100)
          return (
            <div className="rankStrip card">
              <div className="rankTop">
                <span className="rankName">
                  <span className="rankLvl">LV {r.level}</span> {r.name}
                </span>
                <span className="rankGems">💎 {profile.gems}</span>
              </div>
              <div className="rankBarTrack">
                <span className="rankBarFill" style={{ width: `${pct}%` }} />
              </div>
              <div className="rankXp">
                {r.nextName ? `${r.xpInto} / ${r.xpForNext} XP → ${r.nextName}` : `${profile.xp} XP · max rank`}
              </div>
              <div className="badgeRow">
                {ACHIEVEMENTS.map((a) => {
                  const owned = profile.achievements.includes(a.id)
                  return (
                    <span key={a.id} className={`badge${owned ? ' owned' : ''}`} title={`${a.name} — ${a.desc}`}>
                      {a.icon}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}

      {/* TODAY'S CHALLENGES */}
      <div className="card sec">
        <div className="secLabel">Today's Challenges</div>
        {dailyChallenges(daily.date).map((c) => {
          const done = daily.done.includes(c.id)
          const prog = Math.min(daily.progress[c.id] ?? 0, c.target)
          return (
            <div key={c.id} className={`dailyRow${done ? ' done' : ''}`}>
              <span className="dailyCheck">{done ? '✓' : '○'}</span>
              <span className="dailyDesc">{c.desc}</span>
              <span className="dailyProg">{done ? `+${c.reward} 💎` : `${prog}/${c.target}`}</span>
            </div>
          )
        })}
      </div>

      {/* CAR GARAGE — live 3D showroom */}
      <div className="sec garageSec">
        <div className="secLabel">Garage</div>
        <div className="garage card">
          <div className="carStage" style={{ ['--carColor' as string]: car.color }}>
            <MenuCar3D carId={settings.carId} />
            <div className="stageGlare" />
          </div>

          <div className="carHead">
            <div className="carTitle">
              <span className="carIndex">{`0${CARS.findIndex((c) => c.id === car.id) + 1}`}</span>
              <span className="nm">{car.name}</span>
            </div>
            <div className="carSwatchDot" style={{ background: car.color }} />
          </div>

          <div className="stats">
            <div className="stat">
              <span className="k">Speed</span>
              <span className="track">
                <span className="fill2" style={{ width: `${car.speed * 100}%` }} />
              </span>
            </div>
            <div className="stat">
              <span className="k">Grip</span>
              <span className="track">
                <span className="fill2" style={{ width: `${car.grip * 100}%` }} />
              </span>
            </div>
          </div>

          <div className="carThumbs">
            {CARS.map((c) => (
              <button
                key={c.id}
                className={`carThumb${settings.carId === c.id ? ' on' : ''}`}
                onClick={() => setCar(c.id)}
                aria-label={c.name}
              >
                <span className="carThumbImg">
                  {carThumbs[c.id] ? <img src={carThumbs[c.id]} alt={c.name} /> : <span className="thumbSpin" />}
                </span>
                <span className="thumbName">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DRIVER — pick your composer */}
      <div className="sec">
        <div className="secLabel">Driver — pick your composer</div>
        <ComposerPicker />
      </div>

      {creating && <LevelCreator onClose={() => setCreating(false)} />}

      {/* LEVELS */}
      <div className="sec">
        <div className="secLabel">Level</div>
        <div className="levelList">
          {NOTE_SETS.map((s, i) => {
            const isUnlocked = unlocked.has(s.id)
            const on = settings.levelId === s.id
            const best = profile?.best[s.id]
            return (
              <button
                key={s.id}
                className={`levelRow${on ? ' on' : ''}${isUnlocked ? '' : ' locked'}`}
                disabled={!isUnlocked}
                onClick={() => isUnlocked && setLevel(s.id)}
              >
                <span className="bar" />
                <span className="num">{i + 1}</span>
                <span className="info">
                  <div className="nm">{s.name}</div>
                  <div className="ds">{s.blurb}</div>
                </span>
                {isUnlocked ? (
                  <>
                    {mastered.has(s.id) && <span className="masteredTag">✓ Mastered</span>}
                    {best ? (
                      <span className="best">
                        <span className="bestV">{best}</span>
                        <span className="bestK">BEST</span>
                      </span>
                    ) : (
                      on && !mastered.has(s.id) && <span className="nowTag">Selected</span>
                    )}
                  </>
                ) : (
                  <span className="lock">{Icon.lock} Master previous</span>
                )}
              </button>
            )
          })}

          {/* student-built custom levels (always playable) */}
          {customLevels.map((s) => {
            const on = settings.levelId === s.id
            return (
              <button key={s.id} className={`levelRow${on ? ' on' : ''}`} onClick={() => setLevel(s.id)}>
                <span className="bar" />
                <span className="num">★</span>
                <span className="info">
                  <div className="nm">{s.name}</div>
                  <div className="ds">{s.blurb}</div>
                </span>
                <span
                  className="del"
                  role="button"
                  aria-label="Delete custom level"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeCustomLevel(s.id)
                  }}
                >
                  {Icon.trash}
                </span>
              </button>
            )
          })}
        </div>
        <button className="btn ghost" onClick={() => setCreating(true)} style={{ marginTop: 4 }}>
          {Icon.plus} Create a Level
        </button>
      </div>

      {/* SCENERY */}
      <div className="sec">
        <div className="secLabel">Scenery</div>
        <div className="themeRow">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`themeTile${settings.themeId === t.id ? ' on' : ''}`}
              onClick={() => setTheme(t.id)}
              aria-label={t.name}
            >
              <span className="sky" style={{ background: `linear-gradient(${t.skyTop}, ${t.skyBottom})` }} />
              <span className="ground" style={{ background: t.ground }} />
              <span className="road" style={{ background: t.road }} />
              <span className="themeGlow" style={{ background: t.skyBottom }} />
            </button>
          ))}
        </div>
        <div className="themeName">{activeTheme.name}</div>
      </div>

      {/* OPTIONS */}
      <div className="sec">
        <div className="secLabel">Setup</div>
        <div className="card optionsCard">
          <div className="row">
            <span className="rowLabel">{Icon.music} Music</span>
            <button
              className={`toggle${settings.music ? ' on' : ''}`}
              aria-label="Toggle music"
              onClick={toggleMusic}
            />
          </div>
          <div className="rowDivider" />
          <div className="row">
            <span className="rowLabel">Steering</span>
            <div className="seg">
              {steerOpts.map((o) => (
                <button
                  key={o.id}
                  className={settings.steering === o.id ? 'on' : ''}
                  onClick={() => {
                    setSteering(o.id)
                    input.setMode(o.id)
                  }}
                >
                  {o.icon} {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="startWrap">
        <button className="btn" onClick={onStart}>
          {Icon.play} Start Race
        </button>
        <p className="tiny">
          Steer into the gate whose letter matches the note on the staff. Master a level (Stage 4, 90%+ over 30 notes) to unlock the next.
        </p>
      </div>
    </div>
  )
}

export function Menu() {
  const currentId = useGame((s) => s.currentId)
  const [forcePlayers, setForcePlayers] = useState(false)

  const showPlayers = !currentId || forcePlayers

  return (
    <div className="overlay">
      <MenuBackground />
      {showPlayers ? (
        <Players onDone={() => setForcePlayers(false)} />
      ) : (
        <Setup onSwitch={() => setForcePlayers(true)} />
      )}
    </div>
  )
}
