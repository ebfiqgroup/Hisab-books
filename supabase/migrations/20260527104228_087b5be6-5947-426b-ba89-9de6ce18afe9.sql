UPDATE storage.buckets SET public = false WHERE id = 'avatars';

CREATE POLICY "avatars authenticated read all" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "avatars admin all" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role));