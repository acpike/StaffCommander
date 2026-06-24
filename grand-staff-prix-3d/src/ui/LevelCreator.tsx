import { useState } from 'react'
import { useGame } from '../state/store'
import { candidateNoteNames, type Clef, type NoteMode } from '../data/notes'
import { TapStaff } from './TapStaff'
import { Icon } from './icons'

// Students build their own practice level: pick a clef + the exact notes they
// want to drill, name it, and play it. Saved per device (always playable).
export function LevelCreator({ onClose }: { onClose: () => void }) {
  const addCustomLevel = useGame((s) => s.addCustomLevel)
  const [name, setName] = useState('')
  const [clef, setClef] = useState<Clef>('treble')
  const [mode, setMode] = useState<NoteMode>('name')
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
    addCustomLevel(name, clef, candidates.filter((n) => selected.has(n)), mode)
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
          <div className="secLabel">Mode</div>
          <div className="seg">
            <button className={mode === 'name' ? 'on' : ''} onClick={() => setMode('name')}>
              Name the note
            </button>
            <button className={mode === 'find' ? 'on' : ''} onClick={() => setMode('find')}>
              Find the note
            </button>
          </div>
          <p className="tiny" style={{ marginTop: 2 }}>
            {mode === 'name'
              ? 'Staff shows a note; steer into the block with its letter.'
              : 'A letter shows; steer into the block whose staff matches it.'}
          </p>
        </div>

        <div className="card sec">
          <div className="secLabel">Tap the staff to pick notes · {selected.size} chosen</div>
          <div className="tapStaffWrap">
            <TapStaff clef={clef} notes={candidates} selected={selected} onToggle={toggle} />
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
