import { createClient } from '@supabase/supabase-js';

// Centralized Supabase browser-side client.  This file is imported dynamically
// in places that need a client instance while keeping SSR bundles lean.
// It must live in `utils/` so relative imports like `../utils/supabase-client`
// resolve correctly from many folders (e.g. `contexts/`, `app/api/`, etc.).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
