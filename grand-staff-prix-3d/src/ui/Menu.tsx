import { useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useGame, activeProfile } from '../state/store'
import { leaderboard, type CloudPlayer } from '../lib/cloud'
import { NOTE_SETS, CLEF_GROUPS, DIFFICULTIES } from '../data/notes'
import { CARS, carById } from '../data/cars'
import { composerById } from '../data/composers'
import { THEMES } from '../data/themes'
import { input } from '../game/input'
import { Icon } from './icons'
import { MenuBackground } from './MenuBackground'
import { MenuCar3D } from './MenuCar3D'
import { ComposerPicker } from './ComposerPicker'
import { AssetThumb } from './AssetThumb'
import { LevelCreator } from './LevelCreator'
import { rankForXp, ACHIEVEMENTS, dailyChallenges } from '../data/progression'

// Bravura clef glyph(s) per track, for the level-row badge.
const CLEF_BADGE: Record<string, string> = {
  treble: String.fromCharCode(0xe050),
  bass: String.fromCharCode(0xe062),
  grand: String.fromCharCode(0xe050, 0xe062),
  alto: String.fromCharCode(0xe05c),
  tenor: String.fromCharCode(0xe05c),
}

type View = 'select' | 'create' | 'play' | 'garage' | 'profile' | 'leaderboard'

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

// ───────────────────────── Class code bar ─────────────────────────
function ClassBar({ onLeaderboard }: { onLeaderboard: () => void }) {
  const classCode = useGame((s) => s.settings.classCode)
  const joinClass = useGame((s) => s.joinClass)
  const [editing, setEditing] = useState(!classCode)
  const [code, setCode] = useState(classCode)
  const join = () => {
    if (!code.trim()) return
    void joinClass(code)
    setEditing(false)
  }
  return (
    <div className="card sec">
      <div className="secLabel">Class</div>
      {editing ? (
        <div className="addRow">
          <input
            className="input"
            placeholder="Class code (e.g. PIANO1)"
            maxLength={12}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button className="btn mini" onClick={join}>Join</button>
        </div>
      ) : (
        <div className="classRow">
          <span className="classCode">{classCode || 'Local only'}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="chip ghost" onClick={() => setEditing(true)}>Change</button>
            {classCode && (
              <button className="chip ghost" onClick={onLeaderboard}>{Icon.trophy} Leaderboard</button>
            )}
          </span>
        </div>
      )}
      <p className="tiny">Use the same class code on any device to sync scores + see the leaderboard.</p>
    </div>
  )
}

