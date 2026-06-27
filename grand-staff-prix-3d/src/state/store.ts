import { create } from 'zustand'
import { NOTE_SETS, pickNoteFrom, buildGateLettersFrom, activeNotes, startCountOf, customSet, nextLevel, starterLevelIds, type GameNote, type Letter, type NoteSet, type Clef, type NoteMode } from '../data/notes'
import { migrateProfileIds, migrateLevelId } from '../data/migrate'
import { WRONG_PENALTY, resolveActiveCount, activeCountAt, masterThreshold, meterStart } from '../data/ladder'
import { CARS } from '../data/cars'
import { COMPOSERS } from '../data/composers'
import { cloudEnabled, fetchPlayers, insertPlayer, updatePlayer, deletePlayer } from '../lib/cloud'
import { THEMES } from '../data/themes'
import { audio } from '../audio/sound'
import { resetCarState, carState } from '../game/carState'
import { BASE_SPEED, STAGE_SPEED } from '../game/constants'
import { gemsForRun, checkAchievements, dailyChallenges, todayKey } from '../data/progression'

export interface DailyState {
  date: string
  progress: Record<string, number>
  done: string[]
}
import { DEFAULT_AVATAR, normalizeAvatar, type AvatarConfig } from '../data/avatars'

// ──────────────────────────────────────────────────────────────────────────
// Persistence (localStorage). Profiles hold progression; settings hold the
// player's last menu choices. Kept explicit (no middleware) for clarity.
// ──────────────────────────────────────────────────────────────────────────

const LS_PROFILES = 'gsp3d.profiles'
const LS_CURRENT = 'gsp3d.current'
const LS_SETTINGS = 'gsp3d.settings'
const LS_CUSTOM = 'gsp3d.custom'
const LS_DAILY = 'gsp3d.daily'

export interface Profile {
  id: string
  name: string
  /** Best score per level id. */
  best: Record<string, number>
  /** Unlocked level ids (first level always unlocked). */
  unlocked: string[]
  /** Level ids the player has demonstrated MASTERY of (the unlock gate). */
  mastered: string[]
  /** Saved adaptive-ladder meter per level id (how far up the note ladder they got). */
  mastery: Record<string, number>
  /** Date key (YYYY-MM-DD) each level was last played, for meter decay on return. */
  lastPlayed: Record<string, string>
  xp: number
  /** Gem currency earned through play. */
  gems: number
  /** Unlocked achievement ids (see data/progression.ts). */
  achievements: string[]
  /** This player's chosen car. */
  carId: string
  /** This player's chosen composer (driver). */
  composerId: string
  /** Built driver avatar (see data/avatars.ts) — legacy, kept for migration. */
  avatar: AvatarConfig
}

interface Settings {
  levelId: string
  carId: string
  composerId: string
  themeId: string
  music: boolean
  steering: 'touch' | 'tilt' | 'keys'
  /** Class code grouping players for cloud sync + leaderboard (empty = local only). */
  classCode: string
  /** Show the alto + tenor (C-clef) tracks in the menu + creator. */
  showCClefs: boolean
}

/** Map a profile to the cloud `data` blob (everything except id + name). */
function toCloudData(p: Profile): Record<string, unknown> {
  return {
    best: p.best,
    unlocked: p.unlocked,
    mastered: p.mastered,
    mastery: p.mastery,
    lastPlayed: p.lastPlayed,
    xp: p.xp,
    gems: p.gems,
    achievements: p.achievements,
    carId: p.carId,
    composerId: p.composerId,
    avatar: p.avatar,
  }
}

const DEFAULT_SETTINGS: Settings = {
  levelId: NOTE_SETS[0].id,
  carId: CARS[0].id,
  composerId: COMPOSERS[0].id,
  themeId: THEMES[0].id,
  music: true,
  steering: 'keys',
  classCode: '',
  showCClefs: false,
}

