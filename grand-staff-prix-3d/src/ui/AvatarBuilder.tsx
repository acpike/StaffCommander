import { useState } from 'react'
import {
  FACE_SHAPES,
  SKIN_TONES,
  HAIR_STYLES,
  HAIR_COLORS,
  EYE_COLORS,
  OUTFITS,
  OUTFIT_COLORS,
  ACCENT_COLORS,
  randomAvatar,
  type AvatarConfig,
} from '../data/avatars'
import { AvatarPreview3D } from './AvatarPreview3D'
import { Icon } from './icons'

// A real character customizer: a live 3D preview on the left and tabbed,
// grouped controls on the right. Fully controlled — every pick calls onChange
// with the next config so the preview (and any wired car) updates instantly.

type Tab = 'face' | 'hair' | 'eyes' | 'outfit'

const TABS: { id: Tab; label: string }[] = [
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'outfit', label: 'Outfit' },
]

function OptionRow<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string
  options: { id: T; name: string }[]
  value: T
  onPick: (id: T) => void
}) {
  return (
    <div className="abGroup">
      <div className="abGroupLabel">{label}</div>
      <div className="abOptions">
        {options.map((o) => (
          <button
            key={o.id}
            className={`abOption${value === o.id ? ' on' : ''}`}
            onClick={() => onPick(o.id)}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function SwatchRow({
  label,
  swatches,
  value,
  onPick,
}: {
  label: string
  swatches: { id: string; name: string; hex: string }[]
  value: string
  onPick: (hex: string) => void
}) {
  return (
    <div className="abGroup">
      <div className="abGroupLabel">{label}</div>
      <div className="abSwatches">
        {swatches.map((s) => (
          <button
            key={s.id}
            className={`abSwatch${value.toLowerCase() === s.hex.toLowerCase() ? ' on' : ''}`}
            style={{ background: s.hex }}
            onClick={() => onPick(s.hex)}
            aria-label={s.name}
            title={s.name}
          />
        ))}
      </div>
    </div>
  )
}

export function AvatarBuilder({
  value,
  onChange,
  onSave,
  onCancel,
  title = 'Build your driver',
  saveLabel = 'Save',
}: {
  value: AvatarConfig
  onChange: (next: AvatarConfig) => void
  onSave: () => void
  onCancel: () => void
  title?: string
  saveLabel?: string
}) {
  const [tab, setTab] = useState<Tab>('face')
  const set = (patch: Partial<AvatarConfig>) => onChange({ ...value, ...patch })

  return (
    <div className="abOverlay">
      <div className="abPanel">
        <div className="abHead">
          <div className="abTitle">{title}</div>
          <button className="abRandom" onClick={() => onChange(randomAvatar())}>
            Randomize
          </button>
        </div>

        <div className="abBody">
          {/* live preview */}
          <div className="abPreview">
            <AvatarPreview3D config={value} />
          </div>

          {/* controls */}
          <div className="abControls">
            <div className="abTabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={`abTab${tab === t.id ? ' on' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="abScroll">
              {tab === 'face' && (
                <>
                  <OptionRow
                    label="Face shape"
                    options={FACE_SHAPES}
                    value={value.faceShape}
                    onPick={(faceShape) => set({ faceShape })}
                  />
                  <SwatchRow
                    label="Skin tone"
                    swatches={SKIN_TONES}
                    value={value.skinTone}
                    onPick={(skinTone) => set({ skinTone })}
                  />
                </>
              )}

              {tab === 'hair' && (
                <>
                  <OptionRow
                    label="Hair style"
                    options={HAIR_STYLES}
                    value={value.hairStyle}
                    onPick={(hairStyle) => set({ hairStyle })}
                  />
                  <SwatchRow
                    label="Hair color"
                    swatches={HAIR_COLORS}
                    value={value.hairColor}
                    onPick={(hairColor) => set({ hairColor })}
                  />
                </>
              )}

              {tab === 'eyes' && (
                <SwatchRow
                  label="Eye color"
                  swatches={EYE_COLORS}
                  value={value.eyeColor}
                  onPick={(eyeColor) => set({ eyeColor })}
                />
              )}

              {tab === 'outfit' && (
                <>
                  <OptionRow
                    label="Outfit"
                    options={OUTFITS}
                    value={value.outfit}
                    onPick={(outfit) => set({ outfit })}
                  />
                  <SwatchRow
                    label="Outfit color"
                    swatches={OUTFIT_COLORS}
                    value={value.outfitColor}
                    onPick={(outfitColor) => set({ outfitColor })}
                  />
                  <SwatchRow
                    label="Accent"
                    swatches={ACCENT_COLORS}
                    value={value.accent}
                    onPick={(accent) => set({ accent })}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="abFoot">
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn" onClick={onSave}>
            {Icon.play} {saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
