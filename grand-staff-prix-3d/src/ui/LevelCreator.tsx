import { useState } from 'react'
import { useGame } from '../state/store'
import { candidateNoteNames, grandCandidateNames, type NoteMode } from '../data/notes'
import { TapStaff, type StaffKind } from './TapStaff'
import { Icon } from './icons'

const CLEF_OPTS: { id: StaffKind; glyph: string; label: string }[] = [
  { id: 'treble', glyph: String.fromCharCode(0xe050), label: 'Treble' },
  { id: 'bass', glyph: String.fromCharCode(0xe062), label: 'Bass' },
  { id: 'grand', glyph: String.fromCharCode(0xe050, 0xe062), label: 'Grand' },
]

// Students build their own practice level: pick a clef + the exact notes they
// want to drill, name it, and play it. Saved per device (always playable).
export function LevelCreator({ onClose }: { onClose: () => void }) {
  const addCustomLevel = useGame((s) => s.addCustomLevel)
  const [name, setName] = useState('')
  const [clef, setClef] = useState<StaffKind>('treble')
  const [mode, setMode] = useState<NoteMode>('name')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const candidates = clef === 'grand' ? grandCandidateNames() : candidateNoteNames(clef)
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
          <div className="clefRow">
            {CLEF_OPTS.map((o) => (
              <button
                key={o.id}
                className={`clefBtn${clef === o.id ? ' on' : ''}`}
                onClick={() => { setClef(o.id); setSelected(new Set()) }}
                aria-label={o.label}
              >
                <span className="clefGlyph">{o.glyph}</span>
                <span className="clefLabel">{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card sec">
          <div className="secLabel">Mode</div>
          <div className="modeRow">
            <button className={`modeBtn${mode === 'name' ? ' on' : ''}`} onClick={() => setMode('name')}>
              <span className="modeIcon" aria-hidden>
                <svg viewBox="0 0 46 30" width="46" height="30">
                  {[5, 11, 17, 23, 29].map((y) => (
                    <line key={y} x1="2" y1={y} x2="44" y2={y} stroke="currentColor" strokeWidth="1.3" />
                  ))}
                  <ellipse cx="30" cy="20" rx="5" ry="3.9" transform="rotate(-20 30 20)" fill="currentColor" />
                </svg>
              </span>
              <span className="modeLabel">Name the note</span>
              <span className="modeSub">see the note → name it</span>
            </button>
            <button className={`modeBtn${mode === 'find' ? ' on' : ''}`} onClick={() => setMode('find')}>
              <span className="modeIcon" aria-hidden>
                <span className="modeLetter">A</span>
              </span>
              <span className="modeLabel">Find the note</span>
              <span className="modeSub">see a letter → find it</span>
            </button>
          </div>
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
