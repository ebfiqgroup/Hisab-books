
-- Auto-approve new signups so they can log in immediately with basic free access
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'approved';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'approved'
  );
  RETURN new;
END;
$function$;

-- Approve any existing pending users so they can log in
UPDATE public.profiles SET status = 'approved' WHERE status = 'pending';
