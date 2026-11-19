import { createClient } from '@supabase/supabase-js';
import { envConfig } from '../utils/envConfig';

/**
 * Supabase browser client initialized strictly from public anon credentials.
 * Returns null if VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing
 * or if Demo Mode is active.
 */
let supabaseInstance = null;

if (!envConfig.isDemoMode && envConfig.hasSupabaseConfig) {
  supabaseInstance = createClient(envConfig.supabaseUrl, envConfig.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = supabaseInstance;
