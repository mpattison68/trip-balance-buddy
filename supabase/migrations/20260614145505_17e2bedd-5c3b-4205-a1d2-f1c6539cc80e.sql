-- Allow created_by to become NULL after user deletion (records survive)
ALTER TABLE public.trips ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.settlements ALTER COLUMN created_by DROP NOT NULL;

-- Recreate FKs to auth.users with ON DELETE SET NULL
ALTER TABLE public.account_members DROP CONSTRAINT account_members_user_id_fkey;
ALTER TABLE public.account_members
  ADD CONSTRAINT account_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.trips DROP CONSTRAINT trips_created_by_fkey;
ALTER TABLE public.trips
  ADD CONSTRAINT trips_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.expenses DROP CONSTRAINT expenses_created_by_fkey;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.settlements DROP CONSTRAINT settlements_created_by_fkey;
ALTER TABLE public.settlements
  ADD CONSTRAINT settlements_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;