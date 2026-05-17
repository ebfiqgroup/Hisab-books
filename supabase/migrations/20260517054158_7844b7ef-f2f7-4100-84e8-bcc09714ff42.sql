
-- Admin full access policies for all user-data tables

-- transactions
CREATE POLICY "tx admin insert all" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tx admin update all" ON public.transactions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tx admin delete all" ON public.transactions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- budgets
CREATE POLICY "budgets admin insert all" ON public.budgets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "budgets admin update all" ON public.budgets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "budgets admin delete all" ON public.budgets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- debts
CREATE POLICY "debts admin insert all" ON public.debts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "debts admin update all" ON public.debts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "debts admin delete all" ON public.debts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- goals
CREATE POLICY "goals admin insert all" ON public.goals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "goals admin update all" ON public.goals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "goals admin delete all" ON public.goals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- notes
CREATE POLICY "notes admin view all" ON public.notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notes admin insert all" ON public.notes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notes admin update all" ON public.notes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notes admin delete all" ON public.notes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- plan_tasks
CREATE POLICY "plan admin view all" ON public.plan_tasks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "plan admin insert all" ON public.plan_tasks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "plan admin update all" ON public.plan_tasks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "plan admin delete all" ON public.plan_tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "profiles admin update all" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles admin delete all" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin function to fully delete a user account (auth + cascade data)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot delete your own account';
  END IF;

  DELETE FROM public.transactions WHERE user_id = _user_id;
  DELETE FROM public.budgets WHERE user_id = _user_id;
  DELETE FROM public.debts WHERE user_id = _user_id;
  DELETE FROM public.goals WHERE user_id = _user_id;
  DELETE FROM public.notes WHERE user_id = _user_id;
  DELETE FROM public.plan_tasks WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
