import { createBrowserClient } from '@supabase/ssr'

// Hardcoded values as fallback for dev/production if env vars fail
const FALLBACK_SUPABASE_URL = 'https://xnsymruxpuxjmfqajdjg.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhuc3ltcnV4cHV4am1mcWFqZGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODQwMzYsImV4cCI6MjA2NjQ2MDAzNn0.U2k-zp0Pz5OVW3bX4rgdTT2m0MP4ANMbS-6GU43FUZY';

// Create and export the supabase client instance directly
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
)

// Also export createClient for backward compatibility or SSR usage
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
  )
}
