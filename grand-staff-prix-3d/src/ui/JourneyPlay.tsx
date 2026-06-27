import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGame, activeProfile } from '../state/store'
import { NOTE_SETS, type NoteSet, type Difficulty } from '../data/notes'
import { CARS, carById } from '../data/cars'
import { COMPOSERS, composerById } from '../data/composers'
import { THEMES } from '../data/themes'
import { rankForXp } from '../data/progression'
import { Icon } from './icons'

const CLEF_GLYPH: Record<string, string> = {
  treble: String.fromCharCode(0xe050),
  bass: String.fromCharCode(0xe062),
  grand: String.fromCharCode(0xe050, 0xe062),
  alto: String.fromCharCode(0xe05c),
  tenor: String.fromCharCode(0xe05c),
}
const CLEF_COLOR: Record<string, string> = {
  treble: '#4aa3ff',
  bass: '#34cf8e',
  grand: '#b07cff',
  alto: '#ff9a4a',
  tenor: '#ffcf4a',
}
const BAND_ORDER: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 }
const GROUP_ORDER: Record<string, number> = { treble: 0, bass: 1, grand: 2, alto: 3, tenor: 4 }
const BAND_LABEL: Record<Difficulty, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

function shortName(s: NoteSet): string {
  const n = s.name
  if (n.includes('Middle C')) return 'Middle C'
  if (n === 'C Position') return 'C Pos'
  if (n === 'G Position') return 'G Pos'
  if (n.includes('Ledger')) return 'Ledgers'
  if (n.includes('Staff')) return 'Staff'
  if (n.includes('Basics')) return 'Basics'
  return n
}

// Smooth (Catmull-Rom → cubic bezier) path through the node centres = a flowing road.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? pts[i + 1]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

