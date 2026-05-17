CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL,
  message TEXT,
  source TEXT DEFAULT 'landing_footer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit a lead"
ON public.leads FOR INSERT
TO anon, authenticated
WITH CHECK (email IS NOT NULL AND length(email) BETWEEN 3 AND 320);

CREATE POLICY "admin can view leads"
ON public.leads FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin can delete leads"
ON public.leads FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_leads_created_at ON public.leads (created_at DESC);