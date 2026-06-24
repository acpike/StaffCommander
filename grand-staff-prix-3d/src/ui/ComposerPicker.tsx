import { COMPOSERS } from '../data/composers'
import { useGame } from '../state/store'
import { useThumbnails, type ThumbItem } from './useThumbnails'

const ITEMS: ThumbItem[] = COMPOSERS.map((c) => ({ id: c.id, model: c.model, rotationY: c.rotationY, kind: 'bust' }))

// Compact composer picker: small static avatar thumbnail + name, several per row.
export function ComposerPicker() {
  const composerId = useGame((s) => s.settings.composerId)
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
            {thumbs[c.id] ? <img src={thumbs[c.id]} alt={c.name} /> : <span className="thumbSpin" />}
          </span>
          <span className="composerName">{c.name}</span>
        </button>
      ))}
    </div>
  )
}
