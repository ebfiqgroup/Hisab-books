
-- 1) Add status column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'suspended'));

-- 2) Backfill: all existing users become 'approved' (so we don't lock anyone out)
UPDATE public.profiles SET status = 'approved' WHERE status = 'pending';

-- 3) Update handle_new_user to set status='pending' for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'pending'
  );
  RETURN new;
END;
$$;

-- 4) Admin RPC to set user status
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _status NOT IN ('pending', 'approved', 'suspended') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  IF _user_id = auth.uid() AND _status <> 'approved' THEN
    RAISE EXCEPTION 'cannot change your own status';
  END IF;

  UPDATE public.profiles SET status = _status, updated_at = now()
  WHERE id = _user_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) TO authenticated;

-- 5) Allow user to read own status (already covered by "Users view own profile")
-- Admin can already view/update all via existing policies.
