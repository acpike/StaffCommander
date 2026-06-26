// The GameModule contract. Each game folder (games/echo, games/detective,
// games/builder) provides:
//   - a default-exported React component (the game itself), and
//   - a named `meta: GameMeta` export.
// App.tsx imports the three, renders a card per `meta`, and mounts the component
// when its card is chosen.
//
// The game component receives an `onExit` callback to return to the menu. It
// reads the shared store (useStore) for the active profile and calls
// `recordRun(meta.id, result)` when a run finishes.

import type { ComponentType } from 'react'
import type { GameId } from './store'

export interface GameMeta {
  /** Stable id — also the key into per-game progress in the store. */
  id: GameId
  /** Display title, e.g. "Echo". */
  title: string
  /** One-line hook shown on the menu card. */
  tagline: string
  /** A longer description (optional, for the card back / tooltip). */
  description?: string
  /** Primary accent color (CSS), themes the card + in-game chrome. */
  accent: string
  /** Secondary accent for gradients (optional). */
  accent2?: string
  /** Emoji / glyph icon for the card. */
  icon: string
}

/** Props every game component receives from the shell. */
export interface GameProps {
  /** Return to the landing menu. */
  onExit: () => void
}

/** The shape a game folder's module conforms to. */
export interface GameModule {
  meta: GameMeta
  Component: ComponentType<GameProps>
}
