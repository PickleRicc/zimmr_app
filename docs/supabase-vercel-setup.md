# Supabase Environment Configuration for Vercel

This document explains how to properly set up Supabase environment variables in your Vercel deployment to fix the API route issues you're experiencing.

## Required Environment Variables

Your Vercel deployment needs the following environment variables:

| Environment Variable | Purpose | Source |
|---------------------|---------|--------|
| `SUPABASE_URL` | The URL of your Supabase project | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-level key for server operations that bypass RLS | Supabase dashboard → Project Settings → API → `service_role` key |
| `SUPABASE_ANON_KEY` | Public key for client operations | Supabase dashboard → Project Settings → API → `anon` key |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-side URL | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side anon key | Same as `SUPABASE_ANON_KEY` |

## Key Configuration Steps in Vercel

1. Log in to your Vercel dashboard
2. Select your project (`extern-frontend` or `zimmr-app-v1`)
3. Go to "Settings" → "Environment Variables"
4. Add each of the variables listed above with their corresponding values
5. Make sure all environment variables are added to all environments (Production, Preview, Development)
6. Click "Save" after adding all variables

## Important Security Considerations

1. **Never** expose the `service_role` key in client-side code or prefix it with `NEXT_PUBLIC_`
2. The `service_role` key has admin privileges and can bypass Row Level Security policies
3. Only server-side API routes should use the `service_role` key
4. Client-side code should only use the `anon` key with appropriate RLS policies

## Order of Precedence

In your API routes, we've updated the Supabase client initialization to use the following order of precedence:

1. `SUPABASE_SERVICE_ROLE_KEY` (preferred for server operations)
2. `SUPABASE_ANON_KEY` (fallback)
3. `NEXT_PUBLIC_SUPABASE_ANON_KEY` (last resort)

This ensures that if the service role key is available, it will be used, providing the necessary permissions for operations like creating craftsman records.

## Debugging Current Issues

If you're seeing errors related to RLS policies, it's likely because:

1. The `SUPABASE_SERVICE_ROLE_KEY` is not properly set in Vercel environment variables
2. The client-side API helpers aren't properly including the JWT token in requests
3. RLS policies are too restrictive and need adjustment

The enhanced logging we've added will help identify which of these issues is occurring.

## SQL Migration

Don't forget to run the `create_craftsman_rpc.sql` migration in your Supabase SQL editor to create the stored procedure that can bypass RLS policies when needed.
