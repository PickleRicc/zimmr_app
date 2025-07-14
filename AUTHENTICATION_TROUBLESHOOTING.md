# Authentication Troubleshooting Guide

## Problem Description
~~New users can successfully login but API calls fail to fetch/put data. One specific user works fine for all APIs.~~ 

**✅ CRAFTSMAN AUTHENTICATION: RESOLVED**

**✅ CUSTOMERS API: RESOLVED**

**🎉 ALL AUTHENTICATION ISSUES FIXED**

## Root Cause Analysis
Based on the logs, the issues are:
1. **Missing Database Column**: The `craftsmen` table doesn't have an `active` column that the code expects
2. **Duplicate Records**: "JSON object requested, multiple (or no) rows returned" indicates duplicate craftsman records
3. **API Error Handling**: Invalid status codes causing server crashes
4. **Missing RPC Function**: The `create_craftsman_for_user` function doesn't exist in the database

## Debugging Steps

### 1. Use the Debug Button
1. Login with a problematic user account
2. Go to the dashboard
3. Click the red "🐛 Debug Auth (Check Console)" button
4. Open browser console (F12) and review the debug output

### 2. Check Console Logs
Look for these key indicators in the console:

**Good Authentication (NOW WORKING):**
```
✅ User authenticated successfully: { userId: "...", email: "...", hasMetadata: true }
✅ Found existing craftsman: { id: "...", name: "...", totalFound: 1 }
✅ Craftsman authentication working properly
```

**Customers API (NOW WORKING):**
```
✅ Customers API now matches actual database schema
✅ Removed non-existent city/zip columns
✅ Added service_type and notes columns
```

**Problem Indicators:**
```
❌ column craftsmen.active does not exist
❌ JSON object requested, multiple (or no) rows returned
❌ Could not find the 'active' column of 'craftsmen' in the schema cache
❌ Could not find the function public.create_craftsman_for_user
❌ init["status"] must be in the range of 200 to 599, inclusive
❌ All craftsman creation attempts failed
```

### 3. Manual API Testing
Test the debug endpoint directly:
```javascript
// In browser console
fetch('/api/debug-auth', {
  headers: { 'Authorization': 'Bearer ' + 'YOUR_TOKEN_HERE' }
}).then(r => r.json()).then(console.log)
```

## Solutions

### Solution 1: Check Database Schema (URGENT)
1. Run the SQL script in `sql/check_craftsmen_schema.sql` in your Supabase SQL editor
2. This will show you the actual columns in your `craftsmen` table
3. If the `active` column is missing, either:
   - Add it: `ALTER TABLE craftsmen ADD COLUMN active BOOLEAN DEFAULT true;`
   - Or remove references to it from the code

### Solution 2: Clean Up Duplicate Records
1. Run `sql/check_craftsmen_schema.sql` to identify duplicates
2. If duplicates exist, run `sql/cleanup_duplicate_craftsmen.sql`
3. This will keep the oldest record for each user and delete duplicates

### Solution 3: Create RPC Function
1. Run the SQL script in `sql/create_craftsman_rpc.sql` in your Supabase SQL editor
2. This creates a function that can bypass RLS policies to create craftsman records

### Solution 4: Fix RLS Policies (if needed)
Check your Supabase RLS policies for the `craftsmen` table:
1. Go to Supabase Dashboard → Authentication → Policies
2. Ensure there's a policy allowing users to INSERT their own craftsman record:
```sql
CREATE POLICY "Users can insert their own craftsman record" ON craftsmen
FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Environment Variables Checklist
Ensure these are set in your `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Code Changes Made

### 1. Improved Error Handling
- Enhanced `useAuthedFetch` hook with better token retrieval
- Added comprehensive logging to `getUserFromRequest`
- Improved `getOrCreateCraftsmanId` with retry logic

### 2. Debug Tools
- Created `/api/debug-auth` endpoint for comprehensive debugging
- Added debug utilities in `lib/debug-auth.js`
- Added debug button to dashboard

### 3. Token Management
- Fixed `hasAuthToken()` function localStorage key construction
- Added better token refresh logic
- Enhanced error reporting for 401 responses

## Testing Workflow

### For Working Users:
1. Login → Dashboard loads → APIs work → Console shows successful auth

### For Problematic Users:
1. Login → Dashboard loads → Click debug button → Check console
2. Look for craftsman creation errors
3. Check if RPC function exists and works
4. Verify token is being sent with requests

## Quick Fixes to Try

### 1. Clear Browser Storage
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
```

### 2. Force Token Refresh
```javascript
// In browser console
import { supabase } from './utils/supabase-client';
supabase.auth.refreshSession();
```

### 3. Manual Craftsman Creation
If you have database access, manually create craftsman records:
```sql
INSERT INTO craftsmen (user_id, name, email, active, created_at, updated_at)
VALUES ('user_id_here', 'User Name', 'user@email.com', true, NOW(), NOW());
```

## Prevention

### 1. User Registration Flow
Consider adding craftsman record creation to your user registration process.

### 2. Database Triggers
Create a database trigger to automatically create craftsman records when users are created.

### 3. Better Error Handling
Implement user-friendly error messages when craftsman creation fails.

## Support

If issues persist:
1. Check Supabase logs in the dashboard
2. Review RLS policies
3. Ensure service role key has proper permissions
4. Contact database administrator for RLS policy review

## Files Modified
- `lib/utils/useAuthedFetch.js` - Enhanced token handling
- `lib/api-utils.js` - Improved craftsman creation logic
- `migrations/utils/auth-helpers.js` - Fixed token checking
- `app/middleware.js` - Enhanced debugging
- `lib/debug-auth.js` - New debugging utilities
- `app/api/debug-auth/route.js` - New debug endpoint
- `sql/create_craftsman_rpc.sql` - Database function for craftsman creation
