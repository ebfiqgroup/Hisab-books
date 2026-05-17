
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  record_id uuid,
  target_user_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX idx_audit_logs_table ON public.audit_logs (table_name);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit admin select" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
  v_target uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_record_id := (v_old->>'id')::uuid;
    v_target := COALESCE((v_old->>'user_id')::uuid, (v_old->>'id')::uuid);
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
    v_target := COALESCE((v_new->>'user_id')::uuid, (v_new->>'id')::uuid);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
    v_target := COALESCE((v_new->>'user_id')::uuid, (v_new->>'id')::uuid);
  END IF;

  INSERT INTO public.audit_logs (actor_id, table_name, operation, record_id, target_user_id, old_data, new_data)
  VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, v_record_id, v_target, v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit() FROM PUBLIC, anon, authenticated;

-- Attach to all user-data tables
CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_budgets     AFTER INSERT OR UPDATE OR DELETE ON public.budgets     FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_debts       AFTER INSERT OR UPDATE OR DELETE ON public.debts       FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_goals       AFTER INSERT OR UPDATE OR DELETE ON public.goals       FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_notes       AFTER INSERT OR UPDATE OR DELETE ON public.notes       FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_plan_tasks  AFTER INSERT OR UPDATE OR DELETE ON public.plan_tasks  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_profiles    AFTER INSERT OR UPDATE OR DELETE ON public.profiles    FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_user_roles  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
