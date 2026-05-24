
-- Helper: super-admin only role mutation RPCs (bypass policy complexity)
CREATE OR REPLACE FUNCTION public.admin_grant_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not authorized: super admin only';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not authorized: super admin only';
  END IF;
  IF _user_id = auth.uid() AND _role = 'super_admin' THEN
    RAISE EXCEPTION 'cannot remove your own super admin role';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  RETURN true;
END;
$$;

-- Replace claim function: first claimer becomes BOTH admin and super_admin
CREATE OR REPLACE FUNCTION public.claim_admin_if_none()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin','super_admin')) THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'super_admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

-- Tighten RLS on user_roles: only super_admin can directly insert/update/delete
DROP POLICY IF EXISTS "roles admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "roles admin update" ON public.user_roles;
DROP POLICY IF EXISTS "roles admin delete" ON public.user_roles;
DROP POLICY IF EXISTS "roles block non-admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "roles block non-admin update" ON public.user_roles;

CREATE POLICY "roles super_admin insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "roles super_admin update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "roles super_admin delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "roles block non-super insert" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "roles block non-super update" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));
