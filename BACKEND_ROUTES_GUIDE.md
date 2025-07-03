# Extern MVP — Backend Route & Page Architecture

*Last updated: 2025-06-28*

This living document describes how the **Appointments**, **Customers** and **Craftsmen** resources flow through our **Next.js × Supabase** application — from database, to API routes, to pages/components.  It also acts as a checklist for creating future resources so that code stays consistent.

---

## 1. Data model (Supabase)

| Table          | Key columns                                                                      | Notes                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `craftsmen`    | `id` (PK), `user_id` (UNIQUE), `name`                                            | One-to-one with `auth.users`. Row is auto-created on first request via helper `getOrCreateCraftsmanId`.                    |
| `customers`    | `id` (PK), `craftsman_id` (FK), `name`, `email`, `phone`, `address` …            | **Craftsman-scoped.** Row-Level Security restricts access to owner.                                                        |
| `appointments` | `id` (PK), `craftsman_id` (FK), `customer_id` (nullable FK), `scheduled_at`, `duration`, `status`, `approval_status`, `is_private`, `price`, `notes`, `location`, `service_type` | If `is_private = true` then `customer_id` can be `NULL`.                                                                   |

**RLS pattern**: each table has a policy allowing `select`, `insert`, `update`, `delete` when

```sql
craftsman_id = (select id from craftsmen where user_id = auth.uid())
```

---

## 2. Folder layout

```
app/
├─ api/
│  ├─ appointments/
│  │  ├─ route.js        ← collection (GET, POST)
│  │  └─ [id]/route.js   ← single item (GET, PUT, DELETE)
│  ├─ customers/
│  │  └─ route.js        ← collection + single (GET id?=)
│  └─ proxy/[...path]/   ← passthrough helper (legacy support)
├─ appointments/
│  ├─ page.js            ← list + filters + view button
│  ├─ new/page.js        ← creation form
│  └─ [id]/page.js       ← detail / edit / complete
├─ customers/
│  └─ page.js            ← list + detail
└─ components/           ← shared UI bits
```

---

## 3. API route contract

Every route follows the same rules:

1. **Auth** — `getUserFromRequest(req)` returns the session; 401 if missing.
2. **Craftsman linking** — `getOrCreateCraftsmanId(user)` ensures we have `craftsman_id` for scoping.
3. **Input validation** — body is parsed via `await req.json()` and minimally checked.
4. **Column mapping** — if a camelCase prop mismatches DB snake_case (e.g. `is_private → private`), we map.
5. **RLS guarantee** — queries always `.eq('craftsman_id', craftsmanId)` to leverage RLS & avoid leakage.
6. **Error handling** — wrap in `try/catch`, `console.error` server-side, return generic 500 to client.

### 3.1 Appointments

| Verb | Path                          | Description | Body / Query |
| ---- | ----------------------------- | ----------- | ------------ |
| GET  | `/api/appointments`           | List for craftsman (optionally filter via URLSearchParams). | – |
| POST | `/api/appointments`           | Create new appointment. `is_private` accepted, converts to `private`. `customer_id` ignored when `is_private=true`. | `{ customer_id?, scheduled_at, duration, … }` |
| GET  | `/api/appointments/:id`       | Fetch single appointment (owns it). | – |
| PUT  | `/api/appointments/:id`       | Update allowed fields. Cannot change `craftsman_id`. | partial fields |
| DELETE| `/api/appointments/:id`      | Remove appointment. | – |

### 3.2 Customers

| Verb | Path                  | Description                          |
| ---- | --------------------- | ------------------------------------ |
| GET  | `/api/customers`      | List customers for craftsman.        |
| GET  | `/api/customers?id=3` | Fetch single customer.               |
| POST | `/api/customers`      | Create customer.                     |
| PUT  | `/api/customers`      | Update (id in body).                 |
| DELETE| `/api/customers`     | Delete (id in body).                 |

### 3.3 Craftsmen

We currently do not expose a public CRUD route; creation is implicit.  A future `/api/craftsmen` could follow the same pattern.

---

## 4. Page ↔ API interaction

All React pages use the custom hook `useAuthedFetch` which automatically:

1. Waits for `useAuth()` to provide a session.
2. Adds `Authorization: Bearer <access_token>` header.
3. Wraps `fetch` and returns the raw `Response` for flexibility.

```js
const fetcher = useAuthedFetch();
const res = await fetcher('/api/appointments');
```

### 4.1 Flow examples

#### Creating an appointment

1. `app/appointments/new/page.js` renders form.  On submit:
2. `POST /api/appointments` → returns created row.
3. `router.push('/appointments/[id]')` to detail page.

#### Viewing appointment list → detail

1. `app/appointments/page.js` loads via `GET /api/appointments`.
2. Each row has `View` button → `/appointments/[id]`.
3. Detail page calls `GET /api/appointments/:id` then (if `customer_id`) `GET /api/customers?id=`.

#### Craftsman lookup (shared)

Any appointment/customer route first calls helper `getOrCreateCraftsmanId(user)`:

```js
const { data: row } = await supabase
  .from('craftsmen')
  .select('id')
  .eq('user_id', user.id)
  .single();
if (!row) { /* insert new */ }
```

---

## 5. Creating a **new resource** (pattern)

1. **DB**: create table `<resource>` with `craftsman_id FK` and RLS identical to customers.
2. **API routes**:
   * `app/api/<resource>/route.js` – `GET` & `POST`.
   * `app/api/<resource>/[id]/route.js` – `GET`, `PUT`, `DELETE`.
   * Copy boilerplate from `appointments/route.js`.
3. **Front-end pages**:
   * List: `app/<resource>/page.js` – same skeleton as customers list.
   * Detail: `app/<resource>/[id]/page.js` – similar to appointment detail.
   * New/Edit modal optionally.
4. **Hook/useApi** (optional): encapsulate fetch calls for reuse.
5. **Validation**: keep camelCase in JS; translate to snake_case right before DB insertion.
6. **Testing**: ensure 401 without token, 403 for wrong craftsman, happy path.

---

## 6. Common helpers

| Helper                                   | Purpose                                   |
| ---------------------------------------- | ----------------------------------------- |
| `useAuthedFetch()`                       | Auth-aware `fetch`.                       |
| `getOrCreateCraftsmanId(user)`           | Server helper to ensure craftsman row.    |
| `splitLocalDateTime`, `formatLocal`      | UI-friendly date formatting.              |

---

## 7. Error patterns & logging

* **API**: `console.error('[route] method error', err.message)` then `return new Response('Server error', { status: 500 })`.
* **Client**: show toast/banner; do not surface raw error messages.
* **Infinite loops**: protect with refs (`fetchedRef`) and remove unstable deps from `useEffect`.

---

## 8. Roadmap notes

* Replace manual polling with SWR/React-Query to standardize caching.
* Expose `/api/craftsmen` when craftsman profile editing is needed.
* Introduce Zod schemas for body validation.

---

> Keep this guide updated whenever routes/pages change so newcomers can get productive quickly.
