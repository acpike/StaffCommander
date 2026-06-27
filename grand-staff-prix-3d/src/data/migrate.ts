// ──────────────────────────────────────────────────────────────────────────
// Levels Rework — Phase A migration. Old profiles keyed their progress (best /
// unlocked / mastered / mastery / lastPlayed) by the PRE-rework level ids
// (`treble-1`, `bass-3`, `grand-5`, …). Those ids no longer exist as Learning-Mode
// stages, so on load we re-key them onto the nearest new journey stage. This is
// non-destructive: already-current ids and custom (`cl-*`) levels pass through
// unchanged, so running it repeatedly is idempotent.
// ──────────────────────────────────────────────────────────────────────────

import { NOTE_SETS } from './notes'

/** Old (pre-rework) level id → nearest new Learning-Mode stage id. Anything not
 *  listed (and not already valid / custom) falls back to Region 1 · Name. */
export const LEGACY_ID_MAP: Record<string, string> = {
  // Treble track → its journey equivalents.
  'treble-1': 'r1-name', // Middle C steps      → Middle C · Name
  'treble-2': 'r2-name', // Treble G position   → Treble · Name
  'treble-3': 'r2-find', // Find C position     → Treble · Find
  'treble-4': 'r2-mix', //  Whole treble staff  → Treble · Mix
  'treble-5': 'r5-mix', //  Treble + ledgers    → ±1 Ledger · Mix
  // Bass track.
  'bass-1': 'r1-name', // Middle C steps (down)  → Middle C · Name
  'bass-2': 'r3-name', // Bass C position        → Bass Reach · Name
  'bass-3': 'r3-find', // Find bass C position   → Bass Reach · Find
  'bass-4': 'r4-mix', //  Whole bass staff       → Wider Range · Mix
  'bass-5': 'r5-mix', //  Bass + ledgers         → ±1 Ledger · Mix
  // Grand staff track (already grand staff — the closest fits).
  'grand-1': 'r1-name', // Grand middle C        → Middle C · Name
  'grand-2': 'r3-name', // Grand positions       → Bass Reach · Name
  'grand-3': 'r3-find', // Find grand            → Bass Reach · Find
  'grand-4': 'r4-mix', //  Whole grand staff     → Wider Range · Mix
  'grand-5': 'r5-mix', //  Grand + ledgers       → ±1 Ledger · Mix
  // Optional C-clef tracks — all sit around middle C → Region 1.
  'alto-1': 'r1-name',
  'alto-2': 'r1-find',
  'alto-3': 'r1-mix',
  'tenor-1': 'r1-name',
  'tenor-2': 'r1-find',
  'tenor-3': 'r1-mix',
}

const DEFAULT_STAGE = 'r1-name'
const isCurrentId = (id: string) => NOTE_SETS.some((s) => s.id === id)

/** Map one (possibly legacy) level id to a current stage id. */
export function migrateLevelId(id: string): string {
  if (isCurrentId(id)) return id // journey + side-quest ids already current
  if (id.startsWith('cl-')) return id // custom levels live outside NOTE_SETS — leave them
  return LEGACY_ID_MAP[id] ?? DEFAULT_STAGE
}

/** Re-key a list of level ids, de-duplicating any that now collide. */
export function migrateIdList(ids: string[]): string[] {
  return Array.from(new Set(ids.map(migrateLevelId)))
}

/** Re-key a `Record<levelId, value>`, keeping the BETTER value on a collision.
 *  Numbers (best score / ladder meter) keep the larger; date strings keep the
 *  later (YYYY-MM-DD compares lexicographically). */
function migrateRecord<T extends number | string>(rec: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {}
  for (const k in rec) {
    const nk = migrateLevelId(k)
    const v = rec[k]
    if (!(nk in out) || v > out[nk]) out[nk] = v
  }
  return out
}

/** The subset of a profile keyed by level id — everything the rework re-keys. */
export interface MigratableProfile {
  best: Record<string, number>
  unlocked: string[]
  mastered: string[]
  mastery: Record<string, number>
  lastPlayed: Record<string, string>
}

/** Return a copy of `p` with every level-id-keyed field migrated onto the new
 *  stage ids. Non-destructive and idempotent. */
export function migrateProfileIds<P extends MigratableProfile>(p: P): P {
  return {
    ...p,
    best: migrateRecord(p.best ?? {}),
    unlocked: migrateIdList(p.unlocked ?? []),
    mastered: migrateIdList(p.mastered ?? []),
    mastery: migrateRecord(p.mastery ?? {}),
    lastPlayed: migrateRecord(p.lastPlayed ?? {}),
  }
}
