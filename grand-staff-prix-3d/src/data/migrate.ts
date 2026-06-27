// ──────────────────────────────────────────────────────────────────────────
// Levels Rework — Phase A migration. Old profiles keyed their progress (best /
// unlocked / mastered / mastery / lastPlayed) by the PRE-rework level ids
// (`treble-1`, `bass-3`, `grand-5`, …). Those ids no longer exist as Learning-Mode
// stages, so on load we re-key them onto the nearest new journey stage. This is
// non-destructive: already-current ids and custom (`cl-*`) levels pass through
// unchanged, so running it repeatedly is idempotent.
// ──────────────────────────────────────────────────────────────────────────

import { NOTE_SETS, JOURNEY_STAGES } from './notes'

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

/** Tier of a journey stage id (1…21), or 0 if it isn't a journey stage. */
function journeyTier(id: string): number {
  return JOURNEY_STAGES.find((s) => s.id === id)?.tier ?? 0
}

/**
 * Make the Learning-Mode journey unlock/mastery chain GAP-FREE after a re-key.
 *
 * The legacy map (LEGACY_ID_MAP) is NOT onto a contiguous tier prefix: e.g.
 * `treble-1` → r1-name but `treble-2` → r2-name (skipping r1-find/r1-mix), and
 * `treble-5`/`grand-5` leap to r5-mix over r3/r4. So a migrated profile can end
 * up with a MASTERED or UNLOCKED stage floating above LOCKED ones. The Journey UI
 * (Menu.tsx) defines the "you are here" current stage as the FIRST
 * unlocked-but-unmastered stage in tier order — so a gap makes it skip past the
 * locked hole and point the student at a far-future stage (a treble graduate was
 * landing on `r5-mix`, ±1 Ledger Mix, with r3/r4 locked beneath it).
 *
 * Fix: backfill the linear chain. Everything up to the highest MASTERED journey
 * tier becomes mastered (and unlocked); everything up to the highest UNLOCKED
 * tier — plus the one stage right after the mastered frontier (the natural
 * "current") — becomes unlocked. This mirrors `store.placeProfileForStage`, so a
 * migrated profile lands in the same coherent shape placement produces.
 *
 * PURE · additive (never demotes, so no progress is lost) · idempotent. Never
 * grants mastery ABOVE the migration map's own ceiling — it only fills the holes
 * below it, so it stays as conservative as the (already conservative) map.
 */
function backfillJourneyChain<P extends { unlocked: string[]; mastered: string[] }>(p: P): P {
  let maxMastered = 0
  for (const id of p.mastered) maxMastered = Math.max(maxMastered, journeyTier(id))
  let maxUnlocked = 0
  for (const id of p.unlocked) maxUnlocked = Math.max(maxUnlocked, journeyTier(id))
  if (maxMastered === 0 && maxUnlocked === 0) return p // no journey progress to backfill
  const mastered = new Set(p.mastered)
  const unlocked = new Set(p.unlocked)
  for (const s of JOURNEY_STAGES) {
    const t = s.tier ?? 0
    if (t === 0) continue
    if (t <= maxMastered) {
      mastered.add(s.id)
      unlocked.add(s.id)
    }
    if (t <= maxUnlocked || t === maxMastered + 1) unlocked.add(s.id)
  }
  return { ...p, mastered: Array.from(mastered), unlocked: Array.from(unlocked) }
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
  const remapped = {
    ...p,
    best: migrateRecord(p.best ?? {}),
    unlocked: migrateIdList(p.unlocked ?? []),
    mastered: migrateIdList(p.mastered ?? []),
    mastery: migrateRecord(p.mastery ?? {}),
    lastPlayed: migrateRecord(p.lastPlayed ?? {}),
  }
  // Re-keying alone can leave the journey chain with holes (the legacy map isn't a
  // contiguous prefix) — backfill so unlocked/mastered form a gap-free chain.
  return backfillJourneyChain(remapped)
}
