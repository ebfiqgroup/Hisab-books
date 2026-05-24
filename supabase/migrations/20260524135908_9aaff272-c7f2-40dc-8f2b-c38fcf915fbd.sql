
-- Admin INSERT policy for support_tickets
CREATE POLICY "tickets admin all insert"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Strengthen user_roles UPDATE: add WITH CHECK to admin update policy
DROP POLICY IF EXISTS "roles admin update" ON public.user_roles;
CREATE POLICY "roles admin update"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Restrictive policy to block any non-admin UPDATE path
CREATE POLICY "roles block non-admin update"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