// ───────────────────────── Leaderboard ─────────────────────────
function Leaderboard({ onBack }: { onBack: () => void }) {
  const classCode = useGame((s) => s.settings.classCode)
  const [rows, setRows] = useState<CloudPlayer[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    leaderboard(classCode).then((r) => {
      if (alive) {
        setRows(r)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [classCode])
  return (
    <div className="sheet">
      <div className="topbar">
        <button className="chip ghost" onClick={onBack}>{Icon.back} Back</button>
        <div className="chip head">Class {classCode}</div>
      </div>
      <div className="card sec">
        <div className="secLabel">🏆 Leaderboard</div>
        {loading ? (
          <div className="empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No players in this class yet.</div>
        ) : (
          rows.map((p, i) => (
            <div key={p.id} className={`lbRow${i < 3 ? ' top' : ''}`}>
              <span className="lbRank">{i + 1}</span>
              <span className="lbName">{p.name}</span>
              <span className="lbXp">{Number(p.data?.xp ?? 0).toLocaleString()} XP</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ───────────────────────── Player Select ─────────────────────────
function PlayerSelect({ onPlay, onCreate, onLeaderboard }: { onPlay: () => void; onCreate: () => void; onLeaderboard: () => void }) {
  const profiles = useGame((s) => s.profiles)
  const selectProfile = useGame((s) => s.selectProfile)
  const removeProfile = useGame((s) => s.removeProfile)
  return (
    <div className="sheet">
      <Hero />
      <ClassBar onLeaderboard={onLeaderboard} />
      <div className="card sec">
        <div className="secLabel">Who's playing?</div>
        <div className="playerList">
          {profiles.length === 0 && <div className="empty">No players yet — add one to start.</div>}
          {profiles.map((p) => {
            const r = rankForXp(p.xp)
            return (
              <div
                key={p.id}
                className="playerRow"
                onClick={() => {
                  selectProfile(p.id)
                  onPlay()
                }}
              >
                <span className="pName">
                  <span className="avatar" style={{ ['--avHelmet' as string]: p.avatar.outfitColor }}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  {p.name}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="meta">{r.name} · 💎 {p.gems}</span>
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
            )
          })}
        </div>
        <button className="btn ghost" onClick={onCreate}>
          {Icon.plus} Add Player
        </button>
      </div>
    </div>
  )
}

// ───────────────────────── New Player (name) ─────────────────────────
function NewPlayer({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const addProfile = useGame((s) => s.addProfile)
  const [name, setName] = useState('')
  const create = () => {
    if (!name.trim()) return
    addProfile(name.trim())
    onCreated()
  }
  return (
    <div className="sheet">
      <div className="topbar">
        <button className="chip ghost" onClick={onCancel}>
          {Icon.back} Back
        </button>
      </div>
      <div className="card sec">
        <div className="secLabel">New player — what's your name?</div>
        <div className="addRow">
          <input
            className="input"
            maxLength={14}
            placeholder="Enter name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
            }}
          />
        </div>
        <button className="btn" onClick={create} disabled={!name.trim()} style={{ marginTop: 6 }}>
          {Icon.play} Next: pick your ride
        </button>
      </div>
    </div>
  )
}

// ───────────────────────── shared: car garage ─────────────────────────
function CarGarage() {
  const profile = useGame(activeProfile)
  const settings = useGame((s) => s.settings)
  const setCar = useGame((s) => s.setCar)
  const car = carById(profile?.carId ?? settings.carId)
  return (
    <div className="garage card">
      <div className="carStage" style={{ ['--carColor' as string]: car.color }}>
        <MenuCar3D carId={car.id} />
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
          <span className="track"><span className="fill2" style={{ width: `${car.speed * 100}%` }} /></span>
        </div>
        <div className="stat">
          <span className="k">Grip</span>
          <span className="track"><span className="fill2" style={{ width: `${car.grip * 100}%` }} /></span>
        </div>
      </div>
      <div className="carThumbs">
        {CARS.map((c) => (
          <button
            key={c.id}
            className={`carThumb${car.id === c.id ? ' on' : ''}`}
            onClick={() => setCar(c.id)}
            aria-label={c.name}
          >
            <span className="carThumbImg">
              <AssetThumb src={`/thumbs/car_${c.id}.png`} alt={c.name} />
            </span>
            <span className="thumbName">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Garage screen (car + composer) ─────────────────────────
function Garage({ onDone, isSetup }: { onDone: () => void; isSetup?: boolean }) {
  return (
    <div className="sheet">
      <div className="topbar">
        <div className="chip ghost head">{isSetup ? 'Set up your ride' : 'Garage'}</div>
      </div>
      <div className="sec garageSec">
        <div className="secLabel">Your car</div>
        <CarGarage />
      </div>
      <div className="sec">
        <div className="secLabel">Your composer (driver)</div>
        <ComposerPicker />
      </div>
      <div className="startWrap">
        <button className="btn" onClick={onDone}>
          {isSetup ? <>{Icon.play} Let's Race</> : <>{Icon.play} Done</>}
        </button>
      </div>
    </div>
  )
}

// ───────────────────────── Profile / stats screen ─────────────────────────
function ProfileScreen({ onBack }: { onBack: () => void }) {
  const profile = useGame(activeProfile)
  const settings = useGame((s) => s.settings)
  const toggleMusic = useGame((s) => s.toggleMusic)
  const toggleCClefs = useGame((s) => s.toggleCClefs)
  const setSteering = useGame((s) => s.setSteering)
  const daily = useGame((s) => s.daily)
  if (!profile) return null
  const r = rankForXp(profile.xp)
  const pct = r.xpForNext === Infinity ? 100 : Math.round((r.xpInto / r.xpForNext) * 100)
  const steerOpts: { id: 'keys' | 'touch' | 'tilt'; label: string; icon: React.ReactNode }[] = [
    { id: 'keys', label: 'Keys', icon: Icon.keys },
    { id: 'touch', label: 'Touch', icon: Icon.touch },
    { id: 'tilt', label: 'Tilt', icon: Icon.tilt },
  ]
  return (
    <div className="sheet">
      <div className="topbar">
        <button className="chip ghost" onClick={onBack}>
          {Icon.back} Back
        </button>
        <div className="chip head">{profile.name}</div>
      </div>

      <div className="rankStrip card">
        <div className="rankTop">
          <span className="rankName"><span className="rankLvl">LV {r.level}</span> {r.name}</span>
          <span className="rankGems">💎 {profile.gems}</span>
        </div>
        <div className="rankBarTrack"><span className="rankBarFill" style={{ width: `${pct}%` }} /></div>
        <div className="rankXp">
          {r.nextName ? `${r.xpInto} / ${r.xpForNext} XP → ${r.nextName}` : `${profile.xp} XP · max rank`}
        </div>
      </div>

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

      <div className="card sec">
        <div className="secLabel">Achievements</div>
        <div className="achGrid">
          {ACHIEVEMENTS.map((a) => {
            const owned = profile.achievements.includes(a.id)
            return (
              <div key={a.id} className={`achItem${owned ? ' owned' : ''}`} title={a.desc}>
                <span className="achIcon">{a.icon}</span>
                <span className="achName">{a.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="sec">
        <div className="secLabel">Settings</div>
        <div className="card optionsCard">
          <div className="row">
            <span className="rowLabel">{Icon.music} Music</span>
            <button className={`toggle${settings.music ? ' on' : ''}`} aria-label="Toggle music" onClick={toggleMusic} />
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
          <div className="rowDivider" />
          <div className="row">
            <span className="rowLabel">Alto &amp; Tenor clefs</span>
            <button
              className={`toggle${settings.showCClefs ? ' on' : ''}`}
              aria-label="Toggle alto and tenor clefs"
              onClick={toggleCClefs}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Play menu (level + scenery + start) ─────────────────────────
function PlayMenu({ onSwitch, onGarage, onProfile }: { onSwitch: () => void; onGarage: () => void; onProfile: () => void }) {
  const profile = useGame(activeProfile)
  const settings = useGame((s) => s.settings)
  const setLevel = useGame((s) => s.setLevel)
  const setTheme = useGame((s) => s.setTheme)
  const startGame = useGame((s) => s.startGame)
  const customLevels = useGame((s) => s.customLevels)
  const removeCustomLevel = useGame((s) => s.removeCustomLevel)
  const [creating, setCreating] = useState(false)
  // which difficulty sections are expanded (default: the band of the selected level)
  const [openBands, setOpenBands] = useState<Set<string>>(() => {
    const sel = NOTE_SETS.find((s) => s.id === settings.levelId)
    return new Set([sel?.band ?? 'beginner'])
  })
  const toggleBand = (b: string) =>
    setOpenBands((prev) => {
      const next = new Set(prev)
      if (next.has(b)) next.delete(b)
      else next.add(b)
      return next
    })

  // preload the chosen car + composer so the race starts smooth (no first-second hitch)
  const carModel = carById(profile?.carId ?? settings.carId).model
  const composerModel = composerById(profile?.composerId ?? settings.composerId).model
  useEffect(() => {
    if (carModel) useGLTF.preload(carModel)
    if (composerModel) useGLTF.preload(composerModel)
  }, [carModel, composerModel])

  const unlocked = new Set(profile?.unlocked ?? [NOTE_SETS[0].id])
  const mastered = new Set(profile?.mastered ?? [])
  const activeTheme = THEMES.find((t) => t.id === settings.themeId) ?? THEMES[0]
  const r = profile ? rankForXp(profile.xp) : null

  const onStart = () => {
    input.setMode(settings.steering)
    startGame()
  }

  return (
    <div className="sheet">
      <Hero />

      <div className="topbar">
        <button className="chip playerChip" onClick={onProfile}>
          <span className="avatar sm">{(profile?.name ?? 'P').slice(0, 1).toUpperCase()}</span>
          <span className="pcName">{profile?.name ?? 'Player'}</span>
          {r && <span className="pcMeta">LV {r.level} · 💎 {profile?.gems ?? 0}</span>}
        </button>
        <button className="chip ghost" onClick={onSwitch}>Switch {Icon.chevDown}</button>
      </div>

      <div className="navRow">
        <button className="navBtn" onClick={onGarage}>
          {Icon.play} <span>Garage</span><small>Car &amp; driver</small>
        </button>
        <button className="navBtn" onClick={onProfile}>
          {Icon.trophy} <span>Stats</span><small>Rank · challenges</small>
        </button>
      </div>

      {creating && <LevelCreator onClose={() => setCreating(false)} />}

      {/* LEVEL */}
      <div className="sec">
        <div className="secLabel">Level</div>
        <div className="levelList">
          {DIFFICULTIES.map((band) => {
            const bandLevels = NOTE_SETS.filter(
              (s) => s.band === band.id && (settings.showCClefs || (s.group !== 'alto' && s.group !== 'tenor')),
            )
            if (!bandLevels.length) return null
            const total = bandLevels.length
            const doneCount = bandLevels.filter((s) => mastered.has(s.id)).length
            const current = bandLevels.find((s) => !mastered.has(s.id) && (s.tier === 1 || unlocked.has(s.id)))
            const pct = Math.round((doneCount / total) * 100)
            const isOpen = openBands.has(band.id)
            const currentText = doneCount === total ? '✓ Complete' : current ? current.name : 'Locked'
            return (
              <div key={band.id} className={`bandSec${isOpen ? ' open' : ''}`}>
                <button className="bandHeader" onClick={() => toggleBand(band.id)}>
                  <div className="bandHeadTop">
                    <span className="bandChev">{Icon.chevDown}</span>
                    <span className="bandTitle">{band.label}</span>
                    <span className="bandCurrent">{currentText}</span>
                    <span className="bandCount">{doneCount}/{total}</span>
                  </div>
                  <span className="bandBar"><span style={{ width: `${pct}%` }} /></span>
                </button>
                {isOpen && (
                  <div className="bandBody">
                    {bandLevels.map((s) => {
                      const isUnlocked = s.tier === 1 || unlocked.has(s.id)
                      const on = settings.levelId === s.id
                      const best = profile?.best[s.id]
                      const clefLabel = CLEF_GROUPS.find((g) => g.id === s.group)?.label ?? ''
                      return (
                        <button
                          key={s.id}
                          className={`levelRow${on ? ' on' : ''}${isUnlocked ? '' : ' locked'}`}
                          disabled={!isUnlocked}
                          onClick={() => isUnlocked && setLevel(s.id)}
                        >
                          <span className="bar" />
                          <span className="clefBadge" aria-hidden>{CLEF_BADGE[s.group ?? 'treble']}</span>
                          <span className="info">
                            <div className="nm">{s.name}</div>
                            <div className="ds">{clefLabel} · {s.blurb}</div>
                          </span>
                          {isUnlocked ? (
                            <>
                              {mastered.has(s.id) && <span className="masteredTag">✓</span>}
                              {best ? (
                                <span className="best"><span className="bestV">{best}</span><span className="bestK">BEST</span></span>
                              ) : (
                                on && !mastered.has(s.id) && <span className="nowTag">Selected</span>
                              )}
                            </>
                          ) : (
                            <span className="lock">{Icon.lock}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
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

      <div className="startWrap">
        <button className="btn" onClick={onStart}>{Icon.play} Start Race</button>
        <p className="tiny">
          Steer into the gate whose letter matches the note on the staff. Master a level (Stage 4, 90%+ over 30 notes) to unlock the next.
        </p>
      </div>
    </div>
  )
}

export function Menu() {
  const currentId = useGame((s) => s.currentId)
  const [view, setView] = useState<View>(currentId ? 'play' : 'select')
  const [creating, setCreating] = useState(false) // true while a brand-new player is set up

  // if the current player vanished (deleted) drop back to select
  if (!currentId && (view === 'play' || view === 'garage' || view === 'profile')) {
    setView('select')
  }

  let screen: React.ReactNode
  switch (view) {
    case 'select':
      screen = (
        <PlayerSelect
          onPlay={() => setView('play')}
          onCreate={() => setView('create')}
          onLeaderboard={() => setView('leaderboard')}
        />
      )
      break
    case 'leaderboard':
      screen = <Leaderboard onBack={() => setView('select')} />
      break
    case 'create':
      screen = (
        <NewPlayer
          onCreated={() => {
            setCreating(true)
            setView('garage')
          }}
          onCancel={() => setView('select')}
        />
      )
      break
    case 'garage':
      screen = (
        <Garage
          isSetup={creating}
          onDone={() => {
            setCreating(false)
            setView('play')
          }}
        />
      )
      break
    case 'profile':
      screen = <ProfileScreen onBack={() => setView('play')} />
      break
    default:
      screen = (
        <PlayMenu
          onSwitch={() => setView('select')}
          onGarage={() => setView('garage')}
          onProfile={() => setView('profile')}
        />
      )
  }

  return (
    <div className="overlay">
      <MenuBackground />
      {screen}
    </div>
  )
}
