-- 1. Block direct API inserts into audit_logs by authenticated/anon users
CREATE POLICY "audit_logs block direct user inserts"
ON public.audit_logs
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- 2. Prevent users from changing their own profile status (only admins can)
CREATE OR REPLACE FUNCTION public.prevent_profile_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_status_change ON public.profiles;
CREATE TRIGGER profiles_prevent_status_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_status_change();

-- 3. Restrict writes on subscriptions to service role only
CREATE POLICY "subscriptions block user writes"
ON public.subscriptions
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);