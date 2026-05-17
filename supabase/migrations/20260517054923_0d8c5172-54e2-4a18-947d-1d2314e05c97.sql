
-- Defense-in-depth: RESTRICTIVE policy to absolutely prevent non-admins from inserting into user_roles
CREATE POLICY "roles block non-admin insert"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Owner-scoped SELECT policy for avatars (public URLs still work via CDN)
CREATE POLICY "Users can list their own avatar files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
