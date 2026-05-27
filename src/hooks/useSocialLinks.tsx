import { useEffect, useState } from "react";

const KEY = "social_links_v1";
const DEFAULT_FB = "https://www.facebook.com";

export type SocialLinks = { facebook: string };

export function loadSocialLinks(): SocialLinks {
  if (typeof window === "undefined") return { facebook: DEFAULT_FB };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { facebook: DEFAULT_FB };
    const parsed = JSON.parse(raw);
    return { facebook: typeof parsed?.facebook === "string" && parsed.facebook ? parsed.facebook : DEFAULT_FB };
  } catch { return { facebook: DEFAULT_FB }; }
}

export function setSocialLinks(next: SocialLinks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("social-links-changed", { detail: next }));
  } catch { /* noop */ }
}

export function useSocialLinks(): SocialLinks {
  const [links, setLinks] = useState<SocialLinks>(() => loadSocialLinks());
  useEffect(() => {
    setLinks(loadSocialLinks());
    const onChange = () => setLinks(loadSocialLinks());
    window.addEventListener("social-links-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("social-links-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return links;
}