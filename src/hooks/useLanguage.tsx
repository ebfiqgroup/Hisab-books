import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type Lang = "bn" | "en";
const KEY = "app_lang_v1";

const dict = {
  bn: {
    "nav.dashboard": "ড্যাশবোর্ড",
    "nav.income": "আয়",
    "nav.expense": "ব্যয়",
    "nav.transactions": "লেনদেন",
    "nav.budget": "বাজেট",
    "nav.goals": "লক্ষ্য",
    "nav.debts": "পাওনা/দেনা",
    "nav.report": "রিপোর্ট",
    "nav.calendar": "ক্যালেন্ডার",
    "nav.support": "সাপোর্ট",
    "nav.settings": "সেটিংস",
    "nav.admin": "অ্যাডমিন",
    "nav.audit": "অডিট লগ",
    "brand.title": "আমার হিসাব",
    "brand.subtitle": "Personal Finance",
    "brand.quote": "আর্থিক শৃঙ্খলাই\nসফলতার চাবিকাঠি",
    "header.notifications": "নোটিফিকেশন",
    "header.noNotifications": "কোনো নতুন নোটিফিকেশন নেই",
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
    "nav.budget": "Budget",
    "nav.goals": "Goals",
    "nav.debts": "Debts",
    "nav.report": "Report",
    "nav.calendar": "Calendar",
    "nav.support": "Support",
    "nav.settings": "Settings",
    "nav.admin": "Admin",
    "nav.audit": "Audit Log",
    "brand.title": "My Finance",
    "brand.subtitle": "Personal Finance",
    "brand.quote": "Financial discipline is\nthe key to success",
    "header.notifications": "Notifications",
    "header.noNotifications": "No new notifications",
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
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      if (saved === "bn" || saved === "en") setLangState(saved);
    } catch { /* noop */ }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* noop */ }
    if (typeof document !== "undefined") document.documentElement.lang = l;
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
