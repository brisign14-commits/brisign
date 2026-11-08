import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Bucket Storage qui contient toutes les images du portfolio. */
export const BUCKET = 'portfolio'

// Si les variables ne sont pas définies, le site public tourne en mode démo (src/data/fallback.js)
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null
export const isSupabaseReady = Boolean(supabase)
