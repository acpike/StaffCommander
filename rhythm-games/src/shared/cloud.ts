import { supabase } from './supabase'

// Cloud-synced player rows for the class-code leaderboard. `data` holds the
// shared progress blob (xp, gems, achievements, and the per-game progress map).
// A `class_code` groups players so the same roster loads on any device.
//
// IMPORTANT: every function no-ops gracefully when Supabase is not configured
// (cloudEnabled === false), so the whole suite works fully offline.
//
// Expected table (same shape as the flagship — reuse the same Supabase project
// if desired; rhythm-games rows just carry a richer `data` blob):
//   players(id uuid pk default gen_random_uuid(),
//           name text, class_code text, data jsonb,
//           updated_at timestamptz default now())
export interface CloudPlayer {
  id: string
  name: string
  class_code: string
  data: Record<string, unknown>
  updated_at?: string
}

export const cloudEnabled = !!supabase

export async function fetchPlayers(code: string): Promise<CloudPlayer[]> {
  if (!supabase || !code) return []
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('class_code', code)
  if (error) {
    console.warn('[cloud] fetchPlayers:', error.message)
    return []
  }
  return (data ?? []) as CloudPlayer[]
}

export async function insertPlayer(name: string, code: string, data: Record<string, unknown>): Promise<CloudPlayer | null> {
  if (!supabase) return null
  const { data: row, error } = await supabase
    .from('players')
    .insert({ name, class_code: code, data })
    .select()
    .single()
  if (error) {
    console.warn('[cloud] insertPlayer:', error.message)
    return null
  }
  return row as CloudPlayer
}

export async function updatePlayer(id: string, data: Record<string, unknown>): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('players')
    .update({ data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.warn('[cloud] updatePlayer:', error.message)
}

export async function deletePlayer(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) console.warn('[cloud] deletePlayer:', error.message)
}

/** Class leaderboard, highest XP first. Returns [] when cloud is disabled. */
export async function leaderboard(code: string): Promise<CloudPlayer[]> {
  const players = await fetchPlayers(code)
  return players.sort((a, b) => Number(b.data?.xp ?? 0) - Number(a.data?.xp ?? 0))
}
