# 2025-06-29 Implementation Guide

_Migrating Finances · Quotes · Profile · Invoices · Time-Tracking to Supabase-backed architecture_

This document maps out all changes required to finish the second wave of the migration.  It mirrors the patterns established in `BACKEND_ROUTES_GUIDE.md` so we continue writing DRY, predictable code.

---

## 0. Abbreviations

* **NX** – Next.js 14 App router code
* **SB** – Supabase client / Postgres
* **RLS** – Row Level Security

---

## 1. Domain model additions

| Resource        | Table name  | Relations                                     | Notes |
| --------------- | ----------- | --------------------------------------------- | ----- |
| Finances        | `finances`  | `craftsman_id FK`                             | Store aggregate metrics; 1 row per craftsman (optional) |
| Quotes          | `quotes`    | `craftsman_id FK` · `customer_id FK`          | `status`: draft/sent/accepted/rejected |
| Invoices        | `invoices`  | `craftsman_id FK` · `customer_id FK` · `appointment_id FK?`| Already exists partly → normalize to new pattern |
| Time Tracking   | `time_logs` | `craftsman_id FK` · `appointment_id FK?`      | `start`, `end`, `duration` |
| Profile         | uses `craftsmen` + `auth.users`                            | Expose update endpoint |

**RLS template** (copy from customers):
```sql
CREATE POLICY "Craftsman owns row"
  ON <table>
  USING (craftsman_id = (SELECT id FROM craftsmen WHERE user_id = auth.uid()));
```

---

## 2. API Route blueprint

### Folder layout (to add)
```
app/api/
  ├─ quotes/           route.js  [id]/route.js
  ├─ invoices/         route.js  [id]/route.js
  ├─ finances/summary  route.js  ← aggregated view
  ├─ time-logs/        route.js  [id]/route.js
  └─ profile/          route.js  ← CRUD for craftsman profile
```

### Handler boilerplate checklist
* `getUserFromRequest(req)` → 401
* `getOrCreateCraftsmanId(user)` → craftsman scope
* Map camelCase → snake_case before SB insert/update
* Always chain `.eq('craftsman_id', craftsmanId)`
* Return JSON with correct status codes (201 on POST etc.)

### Minimal contracts
See _commit messages_ for endpoints, verbs & payload.

---

## 3. Front-end pages

| Route                           | Component file suggestion                  | Initial action |
| ------------------------------- | ------------------------------------------ | -------------- |
| `/finances`                     | `app/finances/page.js`                     | Dashboard cards fed by `/api/finances/summary` |
| `/quotes`                       | `app/quotes/page.js`                       | List & “New Quote” button |
| `/quotes/new`                   | `app/quotes/new/page.js`                   | Form → POST `/api/quotes` |
| `/quotes/[id]`                  | `app/quotes/[id]/page.js`                  | Detail, edit, send PDF |
| `/invoices`                     | `app/invoices/page.js`                     | Existing page → refactor fetcher |
| `/invoices/new`                 | `app/invoices/new/page.js`                 | Already partly migrated; verify route contract |
| `/invoices/[id]`                | `app/invoices/[id]/page.js`                | Detail / pay status |
| `/time-tracking`                | `app/time-tracking/page.js`                | Clock-in/out UI using hooks |
| `/profile`                      | `app/profile/page.js`                      | Update craftsman name, email sync |

_All pages use `useAuthedFetch` to stay DRY._

---

## 4. Shared utilities / components to (re)use

* `lib/utils/date.js` – `splitLocalDateTime`, `formatLocal`
* `useAuthedFetch` – add optional `method`, `body` arguments wrapper to reduce boilerplate
* Modals, status‐pill component from appointments
* Currency & number formatting helpers from `appointments/[id]/page.js`

---

## 5. Deprecated code to delete after migration

* Legacy Express proxy fallback under `app/api/proxy` once all fetchers are updated
* Old Axios services in `services/` folder (quotes, invoices, time)

---

## 6. Incremental migration plan & Git commits

1. **chore(db): create tables for quotes, finances, time_logs**  
   SQL migration + RLS policies.

2. **feat(api): scaffold CRUD routes for quotes**  
   `app/api/quotes/{route.js,[id]/route.js}` using boilerplate.

3. **feat(ui): add quotes list & new quote form**  
   Pages with `useAuthedFetch` hooks; mirrors customers layout.

4. **feat(api): invoices routes aligned with new schema**  
   Update collection & detail handlers; map `is_paid` → `paid`.

5. **refactor(ui): update invoices pages to new api contract**  
   Switch to `useAuthedFetch`, remove axios.

6. **feat(api): time tracking CRUD**  
   `/api/time-logs` endpoints with clock-in/out logic on server.

7. **feat(ui): time tracking page with live timer**  
   React component using `useEffect` & `useAuthedFetch`.

8. **feat(api): finances summary endpoint**  
   SQL view or JS aggregation to return revenue, open invoices, etc.

9. **feat(ui): finances dashboard**  
   Cards & charts powered by `/api/finances/summary`.

10. **feat(api): profile route for craftsman updates**  
    Allow PUT to change `name`, `settings`.

11. **feat(ui): profile page**  
    Simple form; uses profile route.

12. **cleanup: remove legacy axios services & proxy**

13. **docs: update BACKEND_ROUTES_GUIDE with new resources**

Each commit should include unit tests or manual test notes where appropriate.

---

## 7. Testing checklist

- [ ] 401 when no token
- [ ] 403 when accessing another craftsman’s data
- [ ] Happy path create→read→update→delete for each resource
- [ ] RLS verified via SQL `EXPLAIN` test (optional)
- [ ] UI pages load with mock data in dev

---

## 8. Timeline estimate

| Task                                | Dev hrs |
| ----------------------------------- | ------ |
| DB & RLS migrations                 | 1.5 |
| Quotes API + pages                  | 3 |
| Invoices refactor                   | 2 |
| Time tracking API + UI              | 3 |
| Finances summary API + dashboard    | 2 |
| Profile route + UI                  | 1 |
| Cleanup & docs                      | 0.5 |
| **Total**                           | **13h** |

---

> Keep commits small & focused to ease code review and rollbacks.
