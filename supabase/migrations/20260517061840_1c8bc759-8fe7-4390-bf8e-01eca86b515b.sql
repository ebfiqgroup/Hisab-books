
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- tickets policies
CREATE POLICY "tickets select own" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tickets insert own" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tickets update own" ON public.support_tickets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tickets delete own" ON public.support_tickets FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "tickets admin all select" ON public.support_tickets FOR SELECT USING (has_role(auth.uid(),'admin'));
CREATE POLICY "tickets admin all update" ON public.support_tickets FOR UPDATE USING (has_role(auth.uid(),'admin'));
CREATE POLICY "tickets admin all delete" ON public.support_tickets FOR DELETE USING (has_role(auth.uid(),'admin'));

-- messages policies
CREATE POLICY "msgs select own ticket" ON public.support_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "msgs insert own ticket" ON public.support_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND is_admin = false AND
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "msgs admin select" ON public.support_messages FOR SELECT USING (has_role(auth.uid(),'admin'));
CREATE POLICY "msgs admin insert" ON public.support_messages FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin') AND sender_id = auth.uid());
CREATE POLICY "msgs admin delete" ON public.support_messages FOR DELETE USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- bump ticket updated_at on new message
CREATE OR REPLACE FUNCTION public.bump_ticket_on_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.support_tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_support_msg_bump AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_ticket_on_message();
