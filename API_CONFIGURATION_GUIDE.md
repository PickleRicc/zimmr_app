# API Configuration & Best Practices Guide

## Overview
This document outlines best practices for API calls, authentication handling, and performance optimization to ensure robust and efficient data fetching across the application.

## Core Principles

### 1. Minimize Excessive API Calls
- **Use cleanup functions** in useEffect to prevent calls on unmounted components
- **Debounce auth state changes** to prevent rapid re-renders
- **Cache data when appropriate** to avoid redundant requests
- **Batch related API calls** using Promise.all()

### 2. Robust Authentication
- **Always use `useAuthedFetch`** for authenticated requests
- **Implement automatic token refresh** on 401 errors
- **Handle auth state changes gracefully** with debouncing
- **Provide fallback mechanisms** for auth failures

### 3. Error Handling & Resilience
- **Log detailed error information** for debugging
- **Implement retry logic** for transient failures
- **Provide user-friendly error messages**
- **Handle network timeouts and connection issues**

---

## Implementation Patterns

### ✅ Correct useEffect Pattern
```javascript
useEffect(() => {
  if (authLoading || !user || !requiredId) return;

  let isMounted = true;

  const fetchData = async () => {
    try {
      if (!isMounted) return;
      
      setLoading(true);
      const response = await fetcher('/api/endpoint');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          endpoint: '/api/endpoint'
        });
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      if (!isMounted) return;
      
      const data = await response.json();
      setData(data);
    } catch (err) {
      if (isMounted) {
        console.error('Error fetching data:', err);
        setError(err.message);
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  fetchData();

  return () => {
    isMounted = false;
  };
}, [authLoading, user, requiredId]);
```

### ❌ Problematic Patterns to Avoid
```javascript
// DON'T: Missing cleanup function
useEffect(() => {
  fetchData(); // Will cause memory leaks and excessive calls
}, [user]);

// DON'T: No auth state checks
useEffect(() => {
  fetchData(); // May run before auth is ready
}, []);

// DON'T: Missing error handling
const fetchData = async () => {
  const response = await fetch('/api/endpoint');
  const data = await response.json(); // Will crash on 404/500 errors
  setData(data);
};
```

---

## Authentication Configuration

### useAuthedFetch Hook Features
- **Automatic token attachment** from Supabase session
- **Token refresh on 401 errors** with automatic retry
- **Detailed logging** for debugging auth issues
- **Fallback mechanisms** for missing tokens

### Auth Context Optimizations
```javascript
// Debounced auth state changes (100ms)
const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
  if (timeoutId) clearTimeout(timeoutId);
  
  timeoutId = setTimeout(() => {
    setSession(session);
    setUser(session?.user || null);
  }, 100);
});
```

---

## API Error Handling

### Standard Error Response Format
```javascript
if (!response.ok) {
  const errorText = await response.text();
  console.error('API Error:', {
    status: response.status,
    statusText: response.statusText,
    error: errorText,
    endpoint: url,
    method: method || 'GET'
  });
  throw new Error(`${response.status}: ${response.statusText}`);
}
```

### Retry Logic for 401 Errors
```javascript
// Implemented in useAuthedFetch
if (res.status === 401 && token) {
  console.log('401 Unauthorized - attempting token refresh and retry...');
  
  const { data, error } = await supabase.auth.refreshSession();
  
  if (data?.session?.access_token) {
    // Retry request with new token
    const retryRes = await fetch(input, { 
      ...init, 
      headers: { ...headers, Authorization: `Bearer ${data.session.access_token}` }
    });
    return retryRes;
  }
}
```

---

## Performance Optimization

### 1. Batch API Calls
```javascript
// ✅ Good: Parallel requests
await Promise.all([
  fetchCustomers(),
  fetchAppointments(),
  fetchMaterials()
]);

// ❌ Bad: Sequential requests
await fetchCustomers();
await fetchAppointments();
await fetchMaterials();
```

### 2. Conditional Loading
```javascript
// Only fetch if data is needed and user is authenticated
useEffect(() => {
  if (authLoading || !user || !shouldFetch) return;
  fetchData();
}, [authLoading, user, shouldFetch]);
```

### 3. Component Lifecycle Management
```javascript
// Prevent state updates on unmounted components
let isMounted = true;

// ... async operations ...

return () => {
  isMounted = false;
};
```

---

## Common Issues & Solutions

### Issue: Excessive API Calls on Window Focus
**Cause:** Auth state changes triggering useEffect re-runs
**Solution:** Debounce auth state changes and use cleanup functions

### Issue: "Failed to fetch" Errors
**Cause:** Token expiration or network issues
**Solution:** Implement automatic token refresh and retry logic

### Issue: Memory Leaks
**Cause:** setState calls on unmounted components
**Solution:** Use isMounted flag and cleanup functions

### Issue: Race Conditions
**Cause:** Multiple API calls updating same state
**Solution:** Use isMounted checks and proper dependency arrays

---

## Testing Checklist

### Before Deploying API Changes:
- [ ] Test window focus/blur behavior
- [ ] Test token expiration scenarios
- [ ] Test network failure recovery
- [ ] Check for memory leaks in dev tools
- [ ] Verify error messages are user-friendly
- [ ] Test on mobile devices
- [ ] Verify GDPR compliance for data handling

### Performance Monitoring:
- [ ] Monitor API call frequency in browser dev tools
- [ ] Check for duplicate requests
- [ ] Verify proper cleanup on component unmount
- [ ] Test with slow network conditions

---

## Implementation Status

### ✅ Completed Optimizations:
- useAuthedFetch with automatic token refresh
- Auth context debouncing (100ms)
- Component lifecycle management
- Enhanced error logging
- Retry logic for 401 errors

### 🔄 Pages Using Optimized Patterns:
- `/quotes/[id]` - Quote details page
- Additional pages need review and updates

### 📋 Next Steps:
1. Audit all pages for API call patterns
2. Apply optimizations to remaining pages
3. Implement caching where appropriate
4. Add performance monitoring
5. Create automated tests for API reliability

---

## Quick Reference

### Import Statements
```javascript
import { useAuthedFetch } from '../lib/utils/useAuthedFetch';
import { useRequireAuth } from '../lib/utils/useRequireAuth';
```

### Basic Setup
```javascript
const { user, loading: authLoading } = useRequireAuth();
const fetcher = useAuthedFetch();
```

### Error Boundary Pattern
```javascript
try {
  const response = await fetcher('/api/endpoint');
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error);
  throw error;
}
```

This guide should be referenced when implementing new API integrations or debugging existing ones to ensure consistent, robust, and performant data fetching across the application.
