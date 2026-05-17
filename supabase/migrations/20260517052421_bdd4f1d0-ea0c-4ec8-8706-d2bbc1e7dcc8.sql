-- 1. Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS for user_roles
DROP POLICY IF EXISTS "roles select own or admin" ON public.user_roles;
CREATE POLICY "roles select own or admin" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "roles admin insert" ON public.user_roles;
CREATE POLICY "roles admin insert" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "roles admin update" ON public.user_roles;
CREATE POLICY "roles admin update" ON public.user_roles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "roles admin delete" ON public.user_roles;
CREATE POLICY "roles admin delete" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 5. Admin-wide read policies on existing tables
DROP POLICY IF EXISTS "profiles admin view all" ON public.profiles;
CREATE POLICY "profiles admin view all" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "tx admin view all" ON public.transactions;
CREATE POLICY "tx admin view all" ON public.transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "budgets admin view all" ON public.budgets;
CREATE POLICY "budgets admin view all" ON public.budgets
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "goals admin view all" ON public.goals;
CREATE POLICY "goals admin view all" ON public.goals
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "debts admin view all" ON public.debts;
CREATE POLICY "debts admin view all" ON public.debts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 6. Helpful admin view: per-user aggregates
CREATE OR REPLACE VIEW public.admin_user_overview
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.created_at,
  COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS total_income,
  COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS total_expense,
  COUNT(t.id) AS tx_count,
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin') AS is_admin
FROM public.profiles p
LEFT JOIN public.transactions t ON t.user_id = p.id
GROUP BY p.id;