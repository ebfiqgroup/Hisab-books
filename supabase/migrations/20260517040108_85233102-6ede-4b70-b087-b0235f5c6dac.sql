-- Clear existing budgets and extend schema for custom date/time ranges
DELETE FROM public.budgets;

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS start_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS end_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');

-- monthly_limit historically required; keep but allow rename via amount alias
ALTER TABLE public.budgets ALTER COLUMN monthly_limit SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS budgets_user_range_idx ON public.budgets (user_id, start_at, end_at);