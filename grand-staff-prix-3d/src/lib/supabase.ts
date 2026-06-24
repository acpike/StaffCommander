import { createClient } from '@supabase/supabase-js'

// Configured from gitignored .env.local (VITE_ vars are inlined at build time).
// The anon/publishable key is safe to ship to the client (protected by RLS).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// null when not configured → the app runs fully local-only (no cloud sync).
export const supabase = url && key ? createClient(url, key) : null
