import { useState } from 'react'
import { useGame } from '../state/store'
import { candidateNoteNames, type Clef } from '../data/notes'
import { Icon } from './icons'

// Students build their own practice level: pick a clef + the exact notes they
// want to drill, name it, and play it. Saved per device (always playable).
export function LevelCreator({ onClose }: { onClose: () => void }) {
  const addCustomLevel = useGame((s) => s.addCustomLevel)
  const [name, setName] = useState('')
  const [clef, setClef] = useState<Clef>('treble')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const candidates = candidateNoteNames(clef)
  const toggle = (n: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  const canSave = selected.size >= 2

  const save = () => {
    if (!canSave) return
    addCustomLevel(name, clef, candidates.filter((n) => selected.has(n)))
    onClose()
  }

  return (
    <div className="overlay">
      <div className="sheet">
        <div className="hero">
          <div className="eyebrow">Create a Level</div>
          <h1 style={{ fontSize: 'clamp(34px,11vw,48px)' }}>
            CUSTOM <span className="x">NOTES</span>
          </h1>
        </div>

        <div className="card sec">
          <div className="secLabel">Level name</div>
          <input
            className="input"
            maxLength={20}
            placeholder="e.g. My tricky notes"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="card sec">
          <div className="secLabel">Clef</div>
          <div className="seg">
            <button className={clef === 'treble' ? 'on' : ''} onClick={() => { setClef('treble'); setSelected(new Set()) }}>
              Treble
            </button>
            <button className={clef === 'bass' ? 'on' : ''} onClick={() => { setClef('bass'); setSelected(new Set()) }}>
              Bass
            </button>
          </div>
        </div>

        <div className="card sec">
          <div className="secLabel">Pick notes to practice · {selected.size} chosen</div>
          <div className="noteGrid">
            {candidates.map((n) => (
              <button key={n} className={`noteChip${selected.has(n) ? ' on' : ''}`} onClick={() => toggle(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="startWrap">
          <button className="btn" disabled={!canSave} onClick={save}>
            {Icon.play} {canSave ? 'Create Level' : 'Pick at least 2 notes'}
          </button>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
