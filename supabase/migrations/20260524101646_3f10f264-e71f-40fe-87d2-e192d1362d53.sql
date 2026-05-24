
-- 1) Make feedback bucket private + owner-scoped storage policies
UPDATE storage.buckets SET public = false WHERE id = 'feedback';

DROP POLICY IF EXISTS "feedback owner select" ON storage.objects;
DROP POLICY IF EXISTS "feedback owner insert" ON storage.objects;
DROP POLICY IF EXISTS "feedback owner update" ON storage.objects;
DROP POLICY IF EXISTS "feedback owner delete" ON storage.objects;
DROP POLICY IF EXISTS "feedback admin all" ON storage.objects;

CREATE POLICY "feedback owner select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'feedback' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "feedback owner insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'feedback' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "feedback owner update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'feedback' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "feedback owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'feedback' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "feedback admin all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'feedback' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'feedback' AND public.has_role(auth.uid(), 'admin'));

-- 2) Realtime authorization: restrict channel topics to owner
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rt user own topic" ON realtime.messages;
DROP POLICY IF EXISTS "rt admin all topics" ON realtime.messages;

CREATE POLICY "rt user own topic" ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() = 'rt-user-' || (auth.uid())::text
);

CREATE POLICY "rt admin all topics" ON realtime.messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3) Tighten user_roles insert policy to authenticated only
DROP POLICY IF EXISTS "roles admin insert" ON public.user_roles;
CREATE POLICY "roles admin insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
