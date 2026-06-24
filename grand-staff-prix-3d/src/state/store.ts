import { create } from 'zustand'
import { NOTE_SETS, pickNote, buildGateLetters, customSet, type GameNote, type Letter, type NoteSet, type Clef } from '../data/notes'
import { CARS } from '../data/cars'
import { THEMES } from '../data/themes'
import { audio } from '../audio/sound'
import { resetCarState } from '../game/carState'
import { DEFAULT_AVATAR, normalizeAvatar, type AvatarConfig } from '../data/avatars'

// ──────────────────────────────────────────────────────────────────────────
// Persistence (localStorage). Profiles hold progression; settings hold the
// player's last menu choices. Kept explicit (no middleware) for clarity.
// ──────────────────────────────────────────────────────────────────────────

const LS_PROFILES = 'gsp3d.profiles'
const LS_CURRENT = 'gsp3d.current'
const LS_SETTINGS = 'gsp3d.settings'
const LS_CUSTOM = 'gsp3d.custom'

export interface Profile {
  id: string
  name: string
  /** Best score per level id. */
  best: Record<string, number>
  /** Unlocked level ids (first level always unlocked). */
  unlocked: string[]
  /** Level ids the player has demonstrated MASTERY of (the unlock gate). */
  mastered: string[]
  xp: number
  /** Built driver avatar (see data/avatars.ts). */
  avatar: AvatarConfig
}

interface Settings {
  levelId: string
  carId: string
  themeId: string
  music: boolean
  steering: 'touch' | 'tilt' | 'keys'
}

const DEFAULT_SETTINGS: Settings = {
  levelId: NOTE_SETS[0].id,
  carId: CARS[0].id,
  themeId: THEMES[0].id,
  music: true,
  steering: 'keys',
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
    unlocked: [NOTE_SETS[0].id],
    mastered: [],
    xp: 0,
    avatar: { ...DEFAULT_AVATAR },
  }
}

// Number of correct answers needed to advance a stage; reaching STAGE_TO_UNLOCK
// clears the level and unlocks the next one.
const CORRECT_PER_STAGE = 8 // longer stages — sustain the skill, don't sprint
// Mastery gate to unlock the next level: you must DEMONSTRATE the skill, not just survive —
// reach a deep stage, over a meaningful sample of notes, at high accuracy.
const MASTERY_STAGE = 4
const MASTERY_MIN_NOTES = 30
const MASTERY_ACCURACY = 0.9
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
  // ── live run ──
  score: number
  lives: number
  streak: number
  stage: number
  correctCount: number
  /** Wrong answers this run, for accuracy / mastery. */
  wrongCount: number
  /** Index of the active note set (cached from settings.levelId at start). */
  note: GameNote | null
  gateLetters: Letter[]
  /** Increments on every new wave so the spawner can react. */
  waveId: number
  lastResult: RoundResult
  /** Increments on every answer so HUD flash / camera shake can react. */
  flashTick: number
  /** Set true the run a new level was unlocked, for the game-over screen. */
  unlockedThisRun: string | null
  /** Level name mastered this run (drives the mastery celebration). */
  masteredThisRun: string | null

  // ── profile actions ──
  addProfile: (name: string, avatar?: AvatarConfig) => void
  selectProfile: (id: string) => void
  removeProfile: (id: string) => void
  /** Set the current profile's driver avatar config. */
  setAvatar: (config: AvatarConfig) => void

  // ── settings actions ──
  setLevel: (id: string) => void
  addCustomLevel: (name: string, clef: Clef, noteNames: string[]) => void
  removeCustomLevel: (id: string) => void
  setCar: (id: string) => void
  setTheme: (id: string) => void
  toggleMusic: () => void
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

