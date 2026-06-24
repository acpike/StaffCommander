import { COMPOSERS } from '../data/composers'
import { useGame, activeProfile } from '../state/store'
import { useThumbnails, type ThumbItem } from './useThumbnails'
import { AssetThumb } from './AssetThumb'

const ITEMS: ThumbItem[] = COMPOSERS.map((c) => ({ id: c.id, model: c.model, rotationY: c.rotationY, kind: 'bust' }))

// Compact composer picker: small static avatar thumbnail + name, several per row.
export function ComposerPicker() {
  const composerId = useGame((s) => activeProfile(s)?.composerId ?? s.settings.composerId)
  const setComposer = useGame((s) => s.setComposer)
  const thumbs = useThumbnails(ITEMS, 256)
  return (
    <div className="composerThumbs">
      {COMPOSERS.map((c) => (
        <button
          key={c.id}
          className={`composerThumb${composerId === c.id ? ' on' : ''}`}
          onClick={() => setComposer(c.id)}
          aria-label={c.name}
        >
          <span className="composerAvatar">
            <AssetThumb src={`/thumbs/composer_${c.id}.png`} fallback={thumbs[c.id]} alt={c.name} />
          </span>
          <span className="composerName">{c.name}</span>
        </button>
      ))}
    </div>
  )
}
