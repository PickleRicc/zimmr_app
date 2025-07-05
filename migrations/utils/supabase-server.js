import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Hardcoded values as fallback for dev/production if env vars fail
const FALLBACK_SUPABASE_URL = 'https://xnsymruxpuxjmfqajdjg.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhuc3ltcnV4cHV4am1mcWFqZGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODQwMzYsImV4cCI6MjA2NjQ2MDAzNn0.U2k-zp0Pz5OVW3bX4rgdTT2m0MP4ANMbS-6GU43FUZY';

export async function createClient() {
  const cookieStore = cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set(name, value, options)
        },
        remove(name, options) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        }
      }
    }
  )
}
