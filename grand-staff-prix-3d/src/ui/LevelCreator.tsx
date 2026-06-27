import { useState } from 'react'
import { useGame } from '../state/store'
import { candidateNoteNames, grandCandidateNames, type NoteMode } from '../data/notes'
import { TapStaff, ClefIcon, type StaffKind } from './TapStaff'
import { Icon } from './icons'

const CLEF_OPTS: { id: StaffKind; label: string; optional?: boolean }[] = [
  { id: 'treble', label: 'Treble' },
  { id: 'bass', label: 'Bass' },
  { id: 'grand', label: 'Grand' },
  { id: 'alto', label: 'Alto', optional: true },
  { id: 'tenor', label: 'Tenor', optional: true },
]

// Mini staff-with-note icon for the "Name" mode button.
function NameIcon() {
  return (
    <svg viewBox="0 0 42 26" className="modeSvg" aria-hidden>
      {[3, 8, 13, 18, 23].map((y) => (
        <line key={y} x1="2" y1={y} x2="40" y2={y} stroke="currentColor" strokeWidth="1.2" />
      ))}
      <ellipse cx="28" cy="16" rx="4.6" ry="3.5" transform="rotate(-20 28 16)" fill="currentColor" />
    </svg>
  )
}

// Students build their own practice level: pick a clef + the exact notes, name
// it, and play it. Saved per device. Fits the viewport (no scroll).
export function LevelCreator({ onClose }: { onClose: () => void }) {
  const addCustomLevel = useGame((s) => s.addCustomLevel)
  const showCClefs = useGame((s) => s.settings.showCClefs)
  const [name, setName] = useState('')
  const [clef, setClef] = useState<StaffKind>('treble')
  const [mode, setMode] = useState<NoteMode>('mix')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const candidates = clef === 'grand' ? grandCandidateNames() : candidateNoteNames(clef)
  const setNote = (n: string, on: boolean) =>
    setSelected((prev) => {
      if (on === prev.has(n)) return prev
      const next = new Set(prev)
      if (on) next.add(n)
      else next.delete(n)
      return next
    })
  const canSave = name.trim().length > 0 && selected.size >= 2

  const save = () => {
    if (!canSave) return
    addCustomLevel(name.trim(), clef, candidates.filter((n) => selected.has(n)), mode)
    onClose()
  }

  return (
    <div className="overlay createOverlay">
      <div className="createSheet">
        <div className="createHead">
          <button className="backbtn" onClick={onClose}>{Icon.back} Back</button>
          <div className="createTitle">New Level</div>
          <input
            className="input createName"
            maxLength={20}
            placeholder="Level name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
        </div>

        <div className="createPickers">
        <div className="createBlock clefPick">
          <div className="miniLabel">Clef</div>
          <div className="clefRow">
            {CLEF_OPTS.filter((o) => !o.optional || showCClefs).map((o) => (
              <button
                key={o.id}
                className={`clefBtn${clef === o.id ? ' on' : ''}`}
                onClick={() => { setClef(o.id); setSelected(new Set()) }}
                aria-label={o.label}
              >
                <span className="clefIconWrap"><ClefIcon kind={o.id} /></span>
                <span className="clefLabel">{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="createBlock">
          <div className="miniLabel">Mode</div>
          <div className="modeRow">
            <button className={`modeBtn${mode === 'name' ? ' on' : ''}`} onClick={() => setMode('name')}>
              <span className="modeIcon" aria-hidden><NameIcon /></span>
              <span className="modeLabel">Name</span>
            </button>
            <button className={`modeBtn${mode === 'find' ? ' on' : ''}`} onClick={() => setMode('find')}>
              <span className="modeIcon" aria-hidden><span className="modeLetter">A</span></span>
              <span className="modeLabel">Find</span>
            </button>
            <button className={`modeBtn${mode === 'mix' ? ' on' : ''}`} onClick={() => setMode('mix')}>
              <span className="modeIcon" aria-hidden><span className="modeLetter">⇄</span></span>
              <span className="modeLabel">Mix</span>
            </button>
          </div>
        </div>
        </div>

        <div className="createStaffArea">
          <div className="miniLabel">Tap or drag the staff · {selected.size} chosen</div>
          <div className="tapStaffWrap">
            <TapStaff clef={clef} notes={candidates} selected={selected} onSet={setNote} />
          </div>
        </div>

        <div className="createActions">
          <button className="btn" disabled={!canSave} onClick={save}>
            {Icon.play} {!name.trim() ? 'Name your level' : selected.size < 2 ? 'Pick 2+ notes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