export const useGame = create<GameState>()((set, get) => {
  const initialProfiles = loadJSON<Profile[]>(LS_PROFILES, []).map((p) => ({
    // Migrate profiles persisted before the avatar builder: older ones have
    // `avatar` as a string id (or missing). normalizeAvatar maps anything to a
    // complete AvatarConfig so nothing crashes on load.
    ...p,
    mastered: Array.isArray((p as { mastered?: unknown }).mastered) ? p.mastered : [],
    avatar: normalizeAvatar((p as { avatar?: unknown }).avatar),
  }))
  const initialCurrent = loadJSON<string | null>(LS_CURRENT, null)
  const initialSettings = { ...DEFAULT_SETTINGS, ...loadJSON<Partial<Settings>>(LS_SETTINGS, {}) }

  const persistProfiles = () => saveJSON(LS_PROFILES, get().profiles)
  const persistSettings = () => saveJSON(LS_SETTINGS, get().settings)

  const nextWave = (stage: number) => {
    const s = currentSet(get().settings.levelId, get().customLevels)
    const note = pickNote(s)
    const gateLetters = buildGateLetters(s, note.letter, gatesForStage(stage))
    set((st) => ({ note, gateLetters, waveId: st.waveId + 1 }))
  }

  return {
    screen: 'menu',
    profiles: initialProfiles,
    currentId: initialCurrent && initialProfiles.some((p) => p.id === initialCurrent) ? initialCurrent : null,
    settings: initialSettings,
    customLevels: loadJSON<NoteSet[]>(LS_CUSTOM, []),

    score: 0,
    lives: START_LIVES,
    streak: 0,
    stage: 1,
    correctCount: 0,
    wrongCount: 0,
    note: null,
    gateLetters: [],
    waveId: 0,
    lastResult: null,
    flashTick: 0,
    unlockedThisRun: null,
    masteredThisRun: null,

    addProfile: (name, avatar) => {
      const p = freshProfile(name)
      if (avatar) p.avatar = { ...avatar }
      set((st) => ({ profiles: [...st.profiles, p], currentId: p.id }))
      persistProfiles()
      saveJSON(LS_CURRENT, p.id)
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
      persistProfiles()
      saveJSON(LS_CURRENT, get().currentId)
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
    addCustomLevel: (name, clef, noteNames) => {
      if (noteNames.length < 2) return
      const id = 'cl-' + Math.random().toString(36).slice(2, 8)
      const level = customSet(id, name, clef, noteNames)
      set((st) => ({ customLevels: [...st.customLevels, level], settings: { ...st.settings, levelId: id } }))
      saveJSON(LS_CUSTOM, get().customLevels)
      persistSettings()
    },
    removeCustomLevel: (id) => {
      set((st) => ({ customLevels: st.customLevels.filter((l) => l.id !== id) }))
      saveJSON(LS_CUSTOM, get().customLevels)
    },
    setCar: (id) => {
      set((st) => ({ settings: { ...st.settings, carId: id } }))
      persistSettings()
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

    goMenu: () => {
      audio.stopEngine()
      audio.setMusic(false)
      set({ screen: 'menu' })
    },

    startGame: () => {
      resetCarState()
      audio.resume()
      set({
        screen: 'countdown',
        score: 0,
        lives: START_LIVES,
        streak: 0,
        stage: 1,
        correctCount: 0,
        wrongCount: 0,
        lastResult: null,
        flashTick: 0,
        unlockedThisRun: null,
        masteredThisRun: null,
        waveId: 0,
        note: null,
        gateLetters: [],
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
        const total = correctCount + st.wrongCount
        const accuracy = total > 0 ? correctCount / total : 1
        const stage = 1 + Math.floor(correctCount / CORRECT_PER_STAGE)
        const streak = st.streak + 1
        // accuracy bonus rewards reading well, not just surviving
        const gained = Math.round(100 * (1 + streak * 0.12) * stage * (0.6 + 0.4 * accuracy))
        const score = st.score + gained

        // MASTERY GATE: unlock the next level only when the player demonstrates the
        // skill — reach stage MASTERY_STAGE, over >= MASTERY_MIN_NOTES notes, at >= 90%.
        let unlockedThisRun = st.unlockedThisRun
        let masteredThisRun = st.masteredThisRun
        const levelId = st.settings.levelId
        const prof = st.currentId ? st.profiles.find((p) => p.id === st.currentId) : null
        if (
          prof &&
          !prof.mastered.includes(levelId) &&
          stage >= MASTERY_STAGE &&
          total >= MASTERY_MIN_NOTES &&
          accuracy >= MASTERY_ACCURACY
        ) {
          const idx = NOTE_SETS.findIndex((s) => s.id === levelId)
          const next = NOTE_SETS[idx + 1]
          masteredThisRun = currentSet(levelId, st.customLevels).name
          if (next && !prof.unlocked.includes(next.id)) unlockedThisRun = next.name
          const profiles = st.profiles.map((p) => {
            if (p.id !== prof.id) return p
            const mastered = [...p.mastered, levelId]
            const unlocked = next && !p.unlocked.includes(next.id) ? [...p.unlocked, next.id] : p.unlocked
            return { ...p, mastered, unlocked, xp: p.xp + 250 } // mastery XP bonus
          })
          set({ profiles })
          persistProfiles()
        }

        audio.correct()
        audio.playNotePitch(st.note)
        audio.setStageTempo(stage)
        set({ score, streak, stage, correctCount, lastResult: 'correct', flashTick: st.flashTick + 1, unlockedThisRun, masteredThisRun })
        nextWave(stage)
      } else {
        const lives = st.lives - 1
        audio.wrong()
        set({ lives, streak: 0, wrongCount: st.wrongCount + 1, lastResult: 'wrong', flashTick: st.flashTick + 1 })
        if (lives <= 0) {
          get().endGame()
        } else {
          nextWave(st.stage)
        }
      }
    },

    endGame: () => {
      const st = get()
      const prof = st.currentId ? st.profiles.find((p) => p.id === st.currentId) : null
      if (prof) {
        const prevBest = prof.best[st.settings.levelId] ?? 0
        const best =
          st.score > prevBest ? { ...prof.best, [st.settings.levelId]: st.score } : prof.best
        const profiles = st.profiles.map((p) =>
          p.id === prof.id ? { ...p, best, xp: p.xp + Math.round(st.score / 10) } : p,
        )
        set({ profiles })
        persistProfiles()
      }
      audio.crash()
      audio.setMusic(false)
      audio.stopEngine()
      set({ screen: 'over' })
    },
  }
})

// Convenience selectors used across components.
export function activeProfile(s: GameState): Profile | null {
  return s.currentId ? s.profiles.find((p) => p.id === s.currentId) ?? null : null
}
