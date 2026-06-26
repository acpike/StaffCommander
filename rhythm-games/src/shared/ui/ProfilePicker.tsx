import { useState } from 'react'
import { useStore } from '../store'
import { rankForXp } from '../progression'
import { Button } from './Button'
import './ProfilePicker.css'

interface Props {
  /** Called after a profile is selected/created (e.g. close the picker). */
  onDone?: () => void
}

/** Add / select / remove the shared player profile. */
export function ProfilePicker({ onDone }: Props) {
  const profiles = useStore((s) => s.profiles)
  const currentId = useStore((s) => s.currentId)
  const addProfile = useStore((s) => s.addProfile)
  const selectProfile = useStore((s) => s.selectProfile)
  const removeProfile = useStore((s) => s.removeProfile)

  const [name, setName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const create = () => {
    if (!name.trim()) return
    addProfile(name)
    setName('')
    onDone?.()
  }

  return (
    <div className="rg-pp">
      <div className="rg-pp__head">
        <h2 className="rg-pp__title">Who's playing?</h2>
        <p className="rg-pp__sub">One profile carries your XP, gems &amp; rank across all three games.</p>
      </div>

      <div className="rg-pp__list">
        {profiles.map((p) => {
          const rank = rankForXp(p.xp)
          const active = p.id === currentId
          return (
            <div key={p.id} className={`rg-pp__card ${active ? 'is-active' : ''}`}>
              <button
                className="rg-pp__select"
                onClick={() => {
                  selectProfile(p.id)
                  onDone?.()
                }}
              >
                <span className="rg-pp__avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="rg-pp__meta">
                  <span className="rg-pp__name">{p.name}</span>
                  <span className="rg-pp__rank">
                    {rank.name} · {p.xp.toLocaleString()} XP · ◆ {p.gems}
                  </span>
                </span>
                {active && <span className="rg-pp__check">✓</span>}
              </button>
              {confirmId === p.id ? (
                <div className="rg-pp__confirm">
                  <button className="rg-pp__del" onClick={() => removeProfile(p.id)}>
                    Delete
                  </button>
                  <button className="rg-pp__cancel" onClick={() => setConfirmId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="rg-pp__remove" aria-label={`Remove ${p.name}`} onClick={() => setConfirmId(p.id)}>
                  ✕
                </button>
              )}
            </div>
          )
        })}
        {profiles.length === 0 && <div className="rg-pp__empty">No players yet — create one below.</div>}
      </div>

      <div className="rg-pp__add">
        <input
          className="rg-pp__input"
          placeholder="New player name"
          value={name}
          maxLength={14}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <Button onClick={create} disabled={!name.trim()} icon={<span>+</span>}>
          Create
        </Button>
      </div>
    </div>
  )
}
