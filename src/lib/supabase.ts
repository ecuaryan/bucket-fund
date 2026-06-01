import { createClient } from '@supabase/supabase-js'
import {
  prepareAuthStorageOnStartup,
  supabaseAuthStorage,
} from '@/lib/authPersistence'
import type { Database } from '@/types/database'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

prepareAuthStorageOnStartup()

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Recover from orphaned cross-tab locks instead of hanging sign-in.
    lockAcquireTimeout: 5000,
  },
})
