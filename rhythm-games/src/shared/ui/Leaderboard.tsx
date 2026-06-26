import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { cloudEnabled, leaderboard, type CloudPlayer } from '../cloud'
import { rankForXp } from '../progression'
import { Button } from './Button'
import './Leaderboard.css'

/**
 * Class-code leaderboard. When cloud is configured, joins a class code and
 * shows the roster sorted by XP. When cloud is disabled, falls back to a LOCAL
 * leaderboard of the profiles on this device, so the panel is always useful.
 */
export function Leaderboard() {
  const profiles = useStore((s) => s.profiles)
  const classCode = useStore((s) => s.settings.classCode)
  const joinClass = useStore((s) => s.joinClass)

  const [codeInput, setCodeInput] = useState(classCode)
  const [rows, setRows] = useState<CloudPlayer[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (cloudEnabled && classCode) {
      setLoading(true)
      leaderboard(classCode).then((r) => {
        if (!cancelled) {
          setRows(r)
          setLoading(false)
        }
      })
    }
    return () => {
      cancelled = true
    }
  }, [classCode])

  // Local fallback list (also shown alongside when no class joined).
  const local = [...profiles].sort((a, b) => b.xp - a.xp)
  const useCloud = cloudEnabled && !!classCode
  const list = useCloud
    ? rows.map((r) => ({ id: r.id, name: r.name, xp: Number(r.data?.xp ?? 0), gems: Number(r.data?.gems ?? 0) }))
    : local.map((p) => ({ id: p.id, name: p.name, xp: p.xp, gems: p.gems }))

  return (
    <div className="rg-lb">
      <div className="rg-lb__head">
        <h2 className="rg-lb__title">Leaderboard</h2>
        <p className="rg-lb__sub">
          {cloudEnabled
            ? 'Join a class code to compete with classmates across all three games.'
            : 'Local ranking on this device. (Add Supabase keys to enable class-wide cloud boards.)'}
        </p>
      </div>

      {cloudEnabled && (
        <div className="rg-lb__join">
          <input
            className="rg-lb__input"
            placeholder="CLASS CODE"
            value={codeInput}
            maxLength={12}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && joinClass(codeInput)}
          />
          <Button size="sm" onClick={() => joinClass(codeInput)}>
            {classCode ? 'Switch' : 'Join'}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="rg-lb__loading">Loading…</div>
      ) : list.length === 0 ? (
        <div className="rg-lb__empty">No players ranked yet.</div>
      ) : (
        <ol className="rg-lb__list">
          {list.map((p, i) => (
            <li key={p.id} className={`rg-lb__row ${i < 3 ? `rg-lb__row--top${i + 1}` : ''}`}>
              <span className="rg-lb__pos">{i + 1}</span>
              <span className="rg-lb__name">{p.name}</span>
              <span className="rg-lb__rankname">{rankForXp(p.xp).name}</span>
              <span className="rg-lb__xp">{p.xp.toLocaleString()} XP</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
