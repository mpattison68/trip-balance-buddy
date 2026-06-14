CREATE TABLE public.trip_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.account_members(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, member_id)
);
CREATE INDEX trip_participants_trip_idx ON public.trip_participants(trip_id);
CREATE INDEX trip_participants_member_idx ON public.trip_participants(member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_participants TO authenticated;
GRANT ALL ON public.trip_participants TO service_role;

ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view trip participants"
ON public.trip_participants FOR SELECT TO authenticated
USING (public.is_account_member(account_id));

CREATE POLICY "Members can add trip participants"
ON public.trip_participants FOR INSERT TO authenticated
WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Members can remove trip participants"
ON public.trip_participants FOR DELETE TO authenticated
USING (public.is_account_member(account_id));

-- Backfill: for existing trips, add all active members as participants
INSERT INTO public.trip_participants (trip_id, member_id, account_id)
SELECT t.id, m.id, t.account_id
FROM public.trips t
JOIN public.account_members m ON m.account_id = t.account_id AND m.archived_at IS NULL
ON CONFLICT DO NOTHING;