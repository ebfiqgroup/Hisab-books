import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";
const KEY = "app_theme_v1";

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = t;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    let initial: Theme = "light";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") initial = v;
      else if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        initial = "dark";
      }
    } catch { /* noop */ }
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(KEY, t); } catch { /* noop */ }
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}