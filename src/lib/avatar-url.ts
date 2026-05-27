import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SIGN_MARKER = `/storage/v1/object/sign/${BUCKET}/`;

/** Extract the in-bucket object path from any stored avatar reference. */
export function extractAvatarPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  // Already a path (no protocol)
  if (!/^https?:\/\//i.test(v)) return v.replace(/^\/+/, "");
  // Public URL from our bucket
  const pubIdx = v.indexOf(PUBLIC_MARKER);
  if (pubIdx >= 0) return v.slice(pubIdx + PUBLIC_MARKER.length).split("?")[0];
  // Already-signed URL from our bucket
  const signIdx = v.indexOf(SIGN_MARKER);
  if (signIdx >= 0) return v.slice(signIdx + SIGN_MARKER.length).split("?")[0];
  // External URL → not in our bucket
  return null;
}

/** Resolve any avatar reference to a usable URL (signs bucket paths on demand). */
export async function resolveAvatarUrl(value: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  if (!value) return null;
  const path = extractAvatarPath(value);
  if (!path) return value; // external URL — return as-is
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

/** React hook: returns a signed (or external) avatar URL, re-signing when the input changes. */
export function useAvatarUrl(value: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!value) { setUrl(null); return; }
    resolveAvatarUrl(value).then((r) => { if (!cancelled) setUrl(r); });
    return () => { cancelled = true; };
  }, [value]);
  return url;
}