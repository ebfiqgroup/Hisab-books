export const CATEGORIES = [
  { key: "খাবার", color: "#10b981" },
  { key: "বাসা ভাড়া", color: "#f43f5e" },
  { key: "পরিবহন", color: "#6366f1" },
  { key: "শিক্ষা", color: "#3b82f6" },
  { key: "বিনোদন", color: "#2563eb" },
  { key: "স্বাস্থ্য", color: "#f97316" },
  { key: "বেতন", color: "#10b981" },
  { key: "ফ্রিল্যান্স", color: "#22c55e" },
  { key: "অন্যান্য", color: "#9ca3af" },
] as const;

const PALETTE = ["#10b981", "#f43f5e", "#6366f1", "#3b82f6", "#2563eb", "#f97316", "#22c55e", "#a855f7", "#0ea5e9", "#ec4899", "#eab308", "#14b8a6"];
const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
export const categoryColor = (k: string) => {
  const found = CATEGORIES.find((c) => c.key === k)?.color;
  if (found) return found;
  return PALETTE[hashStr(k) % PALETTE.length];
};

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export const toBn = (s: string | number) =>
  String(s).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);

export const fmtTk = (n: number) => `৳ ${toBn(Math.round(n).toLocaleString("en-US"))}`;

export const monthBounds = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { startISO: iso(start), endISO: iso(end), prevStartISO: iso(prevStart) };
};

export const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

export const pctChange = (cur: number, prev: number): { value: string; up: boolean } => {
  if (prev === 0) return { value: cur === 0 ? "0%" : "100%", up: cur >= 0 };
  const p = ((cur - prev) / prev) * 100;
  return { value: `${toBn(Math.abs(p).toFixed(1))}%`, up: p >= 0 };
};

// ---------- Custom categories (per type, persisted in localStorage) ----------
export type TxnType = "income" | "expense";
export type CustomCatMap = { income: string[]; expense: string[] };

export const CUSTOM_CAT_LS_KEY = "custom_categories_v2";
export const CUSTOM_CAT_EVENT = "custom_categories_changed";

export const BUILTIN_CATS: Record<TxnType, string[]> = {
  income: ["বেতন", "ফ্রিল্যান্স", "অন্যান্য"],
  expense: ["খাবার", "বাসা ভাড়া", "পরিবহন", "শিক্ষা", "বিনোদন", "স্বাস্থ্য", "অন্যান্য"],
};

export const loadCustomCats = (): CustomCatMap => {
  if (typeof window === "undefined") return { income: [], expense: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_CAT_LS_KEY) || "null");
    if (raw && Array.isArray(raw.income) && Array.isArray(raw.expense)) return raw;
  } catch { /* ignore */ }
  try {
    const old = JSON.parse(localStorage.getItem("custom_categories_v1") || "[]");
    if (Array.isArray(old)) return { income: [], expense: old };
  } catch { /* ignore */ }
  return { income: [], expense: [] };
};

export const saveCustomCats = (map: CustomCatMap) => {
  localStorage.setItem(CUSTOM_CAT_LS_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(CUSTOM_CAT_EVENT));
};

export const allCatsForType = (type: TxnType, map?: CustomCatMap): string[] => {
  const m = map ?? loadCustomCats();
  return [...BUILTIN_CATS[type], ...m[type]];
};

export const allCatsCombined = (map?: CustomCatMap): string[] => {
  const m = map ?? loadCustomCats();
  const set = new Set<string>([...BUILTIN_CATS.income, ...BUILTIN_CATS.expense, ...m.income, ...m.expense]);
  return Array.from(set);
};