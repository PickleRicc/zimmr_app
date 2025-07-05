import { createClient } from '@supabase/supabase-js';

// Centralized Supabase browser-side client.  This file is imported dynamically
// in places that need a client instance while keeping SSR bundles lean.
// It must live in `utils/` so relative imports like `../utils/supabase-client`
// resolve correctly from many folders (e.g. `contexts/`, `app/api/`, etc.).

// Hardcoded values as fallback for dev/production if env vars fail
const FALLBACK_SUPABASE_URL = 'https://xnsymruxpuxjmfqajdjg.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhuc3ltcnV4cHV4am1mcWFqZGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODQwMzYsImV4cCI6MjA2NjQ2MDAzNn0.U2k-zp0Pz5OVW3bX4rgdTT2m0MP4ANMbS-6GU43FUZY';

// Try all possible env var names and fall back to hardcoded values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true }
});
