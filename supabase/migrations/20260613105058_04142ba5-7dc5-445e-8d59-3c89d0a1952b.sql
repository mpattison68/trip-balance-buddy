
-- ============ ENUMS ============
CREATE TYPE public.member_role AS ENUM ('owner', 'member');
CREATE TYPE public.trip_status AS ENUM ('planning', 'active', 'closed');
CREATE TYPE public.split_method AS ENUM ('equal', 'percentage');

-- ============ ACCOUNTS ============
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- ============ ACCOUNT MEMBERS ============
CREATE TABLE public.account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  user_id uuid REFERENCES auth.users(id),
  role public.member_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX idx_account_members_account ON public.account_members(account_id);
CREATE INDEX idx_account_members_user ON public.account_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_members TO authenticated;
GRANT ALL ON public.account_members TO service_role;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.is_account_member(_account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = _account_id
      AND user_id = auth.uid()
      AND archived_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_account_owner(_account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = _account_id
      AND user_id = auth.uid()
      AND role = 'owner'
      AND archived_at IS NULL
  );
$$;

-- ============ ACCOUNTS RLS ============
CREATE POLICY "Members can view their accounts" ON public.accounts
  FOR SELECT TO authenticated USING (public.is_account_member(id) OR created_by = auth.uid());
CREATE POLICY "Authenticated users can create accounts" ON public.accounts
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners can update accounts" ON public.accounts
  FOR UPDATE TO authenticated USING (public.is_account_owner(id)) WITH CHECK (public.is_account_owner(id));

-- Auto-create owner member on account creation
CREATE OR REPLACE FUNCTION public.handle_new_account()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_name text;
BEGIN
  SELECT email, COALESCE(raw_user_meta_data->>'name', email)
    INTO v_email, v_name
  FROM auth.users WHERE id = NEW.created_by;
  INSERT INTO public.account_members (account_id, name, email, user_id, role)
  VALUES (NEW.id, COALESCE(v_name, 'Owner'), v_email, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_account_created
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_account();

-- ============ ACCOUNT MEMBERS RLS ============
CREATE POLICY "Members can view account members" ON public.account_members
  FOR SELECT TO authenticated USING (public.is_account_member(account_id) OR user_id = auth.uid());
CREATE POLICY "Owners can add members" ON public.account_members
  FOR INSERT TO authenticated WITH CHECK (public.is_account_owner(account_id));
CREATE POLICY "Owners can update members" ON public.account_members
  FOR UPDATE TO authenticated USING (public.is_account_owner(account_id)) WITH CHECK (public.is_account_owner(account_id));

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE, -- NULL = global default
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view categories" ON public.categories
  FOR SELECT TO authenticated USING (account_id IS NULL OR public.is_account_member(account_id));
CREATE POLICY "Owners can add categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (account_id IS NOT NULL AND public.is_account_owner(account_id));
CREATE POLICY "Owners can update categories" ON public.categories
  FOR UPDATE TO authenticated USING (account_id IS NOT NULL AND public.is_account_owner(account_id))
  WITH CHECK (account_id IS NOT NULL AND public.is_account_owner(account_id));

-- Seed global default categories
INSERT INTO public.categories (account_id, name, is_default) VALUES
  (NULL, 'Flights', true),
  (NULL, 'Accommodation', true),
  (NULL, 'Deposit', true),
  (NULL, 'Fuel', true),
  (NULL, 'Transport', true),
  (NULL, 'Food', true),
  (NULL, 'Activities', true),
  (NULL, 'Entertainment', true),
  (NULL, 'Shopping', true),
  (NULL, 'Other', true);

-- ============ TRIPS ============
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  end_date date,
  notes text,
  status public.trip_status NOT NULL DEFAULT 'planning',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX idx_trips_account ON public.trips(account_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view trips" ON public.trips
  FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "Members can create trips" ON public.trips
  FOR INSERT TO authenticated WITH CHECK (public.is_account_member(account_id) AND created_by = auth.uid());
CREATE POLICY "Members can update trips, owners can archive" ON public.trips
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

-- ============ EXPENSES ============
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  category_id uuid REFERENCES public.categories(id),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  notes text,
  split_method public.split_method NOT NULL DEFAULT 'equal',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX idx_expenses_trip ON public.expenses(trip_id);
CREATE INDEX idx_expenses_account ON public.expenses(account_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view expenses" ON public.expenses
  FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "Members can create expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (public.is_account_member(account_id) AND created_by = auth.uid());
CREATE POLICY "Creators or owners can update expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_account_owner(account_id))
  WITH CHECK (created_by = auth.uid() OR public.is_account_owner(account_id));

-- ============ EXPENSE CONTRIBUTIONS ============
CREATE TABLE public.expense_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.account_members(id),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contrib_expense ON public.expense_contributions(expense_id);
CREATE INDEX idx_contrib_member ON public.expense_contributions(member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_contributions TO authenticated;
GRANT ALL ON public.expense_contributions TO service_role;
ALTER TABLE public.expense_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view contributions" ON public.expense_contributions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_id AND public.is_account_member(e.account_id))
  );
CREATE POLICY "Members manage contributions for their expenses" ON public.expense_contributions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_id
      AND (e.created_by = auth.uid() OR public.is_account_owner(e.account_id)))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_id
      AND (e.created_by = auth.uid() OR public.is_account_owner(e.account_id)))
  );

-- ============ EXPENSE SHARES (participant inclusion + percentage) ============
CREATE TABLE public.expense_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.account_members(id),
  percentage numeric(6,3), -- null for equal split
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expense_id, member_id)
);
CREATE INDEX idx_shares_expense ON public.expense_shares(expense_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_shares TO authenticated;
GRANT ALL ON public.expense_shares TO service_role;
ALTER TABLE public.expense_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view shares" ON public.expense_shares
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_id AND public.is_account_member(e.account_id))
  );
CREATE POLICY "Members manage shares for their expenses" ON public.expense_shares
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_id
      AND (e.created_by = auth.uid() OR public.is_account_owner(e.account_id)))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_id
      AND (e.created_by = auth.uid() OR public.is_account_owner(e.account_id)))
  );

-- ============ SETTLEMENTS ============
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  from_member_id uuid NOT NULL REFERENCES public.account_members(id),
  to_member_id uuid NOT NULL REFERENCES public.account_members(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK (from_member_id <> to_member_id)
);
CREATE INDEX idx_settlements_account ON public.settlements(account_id);
CREATE INDEX idx_settlements_trip ON public.settlements(trip_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view settlements" ON public.settlements
  FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "Owners record settlements" ON public.settlements
  FOR INSERT TO authenticated WITH CHECK (public.is_account_owner(account_id) AND created_by = auth.uid());
CREATE POLICY "Owners update settlements" ON public.settlements
  FOR UPDATE TO authenticated USING (public.is_account_owner(account_id)) WITH CHECK (public.is_account_owner(account_id));

-- Auto-link account_members.user_id when a user signs up with a matching email
CREATE OR REPLACE FUNCTION public.link_member_to_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.account_members
    SET user_id = NEW.id
  WHERE email IS NOT NULL
    AND lower(email) = lower(NEW.email)
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_link_member
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_member_to_user();
