// Shared Zustand store for the whole rhythm-games suite. ONE profile per player
// carries xp + gems + achievements + PER-GAME progress (unlocked levels, best
// scores, mastery) keyed by gameId — so a student has a single identity, XP, and
// leaderboard across Echo, Rhythm Detective, and Beat Builder.
//
// Adapted from grand-staff-prix-3d/src/state/store.ts (same localStorage-keys
// spirit, same mastery/gems/achievements feel), generalized to multiple games.
// No middleware — explicit persistence, for clarity, matching the flagship.

import { create } from 'zustand'
import { cloudEnabled, fetchPlayers, insertPlayer, updatePlayer, deletePlayer } from './cloud'
import {
  gemsForRun,
  checkAchievements,
  dailyChallenges,
  todayKey,
  rankForXp,
  MASTERY_XP_BONUS,
  START_LIVES,
  type RankInfo,
} from './progression'

// ── localStorage keys (namespaced for this app) ────────────────────────────
const LS_PROFILES = 'rg.profiles'
const LS_CURRENT = 'rg.current'
const LS_SETTINGS = 'rg.settings'
const LS_DAILY = 'rg.daily'

export { START_LIVES }

/** The three game modules. Kept as a string so the store stays game-agnostic. */
export type GameId = 'echo' | 'detective' | 'builder'
export const GAME_IDS: GameId[] = ['echo', 'detective', 'builder']

/** Per-game progress for one profile. */
export interface GameProgress {
  /** Best score per level id within this game. */
  best: Record<string, number>
  /** Unlocked level ids in this game. */
  unlocked: string[]
  /** Level ids the player has MASTERED (the unlock gate) in this game. */
  mastered: string[]
  /** Total runs played in this game. */
  plays: number
  /** Highest score ever in this game (any level). */
  highScore: number
}

function freshGameProgress(): GameProgress {
  return { best: {}, unlocked: [], mastered: [], plays: 0, highScore: 0 }
}

export interface Profile {
  id: string
  name: string
  /** Shared XP across all games (drives rank). */
  xp: number
  /** Shared gem currency across all games. */
  gems: number
  /** Unlocked achievement ids (suite-wide). */
  achievements: string[]
  /** Per-game progress, keyed by GameId. */
  games: Record<string, GameProgress>
}

export interface DailyState {
  date: string
  progress: Record<string, number>
  done: string[]
}

interface Settings {
  /** Class code grouping players for cloud sync + leaderboard (empty = local). */
  classCode: string
  /** Master volume 0..1. */
  volume: number
  /**
   * Beat-grid ("Show beat lines") preference. Tri-state so a per-level default
   * can still apply when the user hasn't expressed a preference:
   *  - 'auto' (default): follow each level's `scaffold.beatGrid`.
   *  - 'on' / 'off': user override that wins over the level default.
   * Additive + backward-compatible (older saved settings simply lack it).
   */
  beatLines: 'auto' | 'on' | 'off'
}

const DEFAULT_SETTINGS: Settings = { classCode: '', volume: 0.9, beatLines: 'auto' }

// ── The result a game passes to recordRun, and what it gets back ────────────

/** What a finished run reports to the store. Games fill what's relevant. */
export interface RunResult {
  /** Level id played within the game. */
  levelId?: string
  /** Final score for the run. */
  score: number
  /** 0..1 onset accuracy. */
  accuracy: number
  /** Notes / taps judged this run (for XP + achievements). */
  notes: number
  /** Did the player master `levelId` this run? */
  mastered?: boolean
  /** The next level id to unlock when mastered (game decides progression). */
  unlockNext?: string | null
  /** Best streak reached this run. */
  bestStreak?: number
  /** Stage / tier reached this run. */
  stageReached?: number
  /** Wrong / missed judgments this run. */
  wrong?: number
}

/** What recordRun returns so the GameOver UI can celebrate. */
export interface RunOutcome {
  xpGained: number
  gemsGained: number
  /** Achievement ids newly unlocked this run. */
  newAchievements: string[]
  /** True if the player crossed into a new rank this run. */
  leveledUp: boolean
  /** Rank info AFTER the run. */
  rank: RankInfo
  /** True if a level was mastered this run. */
  masteredNow: boolean
  /** Level id unlocked this run (or null). */
  unlockedLevel: string | null
  /** New best score for this level (true if the run beat the prior best). */
  newBest: boolean
  /** Gems earned specifically from daily-challenge completions this run. */
  dailyGems: number
}

