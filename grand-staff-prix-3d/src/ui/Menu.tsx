import { useEffect, useState } from 'react'
import { useLoader } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useGame, activeProfile } from '../state/store'
import { leaderboard, type CloudPlayer } from '../lib/cloud'
import { NOTE_SETS, CLEF_GROUPS, DIFFICULTIES } from '../data/notes'
import { CARS, carById } from '../data/cars'
import { composerById } from '../data/composers'
import { THEMES } from '../data/themes'
import { input } from '../game/input'
import { BACKDROP_TINT_SRC } from '../game/Track'
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
        <span className="carName">{car.name}</span>
      </div>
      <div className="carStats">
        <div className="cstat">
          <span className="cstatK">Speed</span>
          <span className="cstatBar"><span style={{ width: `${car.speed * 100}%` }} /></span>
        </div>
        <div className="cstat">
          <span className="cstatK">Grip</span>
          <span className="cstatBar"><span style={{ width: `${car.grip * 100}%` }} /></span>
        </div>
      </div>
      <div className="pickRow">
        {CARS.map((c) => (
          <button key={c.id} className={`pickCard${car.id === c.id ? ' on' : ''}`} onClick={() => setCar(c.id)} aria-label={c.name}>
            <span className="pickImg"><AssetThumb src={`/thumbs/car_${c.id}.png`} alt={c.name} /></span>
            <span className="pickName">{c.name}</span>
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

  // preload the chosen car + composer + the theme's backdrop so the race starts
  // smooth — no first-second hitch and no "pop" when the painting swaps in (the
  // backdrop is the heaviest asset: a ~500 KB jpg that, unpreloaded, only starts
  // downloading the instant the Canvas mounts). Decoding it here warms the same
  // loader cache the in-game <Backdrop> reads, so it resolves instantly.
  const carModel = carById(profile?.carId ?? settings.carId).model
  const composerModel = composerById(profile?.composerId ?? settings.composerId).model
  const backdropSrc = BACKDROP_TINT_SRC[settings.themeId]
  useEffect(() => {
    if (carModel) useGLTF.preload(carModel)
    if (composerModel) useGLTF.preload(composerModel)
    if (backdropSrc) useLoader.preload(THREE.TextureLoader, backdropSrc)
  }, [carModel, composerModel, backdropSrc])

  const unlocked = new Set(profile?.unlocked ?? [NOTE_SETS[0].id])
  const mastered = new Set(profile?.mastered ?? [])
  const activeTheme = THEMES.find((t) => t.id === settings.themeId) ?? THEMES[0]
  const r = profile ? rankForXp(profile.xp) : null

  const onStart = () => {
    input.setMode(settings.steering)
    startGame()
  }

  // ── derived display values (ALL real data) ──────────────────────────
  const initial = (profile?.name ?? 'P').slice(0, 1).toUpperCase()
  const car = carById(profile?.carId ?? settings.carId)
  const composer = composerById(profile?.composerId ?? settings.composerId)
  const heroImg = BACKDROP_TINT_SRC[settings.themeId] ?? ''
  const [heroNameA, ...heroRest] = activeTheme.name.split(' ')
  const heroNameB = heroRest.join(' ')
  const selectedLevel =
    NOTE_SETS.find((s) => s.id === settings.levelId) ?? customLevels.find((s) => s.id === settings.levelId)
  // real progress across the visible track list
  const visibleTracks = NOTE_SETS.filter(
    (s) => settings.showCClefs || (s.group !== 'alto' && s.group !== 'tenor'),
  )
  const totalTracks = visibleTracks.length
  const masteredCount = visibleTracks.filter((s) => mastered.has(s.id)).length
  const unlockedCount = visibleTracks.filter((s) => s.tier === 1 || unlocked.has(s.id)).length
  const pctMastered = totalTracks ? Math.round((masteredCount / totalTracks) * 100) : 0
  const pctUnlocked = totalTracks ? Math.round((unlockedCount / totalTracks) * 100) : 0
  // rank/XP gauge (real)
  const xpPct = r ? (r.xpForNext === Infinity ? 100 : Math.round((r.xpInto / r.xpForNext) * 100)) : 0
  const tealArc = Math.round((xpPct / 100) * 235) // teal fill over the 235-unit gauge arc
  const gems = profile?.gems ?? 0
  const achCount = profile?.achievements.length ?? 0
  const achTotal = ACHIEVEMENTS.length
  // 3 sector-delta micro-bars per level, tied to real progress
  const deltaBars = (isUnlocked: boolean, isMastered: boolean, hasBest: boolean): string[] =>
    isMastered ? ['on', 'on', 'on'] : hasBest ? ['on', 'on', 'amber'] : isUnlocked ? ['amber', '', ''] : ['', '', '']

  return (
    <div className="hudmenu">
      <div className="hudBg" />
      <div className="hudApp">
        {creating && <LevelCreator onClose={() => setCreating(false)} />}

        {/* ===== MAIN GRID ===== */}
        <div className="grid">

          {/* LEFT: brand + telemetry hero + Garage/Stats */}
          <div className="colL">
          <header className="hudtop">
            <div className="brand">
              <div className="marque"><span>G</span></div>
              <div>
                <h1>Grand Staff <em>Prix</em></h1>
                <div className="tag">Note-Reading <b>Racing</b>{r ? ` · ${r.name}` : ''}</div>
              </div>
            </div>
          </header>
          {/* HERO TELEMETRY PANEL (selected circuit) */}
          <section className="hudhero">
            <div className="bg" style={{ backgroundImage: heroImg ? `url(${heroImg})` : undefined }} />
            <div className="scrim" />
            <div className="topstrip">
              <span className="live"><span className="dot" />LIVE TELEMETRY</span>
              <span>{selectedLevel ? selectedLevel.name.toUpperCase() : 'SELECT AN EVENT'} · {masteredCount}/{totalTracks} MASTERED</span>
            </div>
            <div className="loc">
              <div className="lbl">Circuit · Now on Grid</div>
              <h2>{heroNameA}<br />{heroNameB}</h2>
            </div>

            {/* the student's chosen driver (composer) — tap to swap in the Garage */}
            <div className="driver" role="button" aria-label="Change driver in Garage" onClick={onGarage}>
              <span className="face"><img src={`/thumbs/composer_${composer.id}.png`} alt={composer.name} /></span>
              <span className="dtx"><span className="dl">Driver · Tap to swap</span><span className="dn">{composer.name}</span></span>
            </div>

            <div className="speedlines"><i /><i /><i /></div>
            {/* the student's actual chosen car — tap to swap in the Garage */}
            <div className="car" role="button" aria-label="Change car in Garage" onClick={onGarage}>
              <img src={`/thumbs/car_${car.id}.png`} alt={car.name} />
              <span className="swaphint">⇄ Garage</span>
            </div>

            <div className="dash">
              <div className="gauge">
                <svg width="118" height="118" viewBox="0 0 118 118">
                  <circle cx="59" cy="59" r="50" fill="none" stroke="#0b1014" strokeWidth="9" />
                  <circle cx="59" cy="59" r="50" fill="none" stroke="#27313d" strokeWidth="9" strokeDasharray="235 314" strokeLinecap="round" />
                  <circle cx="59" cy="59" r="50" fill="none" stroke="#00e5c4" strokeWidth="9" strokeDasharray={`${tealArc} 314`} strokeLinecap="round" />
                </svg>
                <div className="read"><div className="v">{r?.level ?? 1}</div><div className="u">LEVEL</div></div>
              </div>
              <div className="sectors">
                <div className="secrow s1"><span className="sl">MSTR</span><span className="secbar"><i style={{ width: `${pctMastered}%` }} /></span><span className="st">{masteredCount}/{totalTracks}</span></div>
                <div className="secrow s2"><span className="sl">OPEN</span><span className="secbar"><i style={{ width: `${pctUnlocked}%` }} /></span><span className="st">{unlockedCount}/{totalTracks}</span></div>
                <div className="secrow s3"><span className="sl">XP</span><span className="secbar"><i style={{ width: `${xpPct}%` }} /></span><span className="st">{xpPct}%</span></div>
              </div>
              <div className="gforce">
                <div className="gv">{gems.toLocaleString()}</div>
                <div className="gl">Gems</div>
              </div>
            </div>
          </section>

            {/* Garage / Stats fill the space under the telemetry window */}
            <div className="duo">
              <button className="nav garage" onClick={onGarage}>
                <div className="ic">🔧</div>
                <div className="tx"><div className="t">Garage</div><div className="s">Car &amp; Driver</div></div>
              </button>
              <button className="nav stats" onClick={onProfile}>
                <div className="ic">📊</div>
                <div className="tx"><div className="t">Stats</div><div className="s">Rank · Challenges</div></div>
              </button>
            </div>
          </div>

          {/* RIGHT: profile card + level calendar */}
          <div className="colR">
            <button className="profiletile" onClick={onProfile}>
              <div className="pthead">
                <div className="avatar lg">{initial}<div className="lvtab">LV {r?.level ?? 1}</div></div>
                <div className="ptwho">
                  <div className="ptname">{profile?.name ?? 'Player'}</div>
                  <div className="ptrank">{r?.name ?? 'Rookie'}</div>
                </div>
              </div>
              <div className="ptxpwrap">
                <div className="ptxpbar"><i style={{ width: `${xpPct}%` }} /></div>
                <div className="ptxptx">
                  {r && r.xpForNext !== Infinity ? `${r.xpInto} / ${r.xpForNext} XP → ${r.nextName ?? ''}` : `${(profile?.xp ?? 0).toLocaleString()} XP · MAX RANK`}
                </div>
              </div>
              <div className="ptstats">
                <div className="ptstat amber"><span className="psv">{gems.toLocaleString()}</span><span className="psk">Gems</span></div>
                <div className="ptstat livery"><span className="psv">{masteredCount}/{totalTracks}</span><span className="psk">Mastered</span></div>
                <div className="ptstat purple"><span className="psv">{achCount}/{achTotal}</span><span className="psk">Badges</span></div>
                <div className="ptstat papaya"><span className="psv">{pctMastered}%</span><span className="psk">Complete</span></div>
              </div>
              <div className="ptfoot">
                <span className="sw" role="button" onClick={(e) => { e.stopPropagation(); onSwitch() }}>Switch profile</span>
                <span className="ptview">Full Stats ›</span>
              </div>
            </button>

            <section className="panel">
              <div className="ph">
                <h3>Grand Prix Calendar</h3>
                <span className="hint">Select Event</span>
              </div>
              <div className="diffs">
                {DIFFICULTIES.map((band) => {
                  const bandLevels = NOTE_SETS.filter(
                    (s) => s.band === band.id && (settings.showCClefs || (s.group !== 'alto' && s.group !== 'tenor')),
                  )
                  if (!bandLevels.length) return null
                  const total = bandLevels.length
                  const doneCount = bandLevels.filter((s) => mastered.has(s.id)).length
                  const pct = Math.round((doneCount / total) * 100)
                  const isOpen = openBands.has(band.id)
                  const bc = band.id.slice(0, 3) // beginner→beg, intermediate→int, advanced→adv
                  return (
                    <div key={band.id} className={`group ${bc}${isOpen ? ' open' : ''}`}>
                      <button className="ghead" onClick={() => toggleBand(band.id)}>
                        <span className="gx">{band.label}</span>
                        <span className="pbar"><i style={{ width: `${pct}%` }} /></span>
                        <span className="pcount">{doneCount}/{total}</span>
                        <span className="caret">▶</span>
                      </button>
                      <div className="tower">
                        {bandLevels.map((s, i) => {
                          const isUnlocked = s.tier === 1 || unlocked.has(s.id)
                          const on = settings.levelId === s.id
                          const isMastered = mastered.has(s.id)
                          const best = profile?.best[s.id]
                          const clefLabel = CLEF_GROUPS.find((g) => g.id === s.group)?.label ?? ''
                          const clefClass = s.group === 'bass' ? 'bass' : s.group === 'grand' ? 'grand' : 'treble'
                          const gap = !isUnlocked
                            ? 'LOCKED'
                            : isMastered
                              ? 'MASTERED'
                              : best
                                ? `BEST ${best}`
                                : on
                                  ? 'ON GRID'
                                  : 'READY'
                          return (
                            <button
                              key={s.id}
                              className={`lvl${on && isUnlocked ? ' selected' : ''}${isUnlocked ? '' : ' locked'}`}
                              disabled={!isUnlocked}
                              onClick={() => isUnlocked && setLevel(s.id)}
                            >
                              <span className="pos">P{i + 1}</span>
                              {isUnlocked ? (
                                <span className={`clef ${clefClass}`} aria-hidden>{CLEF_BADGE[s.group ?? 'treble']}</span>
                              ) : (
                                <span className="clef lockic">🔒</span>
                              )}
                              <div className="info">
                                <div className="ln">{s.name}</div>
                                <div className="ls">{clefLabel} · {s.blurb}</div>
                              </div>
                              <div className="delta">
                                {deltaBars(isUnlocked, isMastered, !!best).map((c, k) => (
                                  <b key={k} className={c} />
                                ))}
                              </div>
                              <span className="gap">{gap}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {customLevels.length > 0 && (
                  <div className="group beg open">
                    <div className="ghead">
                      <span className="gx">My Levels</span>
                      <span className="pbar"><i style={{ width: '100%' }} /></span>
                      <span className="pcount">{customLevels.length}</span>
                      <span className="caret">▶</span>
                    </div>
                    <div className="tower">
                      {customLevels.map((s, i) => {
                        const on = settings.levelId === s.id
                        return (
                          <button
                            key={s.id}
                            className={`lvl${on ? ' selected' : ''}`}
                            onClick={() => setLevel(s.id)}
                          >
                            <span className="pos">C{i + 1}</span>
                            <span className="clef" style={{ fontFamily: 'var(--disp)', color: 'var(--amber)' }} aria-hidden>★</span>
                            <div className="info">
                              <div className="ln">{s.name}</div>
                              <div className="ls">CUSTOM · {s.blurb}</div>
                            </div>
                            <span
                              className="gap"
                              role="button"
                              aria-label="Delete custom level"
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); removeCustomLevel(s.id) }}
                            >
                              ✕ DEL
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button className="createlvl" onClick={() => setCreating(true)}>
                  <span>＋</span> Create a Level
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* ===== SCENERY (CIRCUIT PADDOCK) ===== */}
        <section className="panel" style={{ marginTop: 14 }}>
          <div className="ph">
            <h3>Circuit Paddock</h3>
            <span className="hint">{THEMES.length} Circuits · Tap to Put on Grid</span>
          </div>
          <div className="scenes">
            {THEMES.map((t, i) => {
              const img = BACKDROP_TINT_SRC[t.id]
              const sel = settings.themeId === t.id
              return (
                <button
                  key={t.id}
                  className={`tile${sel ? ' selected' : ''}`}
                  onClick={() => setTheme(t.id)}
                  aria-label={t.name}
                >
                  <span className="px">C{i + 1}</span>
                  {img ? (
                    <img src={img} alt={t.name} />
                  ) : (
                    <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(${t.skyTop}, ${t.skyBottom})` }} />
                  )}
                  <div className="nm">{t.name}</div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ===== FOOTER / CTA ===== */}
        <footer className="foot">
          <div className="gphint">
            <b>Steer into the gate whose letter matches the note on the staff.</b>
          </div>
          <button className="start" onClick={onStart}>
            <span className="pre">FORMATION<br />LAP</span> Start Race
          </button>
        </footer>
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
      {/* the HUD play screen paints its own full-bleed carbon background */}
      {view !== 'play' && <MenuBackground />}
      {screen}
    </div>
  )
}
