import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { setFinanceLang } from "@/lib/finance";

export type Lang = "bn" | "en";
const KEY = "app_lang_v1";

// Set a cookie at the root domain so Google Translate's element picks it up.
function setGoogTransCookie(lang: Lang) {
  if (typeof document === "undefined") return;
  const value = lang === "en" ? "/bn/en" : "/bn/bn";
  const host = window.location.hostname;
  // Derive parent domain so subdomains share the cookie (e.g. .lovable.app)
  const parts = host.split(".");
  const parent = parts.length > 1 ? "." + parts.slice(-2).join(".") : host;
  const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toUTCString();
  document.cookie = `googtrans=${value}; expires=${expires}; path=/`;
  document.cookie = `googtrans=${value}; expires=${expires}; path=/; domain=${host}`;
  document.cookie = `googtrans=${value}; expires=${expires}; path=/; domain=${parent}`;
}

const dict = {
  bn: {
    "nav.dashboard": "ড্যাশবোর্ড",
    "nav.income": "আয়",
    "nav.expense": "ব্যয়",
    "nav.transactions": "লেনদেন",
    "nav.budget": "বাজেট ও পরিকল্পনা",
    "nav.goals": "লক্ষ্য",
    "nav.debts": "দেনা / পাওনা",
    "nav.report": "রিপোর্ট",
    "nav.calendar": "ক্যালেন্ডার",
    "nav.notes": "নোটস",
    "nav.support": "সাপোর্ট",
    "nav.settings": "সেটিংস",
    "nav.admin": "অ্যাডমিন",
    "nav.allDashboards": "সব ড্যাশবোর্ড",
    "nav.superAdmin": "সুপার অ্যাডমিন",
    "nav.audit": "অডিট লগ",
    "brand.title": "আমার হিসাব",
    "brand.subtitle": "Personal Finance",
    "brand.quote": "আর্থিক শৃঙ্খলাই\nসফলতার চাবিকাঠি",
    "header.notifications": "নোটিফিকেশন",
    "header.noNotifications": "কোনো নতুন নোটিফিকেশন নেই",
    "header.facebook": "ফেসবুক পেজ",
    "header.profile": "প্রোফাইল",
    "header.settings": "সেটিংস",
    "header.signOut": "সাইন আউট",
    "header.you": "আপনি",
    "lang.toggle": "EN",
    "lang.label": "ভাষা",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.income": "Income",
    "nav.expense": "Expense",
    "nav.transactions": "Transactions",
    "nav.budget": "Budget & Plans",
    "nav.goals": "Goals",
    "nav.debts": "Debts / Receivables",
    "nav.report": "Report",
    "nav.calendar": "Calendar",
    "nav.notes": "Notes",
    "nav.support": "Support",
    "nav.settings": "Settings",
    "nav.admin": "Admin",
    "nav.allDashboards": "All Dashboards",
    "nav.superAdmin": "Super Admin",
    "nav.audit": "Audit Log",
    "brand.title": "My Finance",
    "brand.subtitle": "Personal Finance",
    "brand.quote": "Financial discipline is\nthe key to success",
    "header.notifications": "Notifications",
    "header.noNotifications": "No new notifications",
    "header.facebook": "Facebook Page",
    "header.profile": "Profile",
    "header.settings": "Settings",
    "header.signOut": "Sign out",
    "header.you": "You",
    "lang.toggle": "বাং",
    "lang.label": "Language",
  },
} as const;

export type TKey = keyof typeof dict["bn"];

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /**
   * Translate. Two usages:
   *   t("nav.dashboard")           // looks up in central dict (TKey)
   *   t("বাংলা টেক্সট", "English text")  // inline bilingual pair
   */
  t: (bnOrKey: string, en?: string) => string;
};
const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");

  useEffect(() => {
    let saved: Lang = "bn";
    let hasSaved = false;
    try {
      const v = localStorage.getItem(KEY);
      if (v === "en" || v === "bn") { saved = v; hasSaved = true; }
    } catch { /* noop */ }
    // First visit: detect from browser language. Bengali speakers → bn,
    // everyone else → en.
    if (!hasSaved && typeof navigator !== "undefined") {
      const langs: string[] = [
        ...(Array.isArray(navigator.languages) ? navigator.languages : []),
        navigator.language,
      ].filter(Boolean) as string[];
      const isBengali = langs.some((l) => l.toLowerCase().startsWith("bn"));
      saved = isBengali ? "bn" : "en";
      try { localStorage.setItem(KEY, saved); } catch { /* noop */ }
    }
    setLangState(saved);
    setFinanceLang(saved);
    // Keep the document lang as "bn" (the source content language) so Google
    // Translate knows what to translate FROM. Changing it to "en" makes
    // Google Translate think the page is already English and skip user-
    // generated content (categories, notes, goals, etc.).
    if (typeof document !== "undefined") document.documentElement.lang = "bn";
    setGoogTransCookie(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setFinanceLang(l);
    try { localStorage.setItem(KEY, l); } catch { /* noop */ }
    if (typeof document !== "undefined") document.documentElement.lang = "bn";
    setGoogTransCookie(l);
    // Google Translate only re-evaluates page content on load. Force a
    // reload so user-generated content (categories, notes, goal labels,
    // transactions, budgets, debts, etc.) is re-translated to the new
    // language without the user having to refresh manually.
    if (typeof window !== "undefined") {
      // small delay so the cookie write and state update flush first
      setTimeout(() => { try { window.location.reload(); } catch { /* noop */ } }, 50);
    }
  }, []);

  const toggle = useCallback(() => setLang(lang === "bn" ? "en" : "bn"), [lang, setLang]);

  const t = useCallback(
    (bnOrKey: string, en?: string) => {
      if (typeof en === "string") return lang === "bn" ? bnOrKey : en;
      const k = bnOrKey as TKey;
      return (dict[lang] as Record<string, string>)[k] ?? (dict.bn as Record<string, string>)[k] ?? bnOrKey;
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
