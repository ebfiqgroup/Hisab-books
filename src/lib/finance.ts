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

export const categoryColor = (k: string) =>
  CATEGORIES.find((c) => c.key === k)?.color ?? "#9ca3af";

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