// ── Persistence helpers ─────────────────────────────────────────────────────
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}
function newId(): string {
  return 'p' + Math.random().toString(36).slice(2, 9)
}

function emptyGames(): Record<string, GameProgress> {
  const g: Record<string, GameProgress> = {}
  for (const id of GAME_IDS) g[id] = freshGameProgress()
  return g
}

function freshProfile(name: string): Profile {
  return {
    id: newId(),
    name: name.trim().slice(0, 14) || 'Player',
    xp: 0,
    gems: 0,
    achievements: [],
    games: emptyGames(),
  }
}

/** Coerce a possibly-partial/legacy stored object into a complete Profile. */
function normalizeProfile(p: Partial<Profile> & { id?: string; name?: string }): Profile {
  const games: Record<string, GameProgress> = { ...emptyGames() }
  if (p.games && typeof p.games === 'object') {
    for (const [k, v] of Object.entries(p.games)) {
      const gp = v as Partial<GameProgress>
      games[k] = {
        best: gp.best ?? {},
        unlocked: Array.isArray(gp.unlocked) ? gp.unlocked : [],
        mastered: Array.isArray(gp.mastered) ? gp.mastered : [],
        plays: typeof gp.plays === 'number' ? gp.plays : 0,
        highScore: typeof gp.highScore === 'number' ? gp.highScore : 0,
      }
    }
  }
  return {
    id: p.id ?? newId(),
    name: p.name ?? 'Player',
    xp: typeof p.xp === 'number' ? p.xp : 0,
    gems: typeof p.gems === 'number' ? p.gems : 0,
    achievements: Array.isArray(p.achievements) ? p.achievements : [],
    games,
  }
}

/** Map a profile to the cloud `data` blob (everything except id + name). */
function toCloudData(p: Profile): Record<string, unknown> {
  return { xp: p.xp, gems: p.gems, achievements: p.achievements, games: p.games }
}

function cloudToProfile(row: { id: string; name: string; data?: Record<string, unknown> }): Profile {
  const d = row.data ?? {}
  return normalizeProfile({ id: row.id, name: row.name, ...(d as Partial<Profile>) })
}

// ── Aggregate helpers (selectors) ───────────────────────────────────────────
/** Total levels mastered across all games (for achievements / display). */
export function totalMastered(p: Profile): number {
  return GAME_IDS.reduce((sum, id) => sum + (p.games[id]?.mastered.length ?? 0), 0)
}
/** Distinct games the player has played at least once. */
export function gamesPlayedCount(p: Profile): number {
  return GAME_IDS.reduce((n, id) => n + ((p.games[id]?.plays ?? 0) > 0 ? 1 : 0), 0)
}

// ── Store shape ──────────────────────────────────────────────────────────────
export interface RhythmStore {
  profiles: Profile[]
  currentId: string | null
  settings: Settings
  daily: DailyState

  // ── profile actions ──
  addProfile: (name: string) => void
  selectProfile: (id: string) => void
  removeProfile: (id: string) => void
  /** Join/switch class code: loads that class's roster from the cloud. */
  joinClass: (code: string) => Promise<void>
  /** Re-pull the current class roster from the cloud. */
  refreshClass: () => Promise<void>
  setVolume: (v: number) => void
  /** Set the beat-grid ("Show beat lines") preference (auto / on / off). */
  setBeatLines: (v: 'auto' | 'on' | 'off') => void

  // ── per-game progress ──
  /** Ensure a level id is unlocked for the current profile in a game. */
  unlockLevel: (gameId: GameId, levelId: string) => void

  /**
   * Record a finished run for `gameId`. Adds xp + gems, updates bests/mastery,
   * checks achievements + daily challenges, persists, and (if a class is joined)
   * debounce-syncs to the cloud. Returns a RunOutcome for the GameOver UI.
   * No-op (returns a zeroed outcome) if there's no current profile.
   */
  recordRun: (gameId: GameId, result: RunResult) => RunOutcome
}

const ZERO_OUTCOME: RunOutcome = {
  xpGained: 0,
  gemsGained: 0,
  newAchievements: [],
  leveledUp: false,
  rank: rankForXp(0),
  masteredNow: false,
  unlockedLevel: null,
  newBest: false,
  dailyGems: 0,
}

