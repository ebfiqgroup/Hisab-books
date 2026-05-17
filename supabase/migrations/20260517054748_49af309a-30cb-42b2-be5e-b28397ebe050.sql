
-- 1. Storage: remove broad SELECT policy that allows listing the avatars bucket.
-- Files remain accessible via their public URL because the bucket itself is public.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- 2. Trigger functions: revoke direct EXECUTE from everyone (triggers run as table owner).
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 3. Admin-only RPCs: revoke from anon (public), keep authenticated.
REVOKE ALL ON FUNCTION public.claim_admin_if_none() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_none() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- 4. has_role is referenced by RLS policies; needed by authenticated users. Revoke anon.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
