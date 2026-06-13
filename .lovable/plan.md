## Trip Balance — Build Plan

A mobile-first React/Vite app on TanStack Start with Lovable Cloud (Supabase) for auth, database, and RLS. ZAR-only currency. All balances computed from source data, never stored.

### Tech & Setup
- Enable Lovable Cloud (Supabase) for auth + Postgres + RLS
- Email/password auth (no profiles table needed — members are account-scoped, optionally linked to a user)
- TanStack Router with `_authenticated` gate for app, public `/auth` route
- TanStack Query for data fetching via `createServerFn`
- shadcn/ui + Tailwind, mobile-first responsive layout
- ZAR formatter helper (`R1,250.00`)

### Database Schema (migration)
- `accounts` — id, name, created_by, created_at, archived_at
- `account_members` — id, account_id, name, email, user_id (nullable), role (`owner`|`member`), archived_at
- `app_role` enum + `user_roles` lookup via `has_role` SECURITY DEFINER (per account membership check uses a dedicated `is_account_member(account_id)` and `is_account_owner(account_id)` SECURITY DEFINER to avoid RLS recursion)
- `categories` — id, account_id (nullable for defaults), name, archived_at
- `trips` — id, account_id, name, start_date, end_date, notes, status (`planning`|`active`|`closed`), archived_at
- `expenses` — id, trip_id, date, description, category_id, total_amount (numeric ZAR), notes, split_method (`equal`|`percentage`), archived_at
- `expense_contributions` — id, expense_id, member_id, amount (sum must equal expense total — validated app-side + trigger)
- `expense_shares` — id, expense_id, member_id, percentage (nullable; used only for `percentage` split). Inclusion = presence of row. Equal split: rows with null percentage.
- `settlements` — id, account_id, trip_id (nullable), date, from_member_id, to_member_id, amount, notes, created_by
- All tables: RLS enabled, GRANTs to authenticated + service_role, soft-delete via `archived_at`

### RLS Policies
- Members can SELECT rows in accounts they belong to (`is_account_member`)
- Owners can mutate account settings, members, categories, archive trips, record settlements (`is_account_owner`)
- Members can create trips, add expenses, edit their own expenses (`created_by = auth.uid()`)

### Server Functions (`src/lib/*.functions.ts`)
- `accounts`: list, create, archive, addMember, removeMember, updateRole
- `trips`: list, get, create, update, archive, setStatus
- `expenses`: list by trip, create (with contributions + shares in transaction), update own, archive
- `settlements`: list, create, archive
- `categories`: list (defaults merged with custom), create, archive
- `balances`: `getTripBalances(tripId)`, `getAccountBalances(accountId, {year?})` — computed in SQL/JS from expenses + contributions + shares − settlements
- `reports`: trip summary, participant summary, YTD; CSV export via server route

### Calculation Engine
- Per expense: included members = rows in `expense_shares`
  - Equal: fair_share = total / count
  - Percentage: fair_share = total × pct/100
- Per member: net = Σ contributions − Σ fair_shares
- Trip balance: aggregate net per member
- Account balance: aggregate across all (non-archived) trips minus settlements
- Settlement minimization: greedy creditor/debtor matching → minimum transactions
- Year-to-date: filter trips where end_date in selected year
- Lifetime: all trips since account creation

### Routes
```text
/auth                         public — sign in / sign up
/_authenticated/
  index                       account picker / dashboard
  accounts/$id                account dashboard (summary cards, quick actions)
  accounts/$id/members        manage members (owner)
  accounts/$id/categories     manage categories (owner)
  accounts/$id/trips          trip list with filters/search
  accounts/$id/trips/new      create trip
  accounts/$id/trips/$tripId  trip dashboard (totals, balances, settlement plan)
  accounts/$id/trips/$tripId/expenses/new
  accounts/$id/trips/$tripId/expenses/$expenseId/edit
  accounts/$id/settlements    settlement list + record
  accounts/$id/balance-history balance history log
  accounts/$id/reports        reports + CSV export
```

### UI / UX
- Mobile-first: bottom nav on mobile, sidebar on desktop
- Fast expense entry: single-screen form with contribution + share editors
- Clear balance summary cards: "Sharon owes Mark R2,450"
- Tables for details (TanStack Table not required — simple semantic tables)
- Clean modern design — neutral palette with one accent color, generous spacing

### Out of Scope (v1)
- Email invitations (members added by name; user_id linked when they sign in with matching email)
- Multi-currency
- Receipt photo upload
- Push notifications

### Deliverables
- Migration with full schema + RLS + grants + default categories seed
- All server functions, routes, components
- README note on Hostinger VPS deployment (build output)
