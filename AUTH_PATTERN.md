# Frontend Authentication Pattern

All pages that require an authenticated user must follow this pattern. It ensures a single source of truth for auth state and removes fragile manual JWT parsing.

## 1. Import the helpers
```javascript
import { useRequireAuth } from '../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';
```

`useRequireAuth` returns the current `user` (or `null`) and a boolean `loading` flag (renamed to `authLoading` in components for clarity). It also **redirects to `/auth/login`** automatically once the initial check finishes and no user is present.

`useAuthedFetch` wraps `fetch` and attaches the current session’s JWT token to every request.

## 2. Gate any side-effects on auth
```javascript
const { user, loading: authLoading } = useRequireAuth();
const fetcher = useAuthedFetch();

useEffect(() => {
  if (authLoading || !user) return;  // wait until auth ready & user present
  // safe to fetch data now
  (async () => {
    const res = await fetcher('/api/my-endpoint');
    // ...handle response
  })();
}, [authLoading, user]);
```

## 3. Never parse the JWT manually
Row-level security is enforced on the backend, so the frontend no longer extracts `craftsmanId` or other claims. Use backend routes that infer the craftsman from the authenticated session.

## 4. Components that still need the token
If a third-party library explicitly needs the access token, call `supabase.auth.getSession()` inside the component instead of reading from `localStorage`.

## 5. Transition checklist for a page
1. Replace any `useAuth` import with `useRequireAuth`.
2. Remove token parsing / localStorage reads.
3. Guard all data loads with the `authLoading || !user` check.
4. Keep `useAuthedFetch` for API requests.

Following this guideline keeps auth flow consistent across Quotes, Invoices, Appointments, Customers, Profile, and Time-Tracking pages.