export const useStore = create<RhythmStore>()((set, get) => {
  const rawProfiles = loadJSON<Partial<Profile>[]>(LS_PROFILES, [])
  const initialProfiles = rawProfiles.map(normalizeProfile)
  const initialCurrent = loadJSON<string | null>(LS_CURRENT, null)
  const initialSettings = { ...DEFAULT_SETTINGS, ...loadJSON<Partial<Settings>>(LS_SETTINGS, {}) }

  let cloudSyncTimer: ReturnType<typeof setTimeout> | undefined
  const persistProfiles = () => {
    saveJSON(LS_PROFILES, get().profiles)
    const st = get()
    if (st.settings.classCode && cloudEnabled) {
      clearTimeout(cloudSyncTimer)
      cloudSyncTimer = setTimeout(() => {
        const s2 = get()
        const p = s2.profiles.find((x) => x.id === s2.currentId)
        if (p) void updatePlayer(p.id, toCloudData(p))
      }, 700)
    }
  }
  const persistSettings = () => saveJSON(LS_SETTINGS, get().settings)

  return {
    profiles: initialProfiles,
    currentId:
      initialCurrent && initialProfiles.some((p) => p.id === initialCurrent) ? initialCurrent : null,
    settings: initialSettings,
    daily: (() => {
      const stored = loadJSON<DailyState | null>(LS_DAILY, null)
      const key = todayKey()
      return stored && stored.date === key ? stored : { date: key, progress: {}, done: [] }
    })(),

    addProfile: (name) => {
      const p = freshProfile(name)
      set((st) => ({ profiles: [...st.profiles, p], currentId: p.id }))
      persistProfiles()
      saveJSON(LS_CURRENT, p.id)
      const code = get().settings.classCode
      if (code && cloudEnabled) {
        void insertPlayer(p.name, code, toCloudData(p)).then((row) => {
          if (!row) return
          set((st) => ({
            profiles: st.profiles.map((x) => (x.id === p.id ? { ...x, id: row.id } : x)),
            currentId: st.currentId === p.id ? row.id : st.currentId,
          }))
          saveJSON(LS_PROFILES, get().profiles)
          saveJSON(LS_CURRENT, get().currentId)
        })
      }
    },
    selectProfile: (id) => {
      set({ currentId: id })
      saveJSON(LS_CURRENT, id)
    },
    removeProfile: (id) => {
      set((st) => ({
        profiles: st.profiles.filter((p) => p.id !== id),
        currentId: st.currentId === id ? null : st.currentId,
      }))
      saveJSON(LS_PROFILES, get().profiles)
      saveJSON(LS_CURRENT, get().currentId)
      if (get().settings.classCode && cloudEnabled) void deletePlayer(id)
    },
    joinClass: async (code) => {
      const c = code.trim().toUpperCase().slice(0, 12)
      set((st) => ({ settings: { ...st.settings, classCode: c } }))
      persistSettings()
      if (!c || !cloudEnabled) return
      const rows = await fetchPlayers(c)
      const profiles = rows.map(cloudToProfile)
      set({ profiles, currentId: null })
      saveJSON(LS_PROFILES, profiles)
      saveJSON(LS_CURRENT, null)
    },
    refreshClass: async () => {
      const code = get().settings.classCode
      if (!code || !cloudEnabled) return
      const rows = await fetchPlayers(code)
      const profiles = rows.map(cloudToProfile)
      const cur = get().currentId
      set({ profiles, currentId: profiles.some((p) => p.id === cur) ? cur : null })
      saveJSON(LS_PROFILES, profiles)
    },
    setVolume: (v) => {
      set((st) => ({ settings: { ...st.settings, volume: Math.max(0, Math.min(1, v)) } }))
      persistSettings()
    },
    setBeatLines: (v) => {
      set((st) => ({ settings: { ...st.settings, beatLines: v } }))
      persistSettings()
    },

    unlockLevel: (gameId, levelId) => {
      const cur = get().currentId
      if (!cur) return
      set((st) => ({
        profiles: st.profiles.map((p) => {
          if (p.id !== cur) return p
          const gp = p.games[gameId] ?? freshGameProgress()
          if (gp.unlocked.includes(levelId)) return p
          return { ...p, games: { ...p.games, [gameId]: { ...gp, unlocked: [...gp.unlocked, levelId] } } }
        }),
      }))
      persistProfiles()
    },

    recordRun: (gameId, result) => {
      const st = get()
      const prof = st.currentId ? st.profiles.find((p) => p.id === st.currentId) : null
      if (!prof) return ZERO_OUTCOME

      const gp = prof.games[gameId] ?? freshGameProgress()
      const accuracy = Math.max(0, Math.min(1, result.accuracy))
      const masteredNow = !!result.mastered && (result.levelId ? !gp.mastered.includes(result.levelId) : true)

      // ── XP: 1 per note nailed + mastery bonus ──
      const xpGained = result.notes + (masteredNow ? MASTERY_XP_BONUS : 0)
      const newXp = prof.xp + xpGained

      // ── Gems: same shape as the flagship ──
      const gems = gemsForRun(result.score, masteredNow, accuracy)

      // ── Per-game progress update ──
      const levelId = result.levelId
      const prevBest = levelId ? gp.best[levelId] ?? 0 : 0
      const newBest = !!levelId && result.score > prevBest
      const best = levelId && newBest ? { ...gp.best, [levelId]: result.score } : gp.best
      let unlocked = gp.unlocked
      let mastered = gp.mastered
      let unlockedLevel: string | null = null
      if (masteredNow && levelId) {
        if (!mastered.includes(levelId)) mastered = [...mastered, levelId]
        if (result.unlockNext && !unlocked.includes(result.unlockNext)) {
          unlocked = [...unlocked, result.unlockNext]
          unlockedLevel = result.unlockNext
        }
      }
      const newGp: GameProgress = {
        best,
        unlocked,
        mastered,
        plays: gp.plays + 1,
        highScore: Math.max(gp.highScore, result.score),
      }

      // ── Daily challenges ──
      const dKey = todayKey()
      const base = st.daily.date === dKey ? st.daily : { date: dKey, progress: {}, done: [] }
      const progress: Record<string, number> = { ...base.progress }
      const done = [...base.done]
      let dailyGems = 0
      for (const c of dailyChallenges(dKey)) {
        let v = progress[c.id] ?? 0
        if (c.type === 'notes') v += result.notes
        else if (c.type === 'games') v += 1
        else if (c.type === 'accuracy90') v = accuracy >= 0.9 ? Math.max(v, 1) : v
        else if (c.type === 'stage') v = Math.max(v, result.stageReached ?? 0)
        else if (c.type === 'streak') v = Math.max(v, result.bestStreak ?? 0)
        progress[c.id] = v
        if (v >= c.target && !done.includes(c.id)) {
          done.push(c.id)
          dailyGems += c.reward
        }
      }
      const daily: DailyState = { date: dKey, progress, done }

      const newGems = prof.gems + gems + dailyGems

      // ── Achievements (suite-wide) ──
      const projected: Profile = {
        ...prof,
        xp: newXp,
        gems: newGems,
        games: { ...prof.games, [gameId]: newGp },
      }
      const newAchievements = checkAchievements(
        {
          gameId,
          stageReached: result.stageReached ?? 0,
          accuracy,
          totalNotes: result.notes,
          bestStreak: result.bestStreak ?? 0,
          masteredThisRun: masteredNow,
          wrongThisRun: result.wrong ?? 0,
          xp: newXp,
          gems: newGems,
          masteredCount: totalMastered(projected),
          gamesPlayedCount: gamesPlayedCount(projected),
        },
        prof.achievements,
      )

      const updated: Profile = {
        ...projected,
        achievements: [...prof.achievements, ...newAchievements],
      }

      const leveledUp = rankForXp(prof.xp).level < rankForXp(newXp).level

      set((s) => ({
        profiles: s.profiles.map((p) => (p.id === prof.id ? updated : p)),
        daily,
      }))
      saveJSON(LS_DAILY, daily)
      persistProfiles()

      return {
        xpGained,
        gemsGained: gems + dailyGems,
        newAchievements,
        leveledUp,
        rank: rankForXp(newXp),
        masteredNow,
        unlockedLevel,
        newBest,
        dailyGems,
      }
    },
  }
})

/** Convenience selector: the active profile (or null). */
export function activeProfile(s: RhythmStore): Profile | null {
  return s.currentId ? s.profiles.find((p) => p.id === s.currentId) ?? null : null
}
