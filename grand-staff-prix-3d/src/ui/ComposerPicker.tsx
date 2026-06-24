import { COMPOSERS } from '../data/composers'
import { useGame, activeProfile } from '../state/store'
import { AssetThumb } from './AssetThumb'

// Compact composer picker: small static avatar thumbnail + name, several per row.
export function ComposerPicker() {
  const composerId = useGame((s) => activeProfile(s)?.composerId ?? s.settings.composerId)
  const setComposer = useGame((s) => s.setComposer)
  return (
    <div className="pickRow">
      {COMPOSERS.map((c) => (
        <button
          key={c.id}
          className={`pickCard${composerId === c.id ? ' on' : ''}`}
          onClick={() => setComposer(c.id)}
          aria-label={c.name}
        >
          <span className="pickImg round">
            <AssetThumb src={`/thumbs/composer_${c.id}.png`} alt={c.name} />
          </span>
          <span className="pickName">{c.name}</span>
        </button>
      ))}
    </div>
  )
}
