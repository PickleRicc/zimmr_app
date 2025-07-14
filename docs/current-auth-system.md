# Current Authentication System Documentation

## Overview
The extern-mvp app uses Supabase for authentication with a craftsman-based user system. Each authenticated user has an associated craftsman record that enables access to the application's features.

## Architecture

### 1. Authentication Flow
```
User Login → Supabase Auth → Token Storage → Craftsman Record → API Access
```

### 2. Core Components

#### **Supabase Client (`lib/supabase.js`)**
- Handles authentication state
- Manages session tokens
- Provides database access

#### **API Utilities (`lib/api-utils.js`)**
- `getUserFromRequest()` - Validates user tokens in API routes
- `getOrCreateCraftsmanId()` - Ensures craftsman record exists
- `handleApiError()` / `handleApiSuccess()` - Standardized API responses

#### **Auth Hook (`lib/utils/useAuthedFetch.js`)**
- `useAuthedFetch()` - Client-side authenticated API calls
- Automatic token refresh
- Error handling and retry logic

## Database Schema

### **Users Table (Supabase Auth)**
- Managed by Supabase Auth
- Contains: `id`, `email`, `user_metadata`
- User metadata includes: `full_name`, `phone`, `role`, `specialty`

### **Craftsmen Table**
```sql
craftsmen:
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- name (varchar)
- phone (varchar, nullable)
- specialty (varchar, nullable) 
- availability_hours (nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

### **Customers Table**
```sql
customers:
- id (uuid, primary key)
- craftsman_id (uuid, foreign key to craftsmen)
- name (varchar, required)
- phone, email, address (nullable)
- service_type, notes (nullable)
- created_at, updated_at (timestamps)
```

## Authentication Process

### 1. User Registration/Login
1. User authenticates via Supabase Auth
2. Supabase creates user record in `auth.users`
3. User metadata stored: `full_name`, `phone`, `role`, `specialty`

### 2. Craftsman Record Creation
1. On first API call, `getOrCreateCraftsmanId()` is triggered
2. Searches for existing craftsman record by `user_id`
3. If not found, creates new craftsman record:
   - Direct insert attempt first
   - Fallback to RPC function `create_craftsman_for_user()` if needed
4. Returns craftsman ID for API operations

### 3. API Access Control
1. All API routes use `getUserFromRequest()` to validate tokens
2. `getOrCreateCraftsmanId()` ensures craftsman record exists
3. API operations are scoped to the authenticated craftsman

## Key Files

### **Authentication Core**
- `lib/supabase.js` - Supabase client configuration
- `lib/api-utils.js` - Server-side auth utilities
- `lib/utils/useAuthedFetch.js` - Client-side auth hook

### **API Routes**
- `app/api/craftsmen/route.js` - Craftsman profile management
- `app/api/customers/route.js` - Customer management (craftsman-scoped)

### **Database Functions**
- `sql/create_craftsman_rpc.sql` - RPC function for craftsman creation
- `migrations/current_customer.sql` - Customer table schema

### **UI Components**
- `app/dashboard/page.js` - Main dashboard with auth-protected content

## Security Features

### **Row Level Security (RLS)**
- Craftsmen can only access their own records
- Customers are scoped to the owning craftsman
- RPC function bypasses RLS for initial craftsman creation

### **Token Management**
- Automatic token refresh in `useAuthedFetch`
- Secure token storage in localStorage
- Server-side token validation in all API routes

### **Error Handling**
- Standardized error responses with proper HTTP status codes
- Retry logic for transient failures
- Graceful handling of missing records

## Environment Variables

### **Required**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key for client
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server operations

## Common Operations

### **Check Authentication Status**
```javascript
import { useAuthedFetch } from '@/lib/utils/useAuthedFetch';

const { authedFetch, isAuthenticated } = useAuthedFetch();
```

### **Make Authenticated API Call**
```javascript
const response = await authedFetch('/api/customers', {
  method: 'POST',
  body: JSON.stringify({ name: 'Customer Name' })
});
```

### **Server-side User Validation**
```javascript
import { getUserFromRequest, getOrCreateCraftsmanId } from '@/lib/api-utils';

const user = await getUserFromRequest(req, supabase, 'API Route');
const craftsmanId = await getOrCreateCraftsmanId(user, supabase, 'API Route');
```

## Troubleshooting

### **Common Issues**
1. **Missing craftsman record** - Handled automatically by `getOrCreateCraftsmanId()`
2. **Token expiration** - Handled by `useAuthedFetch` with automatic refresh
3. **Schema mismatches** - Ensure API matches actual database schema

### **Debug Tools** (Removed in Production)
- Debug authentication endpoint: `/api/debug-auth`
- Debug utilities in `lib/debug-auth.js`
- Dashboard debug button (removed)

## Best Practices

1. **Always use `getUserFromRequest()` in API routes**
2. **Use `useAuthedFetch()` for client-side API calls**
3. **Scope all operations to the authenticated craftsman**
4. **Handle errors gracefully with proper HTTP status codes**
5. **Keep database schema in sync with API operations**

## Recent Fixes Applied

1. **Fixed schema mismatches** - Removed references to non-existent columns
2. **Improved error handling** - Added proper HTTP status code validation
3. **Enhanced craftsman creation** - Added RPC fallback for RLS bypass
4. **Updated customer API** - Aligned with actual database schema

---

*Last Updated: July 2025*
*Status: Production Ready ✅*
