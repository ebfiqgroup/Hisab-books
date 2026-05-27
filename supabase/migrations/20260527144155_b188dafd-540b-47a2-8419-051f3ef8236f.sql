DROP POLICY IF EXISTS "avatars authenticated read all" ON storage.objects;

DROP POLICY IF EXISTS "tickets update own" ON public.support_tickets;
CREATE POLICY "tickets update own"
ON public.support_tickets
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "msgs insert own ticket" ON public.support_messages;
CREATE POLICY "msgs insert own ticket"
ON public.support_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND is_admin = false
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()
  )
);