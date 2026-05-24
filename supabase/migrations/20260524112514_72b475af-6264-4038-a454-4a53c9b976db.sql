ALTER TABLE public.budgets ADD COLUMN status text;
ALTER TABLE public.goals ADD COLUMN status text;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_status_check CHECK (status IS NULL OR status IN ('pending','ongoing','completed'));
ALTER TABLE public.goals ADD CONSTRAINT goals_status_check CHECK (status IS NULL OR status IN ('pending','ongoing','completed'));