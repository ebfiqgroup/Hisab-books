
CREATE TABLE public.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role app_role NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX role_requests_user_id_idx ON public.role_requests(user_id);
CREATE INDEX role_requests_status_idx ON public.role_requests(status);

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own role requests" ON public.role_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users view own role requests" ON public.role_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "super admin view all role requests" ON public.role_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super admin update role requests" ON public.role_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER role_requests_set_updated_at
  BEFORE UPDATE ON public.role_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.approve_role_request(_request_id uuid, _note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not authorized: super admin only';
  END IF;
  SELECT * INTO r FROM public.role_requests WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found or already processed';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (r.user_id, r.requested_role)
  ON CONFLICT DO NOTHING;
  UPDATE public.role_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note
    WHERE id = _request_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_role_request(_request_id uuid, _note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not authorized: super admin only';
  END IF;
  UPDATE public.role_requests
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note
    WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found or already processed';
  END IF;
  RETURN true;
END;
$$;