export function JourneyPlay() {
  const profile = useGame(activeProfile)
  const settings = useGame((s) => s.settings)
  const setLevel = useGame((s) => s.setLevel)
  const startGame = useGame((s) => s.startGame)
  const setCar = useGame((s) => s.setCar)
  const setComposer = useGame((s) => s.setComposer)
  const setTheme = useGame((s) => s.setTheme)

  const unlocked = new Set(profile?.unlocked ?? [])
  const mastered = new Set(profile?.mastered ?? [])
  const rank = rankForXp(profile?.xp ?? 0)

  const carId = profile?.carId ?? settings.carId
  const composerId = profile?.composerId ?? settings.composerId
  const car = carById(carId)
  const composer = composerById(composerId)
  const theme = THEMES.find((t) => t.id === settings.themeId) ?? THEMES[0]

  const cycle = <T,>(arr: T[], cur: T, set: (v: T) => void) => () => set(arr[(arr.indexOf(cur) + 1) % arr.length])

  const levels = useMemo(() => {
    const visible = NOTE_SETS.filter((s) => settings.showCClefs || (s.group !== 'alto' && s.group !== 'tenor'))
    return [...visible].sort(
      (a, b) =>
        BAND_ORDER[a.band ?? 'beginner'] - BAND_ORDER[b.band ?? 'beginner'] ||
        (GROUP_ORDER[a.group ?? 'treble'] - GROUP_ORDER[b.group ?? 'treble']) ||
        (a.tier ?? 0) - (b.tier ?? 0),
    )
  }, [settings.showCClefs])

  // measure width so road (SVG) and nodes (HTML) share one pixel coordinate space
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(380)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ROW = 96
  const TOP = 70
  const PAD = 52
  const amp = Math.max(40, w / 2 - PAD)
  const nodes = levels.map((lvl, i) => ({
    lvl,
    x: w / 2 + amp * Math.sin(i * 1.08 + 0.6),
    y: TOP + i * ROW,
  }))
  const totalH = TOP + (levels.length - 1) * ROW + 80
  const road = smoothPath(nodes.map((n) => ({ x: n.x, y: n.y })))

  // difficulty zone bands (y-ranges) for tinted backgrounds + banners
  const bands = (['beginner', 'intermediate', 'advanced'] as Difficulty[])
    .map((b) => {
      const ys = nodes.filter((n) => n.lvl.band === b).map((n) => n.y)
      if (!ys.length) return null
      return { band: b, top: Math.min(...ys) - ROW * 0.58, bot: Math.max(...ys) + ROW * 0.42 }
    })
    .filter(Boolean) as { band: Difficulty; top: number; bot: number }[]

  const selected = settings.levelId
  const selLevel = NOTE_SETS.find((s) => s.id === selected) ?? levels[0]

  // scroll the selected (or next unlocked) node into view on mount
  useEffect(() => {
    const idx = nodes.findIndex((n) => n.lvl.id === selected)
    const target = idx >= 0 ? nodes[idx].y : 0
    if (scrollRef.current && target) scrollRef.current.scrollTop = Math.max(0, target - 180)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w])

  const tint: Record<Difficulty, string> = {
    beginner: 'rgba(52,207,142,0.07)',
    intermediate: 'rgba(255,154,74,0.07)',
    advanced: 'rgba(176,124,255,0.08)',
  }
  const tintTx: Record<Difficulty, string> = { beginner: '#5fd6a0', intermediate: '#ffb070', advanced: '#c4a6ff' }

  return (
    <div className="jp">
      <div className="jpHead">
        <button className="jpAvatar">{(profile?.name ?? 'P')[0].toUpperCase()}</button>
        <div className="jpRank">
          <b>{rank.name}</b>
          <span>{profile?.xp ?? 0} XP</span>
        </div>
        <div className="jpGems">💎 {profile?.gems ?? 0}</div>
      </div>

      <div className="jpScroll" ref={scrollRef}>
        <div className="jpMap" ref={wrapRef} style={{ height: totalH }}>
          <svg className="jpRoad" width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`}>
            {bands.map((b) => (
              <rect key={b.band} x="0" y={b.top} width={w} height={b.bot - b.top} fill={tint[b.band]} />
            ))}
            <path d={road} className="roadEdge" />
            <path d={road} className="roadInk" />
            <path d={road} className="roadDash" />
          </svg>

          {bands.map((b) => (
            <div key={b.band} className="jpBanner" style={{ top: b.top + 8, color: tintTx[b.band] }}>
              {BAND_LABEL[b.band]}
            </div>
          ))}

          {nodes.map((n) => {
            const id = n.lvl.id
            const g = n.lvl.group ?? 'treble'
            const open = n.lvl.tier === 1 || unlocked.has(id)
            const done = mastered.has(id)
            const sel = id === selected
            const color = CLEF_COLOR[g]
            return (
              <div key={id}>
                {sel && <div className="jpSelRing" style={{ left: n.x, top: n.y, boxShadow: `0 0 0 4px ${color}, 0 0 22px 4px ${color}88` }} />}
                <button
                  className={`jpNode${open ? '' : ' locked'}${n.lvl.group === 'grand' ? ' grand' : ''}${sel ? ' sel' : ''}`}
                  style={{ left: n.x, top: n.y, background: open ? `radial-gradient(circle at 36% 30%, ${color}, ${color}cc 60%, ${color}99)` : undefined }}
                  disabled={!open}
                  onClick={() => open && setLevel(id)}
                  aria-label={n.lvl.name}
                >
                  <span className="jpGlyph">{CLEF_GLYPH[g]}</span>
                  {done && <span className="jpStar">★</span>}
                  {!open && <span className="jpLock">{Icon.lock}</span>}
                </button>
                <div className={`jpLabel${open ? '' : ' dim'}`} style={{ left: n.x, top: n.y + 32 }}>
                  {shortName(n.lvl)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="jpDock">
        <div className="jpGarage">
          <button className="jpChip" onClick={cycle(CARS.map((c) => c.id), carId, setCar)}>
            <img src={`/thumbs/car_${carId}.png`} alt="" /><span>{car.name}</span>
          </button>
          <button className="jpChip" onClick={cycle(COMPOSERS.map((c) => c.id), composerId, setComposer)}>
            <img src={`/thumbs/composer_${composerId}.png`} alt="" /><span>{composer.name}</span>
          </button>
          <button className="jpChip" onClick={cycle(THEMES.map((t) => t.id), settings.themeId, setTheme)}>
            <span className="jpSwatch" style={{ background: `linear-gradient(120deg, ${theme.skyTop}, ${theme.ground})` }} /><span>{theme.name}</span>
          </button>
        </div>
        <div className="jpStartRow">
          <div className="jpSel">
            <span className="jpSelClef">{CLEF_GLYPH[selLevel.group ?? 'treble']}</span>
            <div>
              <div className="jpSelName">{selLevel.name}</div>
              <div className="jpSelSub">{BAND_LABEL[selLevel.band ?? 'beginner']} · {selLevel.blurb}</div>
            </div>
            {mastered.has(selLevel.id) && <span className="jpSelStar">★</span>}
          </div>
          <button className="jpStart" onClick={startGame}>{Icon.play} START</button>
        </div>
      </div>
    </div>
  )
}
