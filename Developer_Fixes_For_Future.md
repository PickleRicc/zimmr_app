# Developer Fixes For Future Reference

## 401 Unauthorized Errors on Finance Page (Fixed: 2025-07-14)

### Problem Description
The finance page was experiencing 401 Unauthorized errors when making API calls to `/api/finances`. The logs showed:
- Finance API requests had `authorization: 'Missing'` in headers
- Other API endpoints (like quotes) had `authorization: 'Present (not shown)'` and worked correctly
- Users were authenticated but finance API calls failed

### Root Cause Analysis
The finance page was **missing the `useRequireAuth` hook**, which is essential for proper authentication flow in Next.js with Supabase. 

**Key Issue**: API calls were being made before the user's authentication session was properly established, resulting in missing authorization headers.

### Technical Details
1. **Working Pattern** (quotes page, dashboard):
   ```javascript
   const { user, loading: authLoading } = useRequireAuth();
   const fetcher = useAuthedFetch();
   
   useEffect(() => {
     if (!authLoading && user) {
       // Make API calls here
     }
   }, [authLoading, user]);
   ```

2. **Broken Pattern** (original finance page):
   ```javascript
   const fetcher = useAuthedFetch();
   
   useEffect(() => {
     // API calls made immediately without waiting for auth
   }, [period]);
   ```

### Solution Applied
1. **Added `useRequireAuth` hook** to finance page
2. **Updated useEffect** to wait for authentication completion:
   - Check `authLoading` is false
   - Check `user` is available
   - Only then make API calls
3. **Updated dependency array** to include `authLoading` and `user`
4. **Standardized API calls** to use direct `useAuthedFetch` instead of wrapper functions

### Files Modified
- `/app/finances/page.js`: Added proper authentication flow
- `/app/dashboard/page.js`: Updated to use direct fetcher calls instead of finance client

### Key Lesson
**All pages making authenticated API calls must use both `useRequireAuth` and `useAuthedFetch` hooks together**, and wait for auth completion before making requests. This ensures authorization headers are properly attached.

### Prevention
- Always use `useRequireAuth` when making authenticated API calls
- Check for `authLoading` and `user` before making API requests
- Follow the established pattern used in quotes and dashboard pages
- Test authentication flow thoroughly, especially after user login

---

## useEffect Dependency Array Size Error (Fixed: 2025-07-14)

### Problem Description
React error: "The final argument passed to useEffect changed size between renders"
- Previous: `[year]`  
- Incoming: `[year, false, [object Object]]`

### Root Cause
The useEffect dependency array was modified from `[period]` to `[period, authLoading, user]`, but:
1. The `user` object reference changes between renders
2. React detects the dependency array as unstable due to object reference changes
3. This causes the "array size changed" error even though the logical size is the same

### Solution Applied
Changed the dependency array to use stable primitive values:
```javascript
// Before (unstable - user object changes reference)
}, [period, authLoading, user]);

// After (stable - using primitive user ID)
}, [period, authLoading, user?.id]);
```

### Key Lesson
- Always use primitive values (strings, numbers, booleans) in dependency arrays when possible
- Avoid using entire objects as dependencies unless absolutely necessary
- Use object properties (like `user?.id`) instead of the full object
- This prevents React from detecting "size changes" due to reference changes

---

*This file documents critical fixes to prevent similar issues in the future. Always update this file when fixing authentication or React hook-related bugs.*
