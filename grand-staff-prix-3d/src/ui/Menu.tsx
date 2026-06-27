import { useEffect, useMemo, useRef, useState } from 'react'
import { useLoader } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useGame, activeProfile } from '../state/store'
import { leaderboard, type CloudPlayer } from '../lib/cloud'
import { NOTE_SETS, CLEF_GROUPS, REGIONS, JOURNEY_STAGES, type NoteSet } from '../data/notes'
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
import { RangePreview } from './RangePreview'
import { LevelCreator } from './LevelCreator'
import { rankForXp, ACHIEVEMENTS, dailyChallenges } from '../data/progression'

// Bravura clef glyph(s) per track, for the level-row badge.
const CLEF_BADGE: Record<string, string> = {
  treble: String.fromCharCode(0xe050),
  bass: String.fromCharCode(0xe062),
  grand: String.fromCharCode(0xe050, 0xe062),
  journey: String.fromCharCode(0xe050, 0xe062), // grand staff — the Learning-Mode chain
  alto: String.fromCharCode(0xe05c),
  tenor: String.fromCharCode(0xe05c),
}

// Per-circuit accent colour for the scenery-tile name stripe (identity without
// hurting legibility — the name itself stays uniform white).
const TILE_ACCENT: Record<string, string> = {
  mountain: '#00e5c4',
  city: '#ffc23d',
  desert: '#ff8a3d',
  candy: '#ff6fb0',
  space: '#8b7bff',
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
        <button className="backbtn" onClick={onBack}>{Icon.back} Back</button>
        <div className="chip head">Class {classCode}</div>
      </div>
      <div className="card sec lbCard">
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
        <div className="playerList playerGrid">
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
      <div className="card sec npForm">
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
        {!isSetup && (
          <button className="backbtn" onClick={onDone}>{Icon.back} Back</button>
        )}
        <div className="chip ghost head">{isSetup ? 'Set up your ride' : 'Garage'}</div>
      </div>
      <div className="garageGrid">
        <div className="sec garageSec">
          <div className="secLabel">Your car</div>
          <CarGarage />
        </div>
        <div className="sec">
          <div className="secLabel">Your composer (driver)</div>
          <ComposerPicker />
        </div>
      </div>
      {/* setup is a forward step (Let's Race); the normal Garage returns via the Back chevron above */}
      {isSetup && (
        <div className="startWrap">
          <button className="btn" onClick={onDone}>{Icon.play} Let's Race</button>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Profile / stats screen ─────────────────────────
function ProfileScreen({ onBack, onSwitch, onLeaderboard }: { onBack: () => void; onSwitch: () => void; onLeaderboard: () => void }) {
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
        <button className="backbtn" onClick={onBack}>
          {Icon.back} Back
        </button>
        <div className="chip head">{profile.name}</div>
        <button className="chip ghost" onClick={onLeaderboard}>{Icon.trophy} Leaderboard</button>
        <button className="chip ghost" onClick={onSwitch}>⇄ Switch</button>
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

      <div className="profileGrid">
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
    </div>
  )
}

/** 7 region pips, each split into the region's 3 sublevels (Name / Find / Mix). A segment
 *  fills teal as that sublevel is mastered, glows amber for the one you're on now. Shared
 *  by the HUD centre and the journey drawer so the progress reads identically in both. */
function JourneyPips({ currentStageId, mastered, onPick, picked }: { currentStageId?: string; mastered: Set<string>; onPick?: (n: number) => void; picked?: number }) {
  return (
    <div className={`jpips${onPick ? ' clickable' : ''}`}>
      {REGIONS.map((region) => {
        const rs = JOURNEY_STAGES.filter((s) => s.id.startsWith(`r${region.n}-`))
        const allDone = rs.every((s) => mastered.has(s.id))
        const here = rs.some((s) => s.id === currentStageId)
        const cls = `jpipwrap${allDone ? ' done' : here ? ' here' : ''}${picked === region.n ? ' picked' : ''}`
        const inner = (
          <>
            <div className="jpip">
              {rs.map((s) => (
                <span key={s.id} className={`jseg${mastered.has(s.id) ? ' done' : s.id === currentStageId ? ' here' : ''}`} />
              ))}
            </div>
            <span className="jpipn">{allDone ? '✓' : region.n}</span>
          </>
        )
        return onPick ? (
          <button key={region.n} type="button" className={cls} title={region.name} onClick={() => onPick(region.n)}>
            {inner}
          </button>
        ) : (
          <div key={region.n} className={cls} title={region.name}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────────── Play menu (level + scenery + start) ─────────────────────────
function PlayMenu({ onGarage, onProfile }: { onGarage: () => void; onProfile: () => void }) {
  const profile = useGame(activeProfile)
  const settings = useGame((s) => s.settings)
  const setLevel = useGame((s) => s.setLevel)
  const setTheme = useGame((s) => s.setTheme)
  const startGame = useGame((s) => s.startGame)
  const customLevels = useGame((s) => s.customLevels)
  const removeCustomLevel = useGame((s) => s.removeCustomLevel)
  const [creating, setCreating] = useState(false)

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

  // ── class leaderboard (fetched once on mount / when the class changes) ──
  // Resilient: leaderboard() already swallows cloud errors and returns []; an
  // empty class code or empty roster falls back to the local-only friendly state.
  const [classRows, setClassRows] = useState<CloudPlayer[]>([])
  const [drawer, setDrawer] = useState<null | 'journey' | 'sidequests'>(null)
  const [circuitPick, setCircuitPick] = useState(false)
  // which region the journey drawer is previewing (tap a pip to look ahead at locked regions);
  // null = follow the current region
  const [pickedRegion, setPickedRegion] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    leaderboard(settings.classCode)
      .then((r) => { if (alive) setClassRows(r) })
      .catch(() => { if (alive) setClassRows([]) })
    return () => {
      alive = false
    }
  }, [settings.classCode])
  // best score per level across the whole class, with the holder's name (for the
  // per-stage track records on the journey + side quests).
  const classRecords = useMemo(() => {
    const rec: Record<string, { score: number; name: string }> = {}
    for (const p of classRows) {
      const best = (p.data?.best ?? {}) as Record<string, number>
      for (const id in best) {
        const sc = Number(best[id] ?? 0)
        if (!sc) continue
        if (!rec[id] || sc > rec[id].score) rec[id] = { score: sc, name: p.name }
      }
    }
    return rec
  }, [classRows])

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

  // ── Learning Journey state (the 21-stage chain, 7 regions × Name/Find/Mix) ──
  // A stage is mastered / current (the live frontier) / unlocked-ready / locked.
  // The "current" stage is the first unlocked-but-unmastered stage in tier order —
  // the single place the linear chain has open, shown front-and-centre.
  const isJUnlocked = (s: NoteSet): boolean => s.tier === 1 || unlocked.has(s.id)
  const journeyMastered = JOURNEY_STAGES.filter((s) => mastered.has(s.id)).length
  const currentStage = JOURNEY_STAGES.find((s) => isJUnlocked(s) && !mastered.has(s.id))
  const currentStageId = currentStage?.id
  // centre HUD: where you are in the journey (region X of 7 + tier name) and the range you're on
  const stageNo = currentStage?.tier ?? JOURNEY_STAGES.length
  const regionNo = Math.ceil(stageNo / 3)
  const tierName = currentStage?.band ? currentStage.band[0].toUpperCase() + currentStage.band.slice(1) : 'Complete'
  const [stageRegionName, stageModeLabel] = currentStage ? currentStage.name.split(' · ') : ['Journey Complete', '']
  const modeLabelOf = (s: NoteSet): string => (s.mode === 'find' ? 'Find' : s.mode === 'mix' ? 'Mix' : 'Name')

  // auto-scroll the journey list so the current milestone stays in view (the chain
  // advances itself as stages unlock — keep "you are here" visible without scrolling)
  const jbodyRef = useRef<HTMLDivElement>(null)
  const activeRegionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const cont = jbodyRef.current
    const reg = activeRegionRef.current
    if (!cont || !reg) return
    cont.scrollTop += reg.getBoundingClientRect().top - cont.getBoundingClientRect().top - 14
  }, [currentStageId])

  return (
    <div className="hudmenu">
      <div className="hudBg" />
      <div className={`hudApp${drawer ? ` drawer-open dr-${drawer}` : ''}`}>
        {creating && <LevelCreator onClose={() => setCreating(false)} />}
        {drawer && <div className="drawerscrim" onClick={() => setDrawer(null)} />}

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
            <div className="loc">
              <div className="lbl">Circuit · Now on Grid</div>
              <h2>{heroNameA}<br />{heroNameB} <button className="locarrow" onClick={() => setCircuitPick(true)} aria-label="Change circuit">›</button></h2>
            </div>

            {/* the student's profile in the driver chip's spot + STYLING — tap → full profile
                stats + leaderboard. Always visible so nobody plays on the wrong profile. */}
            <div className="driver" role="button" aria-label="Profile — full stats & leaderboard" onClick={onProfile}>
              <span className="face init">{initial}</span>
              <span className="dtx"><span className="dl">{r?.name ?? 'Rookie'}</span><span className="dn">{profile?.name ?? 'Player'}</span></span>
              <span className="dchev">›</span>
            </div>
            {/* car + driver as small labels under the profile (right side) — tap → Garage */}
            <div className="rig" role="button" aria-label="Change car & driver in Garage" onClick={onGarage}>
              <span className="rigitems">
                <span className="rigit"><span className="rigk">Driver</span><img className="rigface" src={`/thumbs/composer_${composer.id}.png`} alt={composer.name} /></span>
                <span className="rigit"><span className="rigk">Wheels</span><img className="rigcar" src={`/thumbs/car_${car.id}.png`} alt={car.name} /></span>
              </span>
              <span className="rigchev">›</span>
            </div>

            <div className="speedlines"><i /><i /><i /></div>
            {/* CENTRE — the hero: where you are in the journey + the note range you're on.
                Tap → the full journey drawer. */}
            <button className="levelcenter" onClick={() => setDrawer((d) => (d === 'journey' ? null : 'journey'))}>
              <div className="lcvhead">Region <b>{regionNo}</b> of {REGIONS.length} · {tierName}</div>
              <JourneyPips currentStageId={currentStageId} mastered={mastered} />
              <div className="lcvstaffwrap">
                <div className="lcvstaff">{currentStage?.ladder ? <RangePreview ladder={currentStage.ladder} /> : null}</div>
                {stageModeLabel ? <div className="lcvmode">{stageModeLabel} Mode</div> : null}
              </div>
              <div className="lcvcap">{stageRegionName} — tap for your full journey ›</div>
            </button>

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

          {/* two side-by-side options below the HUD — each opens a slide drawer */}
          <div className="hudnav">
            <button className="hudnavbtn" onClick={() => setDrawer((d) => (d === 'sidequests' ? null : 'sidequests'))}>
              <span className="hnico">{Icon.quest}</span>
              <span className="hntx"><span className="hnt">Side Quests</span><span className="hns">Optional drills</span></span>
              <span className="hnchev">›</span>
            </button>
            <button className="hudnavbtn" onClick={() => setCreating(true)}>
              <span className="hnico">{Icon.create}</span>
              <span className="hntx"><span className="hnt">Create Your Own Level</span><span className="hns">Pick a clef + your notes</span></span>
              <span className="hnchev">›</span>
            </button>
          </div>

          </div>

          {/* RIGHT: profile card + level calendar */}
          <div className="colR">
            {/* collapse chevron — shrink the drawer back to the full HUD */}
            <button className="backbtn" onClick={() => setDrawer(null)} aria-label="Back to HUD">{Icon.back} Back</button>

            {/* LEARNING JOURNEY — 7 regions × Name/Find/Mix, the 21-stage chain */}
            <section className="panel journey">
              <div className="ph">
                <h3>Learning Journey</h3>
                <span className="hint">{journeyMastered}/{JOURNEY_STAGES.length} Stages · {currentStage ? `On ${currentStage.name}` : 'Complete'}</span>
              </div>
              <div className="jbody" ref={jbodyRef}>
                {/* progress map — the 7 milestones, each split into its 3 sublevels. Tap any pip
                    (even locked ones) to look ahead at that region's range + sublevels. */}
                <JourneyPips currentStageId={currentStageId} mastered={mastered} onPick={setPickedRegion} picked={pickedRegion ?? regionNo} />
                {/* the card for the region you're previewing (defaults to your current region) */}
                {REGIONS.filter((region) => region.n === (pickedRegion ?? regionNo)).map((region) => {
                  const stages = JOURNEY_STAGES.filter((s) => s.id.startsWith(`r${region.n}-`))
                  const masteredHere = stages.filter((s) => mastered.has(s.id)).length
                  const regionUnlocked = stages.some(isJUnlocked)
                  const hasCurrent = stages.some((s) => s.id === currentStageId)
                  const allDone = masteredHere === stages.length
                  const rcls = hasCurrent ? ' active' : allDone ? ' done' : !regionUnlocked ? ' locked' : ''
                  return (
                    <div key={region.n} className={`region${rcls}`} ref={hasCurrent ? activeRegionRef : undefined}>
                      <div className="rhead">
                        <span className="rnode">{region.n}</span>
                        <div className="rmeta">
                          <div className="rname">{region.name}</div>
                        </div>
                        <div className="rprev"><RangePreview ladder={region.ladder} /></div>
                        <span className="rprog" aria-label={`${masteredHere} of ${stages.length} modes mastered`}>
                          {stages.map((s) => (
                            <i key={s.id} className={mastered.has(s.id) ? 'on' : ''} />
                          ))}
                        </span>
                      </div>
                      <div className="rsteps">
                        {stages.map((s) => {
                          const isMastered = mastered.has(s.id)
                          const isUnlocked = isJUnlocked(s)
                          const isCurrent = s.id === currentStageId
                          const on = settings.levelId === s.id
                          const best = profile?.best[s.id]
                          const rec = classRecords[s.id]
                          const ml = modeLabelOf(s)
                          const stateCls = isMastered
                            ? ' mastered'
                            : isCurrent
                              ? ' current'
                              : isUnlocked
                                ? ' ready'
                                : ' locked'
                          const stateLabel = !isUnlocked
                            ? 'Locked'
                            : isMastered
                              ? 'Mastered'
                              : isCurrent
                                ? 'You are here'
                                : best
                                  ? `Best ${best}`
                                  : 'Ready'
                          return (
                            <button
                              key={s.id}
                              className={`jstep${stateCls}${on && isUnlocked ? ' selected' : ''}`}
                              disabled={!isUnlocked}
                              onClick={() => isUnlocked && setLevel(s.id)}
                            >
                              <div className="jtop">
                                <span className="jicon" aria-hidden>{isMastered ? '✓' : !isUnlocked ? '🔒' : ml.slice(0, 1)}</span>
                                <span className="jmode">{ml}</span>
                              </div>
                              <span className="jstate">{stateLabel}</span>
                              {rec && (
                                <span className="rec">🏁 {rec.score.toLocaleString()} · {rec.name.toUpperCase()}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ===== SIDE QUESTS — under the journey, optional drills + custom levels (§10) ===== */}
            <section className="panel sidequests" style={{ marginTop: 14 }}>
          <div className="ph">
            <h3>Side Quests</h3>
            <span className="hint">Optional · Targeted Practice</span>
          </div>
          <div className="sqbody">
            {NOTE_SETS.filter(
              (s) => s.kind === 'sidequest' && (settings.showCClefs || (s.group !== 'alto' && s.group !== 'tenor')),
            ).map((s) => {
              const isUnlocked = true // side quests are optional — never locked
              const isMastered = mastered.has(s.id)
              const on = settings.levelId === s.id
              const best = profile?.best[s.id]
              const rec = classRecords[s.id]
              const groupLabel = CLEF_GROUPS.find((g) => g.id === s.group)?.label ?? ''
              const clefClass =
                s.group === 'bass' ? 'bass' : s.group === 'grand' ? 'grand' : s.group === 'alto' || s.group === 'tenor' ? 'cclef' : 'treble'
              const state = !isUnlocked
                ? 'LOCKED'
                : isMastered
                  ? 'MASTERED'
                  : best
                    ? `BEST ${best}`
                    : on
                      ? 'SELECTED'
                      : 'READY'
              return (
                <button
                  key={s.id}
                  className={`sqcard${isMastered ? ' mastered' : ''}${isUnlocked ? '' : ' locked'}${on && isUnlocked ? ' on' : ''}`}
                  disabled={!isUnlocked}
                  onClick={() => isUnlocked && setLevel(s.id)}
                >
                  <span className={`sqclef clef ${clefClass}`} aria-hidden>{isUnlocked ? CLEF_BADGE[s.group ?? 'treble'] : '🔒'}</span>
                  <div className="sqtx">
                    <div className="sqn">{s.name}</div>
                    <div className="sqs">{groupLabel} · {s.blurb}</div>
                    {rec && (
                      <div className="rec">🏁 REC {rec.score.toLocaleString()} · {rec.name.toUpperCase()}</div>
                    )}
                  </div>
                  <span className="sqstate">{state}</span>
                </button>
              )
            })}

            {customLevels.map((s) => {
              const on = settings.levelId === s.id
              return (
                <button key={s.id} className={`sqcard custom${on ? ' on' : ''}`} onClick={() => setLevel(s.id)}>
                  <span className="sqclef" aria-hidden>★</span>
                  <div className="sqtx">
                    <div className="sqn">{s.name}</div>
                    <div className="sqs">Custom · {s.blurb}</div>
                  </div>
                  <span
                    className="sqdel"
                    role="button"
                    aria-label="Delete custom level"
                    onClick={(e) => { e.stopPropagation(); removeCustomLevel(s.id) }}
                  >
                    ✕
                  </span>
                </button>
              )
            })}
          </div>
            <div className="sqfoot">
              <button className="sqcard sqcreate" onClick={() => setCreating(true)}>
                <span>＋</span> Create a Level
              </button>
            </div>
            </section>
          </div>
        </div>

        {/* ===== SCENERY (CIRCUIT PADDOCK) ===== */}
        {/* CIRCUIT PICKER POPUP — opened by the ⌄ chevron next to the circuit name in the HUD
            (replaces the always-on paddock; click a circuit or outside / ✕ to close) */}
        {circuitPick && (
          <div className="circpop" onClick={(e) => { if (e.target === e.currentTarget) setCircuitPick(false) }}>
            <div className="circpopcard">
              <div className="ph">
                <h3>Choose Your Circuit</h3>
                <button className="phlink" onClick={() => setCircuitPick(false)}>✕ Close</button>
              </div>
              <div className="scenes">
                {THEMES.map((t, i) => {
                  const img = BACKDROP_TINT_SRC[t.id]
                  const sel = settings.themeId === t.id
                  return (
                    <button
                      key={t.id}
                      className={`tile${sel ? ' selected' : ''}`}
                      style={{ ['--tileAccent' as string]: TILE_ACCENT[t.id] ?? '#00e5c4' }}
                      onClick={() => { setTheme(t.id); setCircuitPick(false) }}
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
            </div>
          </div>
        )}

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
            // New profiles route into placement (spec §9) instead of straight to the
            // play menu; an existing player tweaking the garage just returns to play.
            const isNewPlayer = creating
            setCreating(false)
            if (isNewPlayer) useGame.getState().beginPlacement()
            else setView('play')
          }}
        />
      )
      break
    case 'profile':
      screen = <ProfileScreen onBack={() => setView('play')} onSwitch={() => setView('select')} onLeaderboard={() => setView('leaderboard')} />
      break
    default:
      screen = (
        <PlayMenu
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
