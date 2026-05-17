
-- Add ref_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ref_code text UNIQUE;

-- Function to generate an 8-char unique ref code (avoid ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_ref_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
  tries int := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE ref_code = code);
    tries := tries + 1;
    IF tries > 20 THEN
      RAISE EXCEPTION 'could not generate unique ref_code';
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- Backfill existing users
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE ref_code IS NULL LOOP
    UPDATE public.profiles SET ref_code = public.generate_ref_code() WHERE id = r.id;
  END LOOP;
END $$;

-- Update handle_new_user to assign ref_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, status, ref_code)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'approved',
    public.generate_ref_code()
  );
  RETURN new;
END;
$function$;

-- Recreate admin_user_overview to include ref_code
DROP VIEW IF EXISTS public.admin_user_overview;
CREATE VIEW public.admin_user_overview
WITH (security_invoker=true)
AS
SELECT p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.ref_code,
  p.created_at,
  p.status,
  COALESCE(sum(CASE WHEN t.type = 'income'::txn_type THEN t.amount ELSE 0 END), 0) AS total_income,
  COALESCE(sum(CASE WHEN t.type = 'expense'::txn_type THEN t.amount ELSE 0 END), 0) AS total_expense,
  count(t.id) AS tx_count,
  EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role) AS is_admin
FROM public.profiles p
LEFT JOIN public.transactions t ON t.user_id = p.id
GROUP BY p.id;