/** Build a local Profile from a cloud row. */
function cloudToProfile(row: { id: string; name: string; data?: Record<string, unknown> }): Profile {
  const d = row.data ?? {}
  // Re-key any pre-rework level ids onto the new journey stages before use.
  const m = migrateProfileIds({
    best: (d.best as Record<string, number>) ?? {},
    unlocked: (d.unlocked as string[]) ?? [],
    mastered: (d.mastered as string[]) ?? [],
    mastery: (d.mastery as Record<string, number>) ?? {},
    lastPlayed: (d.lastPlayed as Record<string, string>) ?? {},
  })
  return {
    id: row.id,
    name: row.name,
    best: m.best,
    unlocked: Array.from(new Set([...starterLevelIds(), ...m.unlocked])),
    mastered: m.mastered,
    mastery: m.mastery,
    lastPlayed: m.lastPlayed,
    xp: (d.xp as number) ?? 0,
    gems: (d.gems as number) ?? 0,
    achievements: (d.achievements as string[]) ?? [],
    carId: (d.carId as string) ?? CARS[0].id,
    composerId: (d.composerId as string) ?? COMPOSERS[0].id,
    avatar: normalizeAvatar(d.avatar),
  }
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

function newId(): string {
  return 'p' + Math.random().toString(36).slice(2, 9)
}

function freshProfile(name: string): Profile {
  return {
    id: newId(),
    name: name.trim().slice(0, 14) || 'Player',
    best: {},
    unlocked: starterLevelIds(),
    mastered: [],
    mastery: {},
    lastPlayed: {},
    xp: 0,
    gems: 0,
    achievements: [],
    carId: CARS[0].id,
    composerId: COMPOSERS[0].id,
    avatar: { ...DEFAULT_AVATAR },
  }
}

// Number of correct answers needed to advance a stage; reaching STAGE_TO_UNLOCK
// clears the level and unlocks the next one.
const CORRECT_PER_STAGE = 8 // longer stages — sustain the skill, don't sprint
// Mastery is now demonstrated by the adaptive note ladder (see data/ladder.ts):
// the next level unlocks when the meter reaches its mastery threshold.
export const START_LIVES = 3
const GATES_BASE = 3

export type Screen = 'menu' | 'countdown' | 'playing' | 'over'
export type RoundResult = 'correct' | 'wrong' | null

export interface GameState {
  // ── navigation ──
  screen: Screen
  // ── profiles ──
  profiles: Profile[]
  currentId: string | null
  // ── menu selections ──
  settings: Settings
  /** Student-built custom practice levels (persisted, always playable). */
  customLevels: NoteSet[]
  /** Today's daily-challenge progress. */
  daily: DailyState
  // ── live run ──
  score: number
  lives: number
  streak: number
  stage: number
  correctCount: number
  /** Wrong answers this run, for accuracy / mastery. */
  wrongCount: number
  /** Adaptive note-ladder meter for the level being played this run. */
  meterM: number
  /** Active note-pool size derived from `meterM` (the ladder rung in play). */
  activeCount: number
  /** Increments whenever the ladder reveals a new note (drives the HUD celebration). */
  unlockTick: number
  /** Lives this run started with (varies by band; for the HUD heart row). */
  startLives: number
  /** Cap on the stage used for car SPEED + tempo, so beginners aren't outrun by the car. */
  stageCap: number
  /** Highest streak reached this run (for achievements). */
  bestStreak: number
  /** Index of the active note set (cached from settings.levelId at start). */
  note: GameNote | null
  gateLetters: Letter[]
  /** Active rendered mode for THIS wave (mix levels alternate it each wave). */
  noteMode: 'name' | 'find'
  /** Increments on every new wave so the spawner can react. */
  waveId: number
  lastResult: RoundResult
  /** Increments on every answer so HUD flash / camera shake can react. */
  flashTick: number
  /** Set true the run a new level was unlocked, for the game-over screen. */
  unlockedThisRun: string | null
  /** Level name mastered this run (drives the mastery celebration). */
  masteredThisRun: string | null
  /** Gems earned in the run just finished (for the game-over screen). */
  gemsEarned: number
  /** Achievement ids unlocked in the run just finished. */
  newAchievements: string[]

  // ── profile actions ──
  addProfile: (name: string, carId?: string, composerId?: string) => void
  selectProfile: (id: string) => void
  removeProfile: (id: string) => void
  /** Join/switch class code: loads that class's roster from the cloud. */
  joinClass: (code: string) => Promise<void>
  /** Re-pull the current class roster from the cloud. */
  refreshClass: () => Promise<void>
  /** Set the current profile's driver avatar config. */
  setAvatar: (config: AvatarConfig) => void

  // ── settings actions ──
  setLevel: (id: string) => void
  addCustomLevel: (name: string, clef: Clef | 'grand', noteNames: string[], mode?: NoteMode) => void
  removeCustomLevel: (id: string) => void
  setCar: (id: string) => void
  setComposer: (id: string) => void
  setTheme: (id: string) => void
  toggleMusic: () => void
  toggleCClefs: () => void
  setSteering: (s: Settings['steering']) => void

  // ── flow actions ──
  goMenu: () => void
  startGame: () => void
  beginPlay: () => void
  /** Called when the car passes through a gate labelled `letter`. */
  answer: (letter: Letter) => void
  endGame: () => void
}

function currentSet(levelId: string, custom: NoteSet[]): NoteSet {
  return NOTE_SETS.find((s) => s.id === levelId) ?? custom.find((s) => s.id === levelId) ?? NOTE_SETS[0]
}

function gatesForStage(stage: number): number {
  // 3 gates at stage 1-2, 4 at 3, 5 at 5+
  if (stage >= 5) return 5
  if (stage >= 3) return 4
  return GATES_BASE
}

/** The ladder dimensions for a level: total notes, starting pool, mastery target. */
function ladderContext(set: NoteSet): { ladderLen: number; startCount: number; masterM: number } {
  const ladderLen = set.notes.length
  const startCount = startCountOf(set)
  return { ladderLen, startCount, masterM: masterThreshold(ladderLen, startCount) }
}

/** Whole days between two YYYY-MM-DD keys (0 if same day, first play, or unparseable). */
function daysBetween(fromKey: string | undefined, toKey: string): number {
  if (!fromKey) return 0
  const a = Date.parse(fromKey + 'T00:00:00')
  const b = Date.parse(toKey + 'T00:00:00')
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

/** Beginner levels are no-fail practice: a wrong answer never costs a life. */
function isNoFail(set: NoteSet): boolean {
  return set.band === 'beginner'
}

/** Per-band starting lives and the stage cap that limits car speed + tempo. */
function bandCaps(set: NoteSet): { lives: number; stageCap: number } {
  switch (set.band) {
    case 'beginner':
      return { lives: 3, stageCap: 3 } // no-fail anyway; keep the car gentle while reading
    case 'intermediate':
      return { lives: 4, stageCap: 5 }
    default:
      return { lives: START_LIVES, stageCap: 99 } // advanced: full pressure, uncapped speed
  }
}

export const useGame = create<GameState>()((set, get) => {
  const initialProfiles = loadJSON<Profile[]>(LS_PROFILES, []).map((p) => {
    // Coerce legacy/missing fields (older saves used `avatar` as a string id, etc.;
    // normalizeAvatar maps anything to a complete AvatarConfig so nothing crashes).
    const coerced = {
      ...p,
      best: typeof (p as { best?: unknown }).best === 'object' && (p as { best?: unknown }).best ? (p as { best: Record<string, number> }).best : {},
      unlocked: Array.isArray((p as { unlocked?: unknown }).unlocked) ? (p as { unlocked: string[] }).unlocked : [],
      mastered: Array.isArray((p as { mastered?: unknown }).mastered) ? p.mastered : [],
      mastery:
        typeof (p as { mastery?: unknown }).mastery === 'object' && (p as { mastery?: unknown }).mastery
          ? (p as { mastery: Record<string, number> }).mastery
          : {},
      lastPlayed:
        typeof (p as { lastPlayed?: unknown }).lastPlayed === 'object' && (p as { lastPlayed?: unknown }).lastPlayed
          ? (p as { lastPlayed: Record<string, string> }).lastPlayed
          : {},
      gems: typeof (p as { gems?: unknown }).gems === 'number' ? p.gems : 0,
      achievements: Array.isArray((p as { achievements?: unknown }).achievements) ? p.achievements : [],
      carId: typeof (p as { carId?: unknown }).carId === 'string' ? (p as { carId: string }).carId : CARS[0].id,
      composerId: typeof (p as { composerId?: unknown }).composerId === 'string' ? (p as { composerId: string }).composerId : COMPOSERS[0].id,
      avatar: normalizeAvatar((p as { avatar?: unknown }).avatar),
    }
    // Re-key pre-rework level ids onto the new journey stages, then ensure every
    // track's first level is unlocked.
    const m = migrateProfileIds(coerced)
    return { ...m, unlocked: Array.from(new Set([...starterLevelIds(), ...m.unlocked])) }
  })
  const initialCurrent = loadJSON<string | null>(LS_CURRENT, null)
  const initialSettings = { ...DEFAULT_SETTINGS, ...loadJSON<Partial<Settings>>(LS_SETTINGS, {}) }
  // re-key a stale selected level (old curriculum ids) onto its nearest new stage
  if (!NOTE_SETS.some((s) => s.id === initialSettings.levelId) && !initialSettings.levelId.startsWith('cl-')) {
    initialSettings.levelId = migrateLevelId(initialSettings.levelId)
  }
  // dev/test override: ?car=<id> &theme=<id> &level=<id> to preview a specific combo
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search)
    const car = q.get('car')
    if (car && CARS.some((c) => c.id === car)) initialSettings.carId = car
    const composer = q.get('composer')
    if (composer && COMPOSERS.some((c) => c.id === composer)) initialSettings.composerId = composer
  }

  let cloudSyncTimer: ReturnType<typeof setTimeout> | undefined
  const persistProfiles = () => {
    saveJSON(LS_PROFILES, get().profiles)
    // debounced cloud sync of the active player (when a class is joined)
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

  const nextWave = (stage: number) => {
    const st0 = get()
    const s = currentSet(st0.settings.levelId, st0.customLevels)
    // Draw the target from the ACTIVE ladder pool (the notes unlocked so far),
    // not the whole level — this is what makes early levels start at 2 notes.
    const pool = activeNotes(s, st0.activeCount)
    const note = pickNoteFrom(pool)
    const gateLetters = buildGateLettersFrom(pool, note.letter, gatesForStage(stage))
    // 'mix' levels flip between name/find each wave; beginner levels stay name-only
    // (recognition before recall) so the very first notes are never "find".
    const base = s.mode ?? 'name'
    let noteMode: 'name' | 'find' = base === 'mix' ? (Math.random() < 0.5 ? 'find' : 'name') : base
    if (isNoFail(s)) noteMode = 'name'
    set((st) => ({ note, gateLetters, waveId: st.waveId + 1, noteMode }))
  }

  return {
    screen: 'menu',
    profiles: initialProfiles,
    currentId: initialCurrent && initialProfiles.some((p) => p.id === initialCurrent) ? initialCurrent : null,
    settings: initialSettings,
    customLevels: loadJSON<NoteSet[]>(LS_CUSTOM, []),
    daily: (() => {
      const stored = loadJSON<DailyState | null>(LS_DAILY, null)
      const key = todayKey()
      return stored && stored.date === key ? stored : { date: key, progress: {}, done: [] }
    })(),

    score: 0,
    lives: START_LIVES,
    streak: 0,
    stage: 1,
    correctCount: 0,
    wrongCount: 0,
    meterM: 0,
    activeCount: 0,
    unlockTick: 0,
    startLives: START_LIVES,
    stageCap: 99,
    bestStreak: 0,
    note: null,
    gateLetters: [],
    noteMode: 'name',
    waveId: 0,
    lastResult: null,
    flashTick: 0,
    unlockedThisRun: null,
    masteredThisRun: null,
    gemsEarned: 0,
    newAchievements: [],

    addProfile: (name, carId, composerId) => {
      const p = freshProfile(name)
      if (carId) p.carId = carId
      if (composerId) p.composerId = composerId
      set((st) => ({ profiles: [...st.profiles, p], currentId: p.id }))
      persistProfiles()
      saveJSON(LS_CURRENT, p.id)
      // if in a class, create the cloud row and swap in its id
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
    selectProfile: (id) => {
      set({ currentId: id })
      saveJSON(LS_CURRENT, id)
    },
    removeProfile: (id) => {
      set((st) => {
        const profiles = st.profiles.filter((p) => p.id !== id)
        const currentId = st.currentId === id ? null : st.currentId
        return { profiles, currentId }
      })
      saveJSON(LS_PROFILES, get().profiles)
      saveJSON(LS_CURRENT, get().currentId)
      if (get().settings.classCode && cloudEnabled) void deletePlayer(id)
    },
    setAvatar: (config) => {
      const cur = get().currentId
      if (!cur) return
      set((st) => ({
        profiles: st.profiles.map((p) => (p.id === cur ? { ...p, avatar: { ...config } } : p)),
      }))
      persistProfiles()
    },

    setLevel: (id) => {
      set((st) => ({ settings: { ...st.settings, levelId: id } }))
      persistSettings()
    },
    addCustomLevel: (name, clef, noteNames, mode = 'name') => {
      if (noteNames.length < 2) return
      const id = 'cl-' + Math.random().toString(36).slice(2, 8)
      const level = customSet(id, name, clef, noteNames, mode)
      set((st) => ({ customLevels: [...st.customLevels, level], settings: { ...st.settings, levelId: id } }))
      saveJSON(LS_CUSTOM, get().customLevels)
      persistSettings()
    },
    removeCustomLevel: (id) => {
      set((st) => ({
        customLevels: st.customLevels.filter((l) => l.id !== id),
        // if the deleted level was selected, fall back to the first built-in level
        settings: st.settings.levelId === id ? { ...st.settings, levelId: NOTE_SETS[0].id } : st.settings,
      }))
      saveJSON(LS_CUSTOM, get().customLevels)
      persistSettings()
    },
    setCar: (id) => {
      const cur = get().currentId
      if (cur) {
        set((st) => ({ profiles: st.profiles.map((p) => (p.id === cur ? { ...p, carId: id } : p)) }))
        persistProfiles()
      } else {
        set((st) => ({ settings: { ...st.settings, carId: id } }))
        persistSettings()
      }
    },
    setComposer: (id) => {
      const cur = get().currentId
      if (cur) {
        set((st) => ({ profiles: st.profiles.map((p) => (p.id === cur ? { ...p, composerId: id } : p)) }))
        persistProfiles()
      } else {
        set((st) => ({ settings: { ...st.settings, composerId: id } }))
        persistSettings()
      }
    },
    setTheme: (id) => {
      set((st) => ({ settings: { ...st.settings, themeId: id } }))
      persistSettings()
    },
    toggleMusic: () => {
      set((st) => ({ settings: { ...st.settings, music: !st.settings.music } }))
      persistSettings()
      const playing = get().screen === 'playing' || get().screen === 'countdown'
      if (playing) audio.setMusic(get().settings.music)
    },
    setSteering: (s) => {
      set((st) => ({ settings: { ...st.settings, steering: s } }))
      persistSettings()
    },
    toggleCClefs: () => {
      set((st) => ({ settings: { ...st.settings, showCClefs: !st.settings.showCClefs } }))
      persistSettings()
    },

    goMenu: () => {
      audio.stopEngine()
      audio.setMusic(false)
      set({ screen: 'menu' })
    },

    startGame: () => {
      resetCarState()
      audio.resume()
      const st = get()
      const levelId = st.settings.levelId
      const s = currentSet(levelId, st.customLevels)
      const { ladderLen, startCount, masterM } = ladderContext(s)
      // Resume where they left off, minus a warm-up that grows with days away —
      // so a rusty student's ladder peels back and they re-prove it. (§6)
      const prof = st.currentId ? st.profiles.find((p) => p.id === st.currentId) : null
      const savedM = prof?.mastery?.[levelId] ?? 0
      const daysAway = daysBetween(prof?.lastPlayed?.[levelId], todayKey())
      const meterM = meterStart(savedM, daysAway, masterM)
      const activeCount = activeCountAt(meterM, ladderLen, startCount)
      const caps = bandCaps(s)
      set({
        screen: 'countdown',
        score: 0,
        lives: caps.lives,
        startLives: caps.lives,
        stageCap: caps.stageCap,
        streak: 0,
        stage: 1,
        correctCount: 0,
        wrongCount: 0,
        meterM,
        activeCount,
        unlockTick: 0,
        bestStreak: 0,
        lastResult: null,
        flashTick: 0,
        unlockedThisRun: null,
        masteredThisRun: null,
        gemsEarned: 0,
        newAchievements: [],
        waveId: 0,
        note: null,
        gateLetters: [],
        // concrete starting mode; nextWave sets the real per-wave mode for 'mix'
        noteMode: s.mode === 'find' ? 'find' : 'name',
      })
    },

    beginPlay: () => {
      set({ screen: 'playing' })
      audio.setStageTempo(1)
      audio.setMusic(get().settings.music)
      audio.startEngine()
      nextWave(1)
    },

    answer: (letter) => {
      const st = get()
      if (st.screen !== 'playing' || !st.note) return
      const correct = letter === st.note.letter

      if (correct) {
        const correctCount = st.correctCount + 1
        const stage = 1 + Math.floor(correctCount / CORRECT_PER_STAGE)
        const streak = st.streak + 1
        // SCORE = small base × SPEED × COMBO. Accelerating into the correct gate
        // pays more (but going fast = less reaction time = real risk).
        const cruise = BASE_SPEED + (stage - 1) * STAGE_SPEED // no-boost speed for this stage
        const speedMult = Math.max(1, Math.min(2.5, 1 + (carState.speed / cruise - 1) * 2.5))
        const comboMult = 1 + Math.min(streak, 20) * 0.2 // 1× → 5× at a 20-streak
        const gained = Math.round(10 * speedMult * comboMult)
        const score = st.score + gained

        // ── adaptive note ladder ── a correct answer raises the meter; crossing a
        // threshold reveals the next note; reaching the top masters the level.
        const levelId = st.settings.levelId
        const s = currentSet(levelId, st.customLevels)
        const { ladderLen, startCount, masterM } = ladderContext(s)
        const meterM = st.meterM + 1
        const activeCount = resolveActiveCount(meterM, st.activeCount, ladderLen, startCount)
        const noteUnlocked = activeCount > st.activeCount
        // Only curriculum levels have a finish line; custom practice levels are
        // endless (they start with every note active and never "master").
        const justMastered = !!s.group && meterM >= masterM

        // MASTERY = hold the full ladder. The first time, unlock the next tier in
        // this clef track and award the mastery XP bonus.
        let unlockedThisRun = st.unlockedThisRun
        let masteredThisRun = st.masteredThisRun
        const prof = st.currentId ? st.profiles.find((p) => p.id === st.currentId) : null
        if (justMastered) {
          masteredThisRun = s.name
          if (prof && !prof.mastered.includes(levelId)) {
            const next = nextLevel(s)
            if (next && !prof.unlocked.includes(next.id)) unlockedThisRun = next.name
            const profiles = st.profiles.map((p) => {
              if (p.id !== prof.id) return p
              const mastered = [...p.mastered, levelId]
              const unlocked = next && !p.unlocked.includes(next.id) ? [...p.unlocked, next.id] : p.unlocked
              return { ...p, mastered, unlocked, xp: p.xp + 50 } // mastery XP bonus
            })
            set({ profiles })
            persistProfiles()
          }
        }

        audio.correct()
        audio.playNotePitch(st.note)
        audio.setStageTempo(Math.min(stage, st.stageCap))
        set({
          score,
          streak,
          stage,
          correctCount,
          meterM,
          activeCount,
          unlockTick: st.unlockTick + (noteUnlocked ? 1 : 0),
          bestStreak: Math.max(st.bestStreak, streak),
          lastResult: 'correct',
          flashTick: st.flashTick + 1,
          unlockedThisRun,
          masteredThisRun,
        })
        if (justMastered) {
          // Finish line: mastering ENDS the race as a win — the exit ramp. (§7)
          get().endGame()
        } else {
          nextWave(stage)
        }
      } else {
        // WRONG: the meter falls (demotion pressure), which can drop the most
        // recently-added note back off the pool until it's re-earned.
        const s = currentSet(st.settings.levelId, st.customLevels)
        const { ladderLen, startCount } = ladderContext(s)
        const meterM = Math.max(0, st.meterM - WRONG_PENALTY)
        const activeCount = resolveActiveCount(meterM, st.activeCount, ladderLen, startCount)
        // Beginner levels are no-fail practice: a wrong answer never costs a life,
        // so young students can only exit by succeeding (mastering).
        const lives = isNoFail(s) ? st.lives : st.lives - 1
        audio.wrong()
        set({
          lives,
          streak: 0,
          wrongCount: st.wrongCount + 1,
          meterM,
          activeCount,
          lastResult: 'wrong',
          flashTick: st.flashTick + 1,
        })
        if (lives <= 0) {
          get().endGame()
        } else {
          nextWave(st.stage)
        }
      }
    },

    endGame: () => {
      const st = get()
      const total = st.correctCount + st.wrongCount
      const accuracy = total > 0 ? st.correctCount / total : 0
      const gems = gemsForRun(st.score, !!st.masteredThisRun, accuracy)

      // ── daily challenges: update progress + award gems for completions ──
      const dKey = todayKey()
      const base = st.daily.date === dKey ? st.daily : { date: dKey, progress: {}, done: [] }
      const progress: Record<string, number> = { ...base.progress }
      const done = [...base.done]
      let dailyGems = 0
      for (const c of dailyChallenges(dKey)) {
        let v = progress[c.id] ?? 0
        if (c.type === 'notes') v += st.correctCount
        else if (c.type === 'games') v += 1
        else if (c.type === 'accuracy90') v = accuracy >= 0.9 ? Math.max(v, 1) : v
        else if (c.type === 'stage') v = Math.max(v, st.stage)
        else if (c.type === 'streak') v = Math.max(v, st.bestStreak)
        progress[c.id] = v
        if (v >= c.target && !done.includes(c.id)) {
          done.push(c.id)
          dailyGems += c.reward
        }
      }
      const daily: DailyState = { date: dKey, progress, done }
      saveJSON(LS_DAILY, daily)

      const prof = st.currentId ? st.profiles.find((p) => p.id === st.currentId) : null
      let newAchievements: string[] = []
      if (prof) {
        const levelId = st.settings.levelId
        const prevBest = prof.best[levelId] ?? 0
        const best = st.score > prevBest ? { ...prof.best, [levelId]: st.score } : prof.best
        // Save the ladder PEAK (meter only ratchets up across runs; the warm-up on
        // return is what decays it) plus when this level was last played. (§6)
        const mastery = { ...prof.mastery, [levelId]: Math.max(prof.mastery[levelId] ?? 0, st.meterM) }
        const lastPlayed = { ...prof.lastPlayed, [levelId]: dKey }
        // XP = LEARNING: one point per note read correctly this run (mastery adds a bonus above)
        const newXp = prof.xp + st.correctCount
        const newGems = prof.gems + gems + dailyGems
        // prof.mastered already reflects any mastery earned this run (set in answer)
        newAchievements = checkAchievements(
          {
            stageReached: st.stage,
            accuracy,
            totalNotes: total,
            bestStreak: st.bestStreak,
            masteredThisRun: !!st.masteredThisRun,
            wrongThisRun: st.wrongCount,
            xp: newXp,
            gems: newGems,
            masteredCount: prof.mastered.length,
          },
          prof.achievements,
        )
        const achievements = [...prof.achievements, ...newAchievements]
        const profiles = st.profiles.map((p) =>
          p.id === prof.id ? { ...p, best, xp: newXp, gems: newGems, achievements, mastery, lastPlayed } : p,
        )
        set({ profiles })
        persistProfiles()
      }
      // A mastery finish is a WIN (the checkered flag), not a crash — sound it that way.
      if (st.masteredThisRun) audio.fanfare()
      else audio.crash()
      audio.setMusic(false)
      audio.stopEngine()
      set({ screen: 'over', gemsEarned: gems + dailyGems, newAchievements, daily })
    },
  }
})

// Convenience selectors used across components.
export function activeProfile(s: GameState): Profile | null {
  return s.currentId ? s.profiles.find((p) => p.id === s.currentId) ?? null : null
}
