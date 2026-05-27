import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import {
  LogOut, User as UserIcon, KeyRound, SlidersHorizontal, Sparkles,
  Download, Upload, Trash2, AlertTriangle, Save, ImagePlus, Languages, Coins,
} from "lucide-react";
import { getFinanceSymbol, setFinanceSymbol, fmtTk } from "@/lib/finance";
import { loadSocialLinks, setSocialLinks } from "@/hooks/useSocialLinks";
import { useAvatarUrl } from "@/lib/avatar-url";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

type Profile = { id: string; full_name: string | null; avatar_url: string | null; ref_code: string | null };

type Prefs = {
  chartRange: "সাপ্তাহিক" | "মাসিক" | "বার্ষিক";
  donutView: "expense" | "income";
  language: "bn" | "en";
};
const PREF_KEY = "app_prefs_v1";
const DEFAULT_PREFS: Prefs = { chartRange: "সাপ্তাহিক", donutView: "expense", language: "bn" };

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

type AiCfg = {
  types: ("alert" | "tip" | "invest")[];
  expenseRatioPct: number;
  lowCashTk: number;
  goalLagPct: number;
  autoRun: boolean;
  autoIntervalMin: number;
};
const AI_KEY = "ai_alert_config_v1";
const DEFAULT_AI: AiCfg = {
  types: ["alert", "tip", "invest"],
  expenseRatioPct: 80,
  lowCashTk: 5000,
  goalLagPct: 20,
  autoRun: true,
  autoIntervalMin: 30,
};
function loadAi(): AiCfg {
  if (typeof window === "undefined") return DEFAULT_AI;
  try {
    const raw = localStorage.getItem(AI_KEY);
    return raw ? { ...DEFAULT_AI, ...JSON.parse(raw) } : DEFAULT_AI;
  } catch { return DEFAULT_AI; }
}

const TABLES = ["transactions", "budgets", "goals", "debts", "notes", "plan_tasks"] as const;

function SettingsPage() {
  const qc = useQueryClient();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [ai, setAi] = useState<AiCfg>(DEFAULT_AI);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [currency, setCurrency] = useState<string>("৳");
  const [customCurrency, setCustomCurrency] = useState<string>("");
  const [facebookUrl, setFacebookUrl] = useState<string>("");

  useEffect(() => {
    setPrefs(loadPrefs());
    setAi(loadAi());
    setCurrency(getFinanceSymbol());
    setFacebookUrl(loadSocialLinks().facebook);
  }, []);

  const CURRENCY_PRESETS: { sym: string; name: string }[] = [
    { sym: "৳", name: t("টাকা", "Taka") },
    { sym: "$", name: t("ডলার", "Dollar") },
    { sym: "€", name: t("ইউরো", "Euro") },
    { sym: "£", name: t("পাউন্ড", "Pound") },
    { sym: "₹", name: t("রুপি", "Rupee") },
    { sym: "¥", name: t("ইয়েন", "Yen") },
    { sym: "﷼", name: t("রিয়াল", "Riyal") },
    { sym: "د.إ", name: t("দিরহাম", "Dirham") },
  ];

  const applyCurrency = (sym: string) => {
    const s = (sym ?? "").trim();
    if (!s) { toast.error(t("চিহ্ন দিন", "Enter a symbol")); return; }
    const cps = [...s];
    if (cps.length < 1 || cps.length > 4) {
      toast.error(t("চিহ্ন ১ থেকে ৪ অক্ষরের হতে হবে", "Symbol must be 1–4 characters"));
      return;
    }
    // Reject control, format, whitespace, and surrogate codepoints
    if (/[\p{C}\p{Z}]/u.test(s)) {
      toast.error(t("অবৈধ অক্ষর রয়েছে", "Contains invalid characters"));
      return;
    }
    // Allow only Letters, Numbers, Symbols, Punctuation (safe Unicode range)
    if (!/^[\p{L}\p{N}\p{S}\p{P}]+$/u.test(s)) {
      toast.error(t("শুধু অক্ষর/সংখ্যা/চিহ্ন ব্যবহার করুন", "Only letters, numbers and symbols allowed"));
      return;
    }
    setFinanceSymbol(s);
    setCurrency(s);
    toast.success(t("মুদ্রা চিহ্ন আপডেট হয়েছে", "Currency symbol updated"));
    setTimeout(() => window.location.reload(), 200);
  };

  const q = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,avatar_url,ref_code").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
  useEffect(() => {
    if (q.data) {
      setName(q.data.full_name ?? "");
      setAvatar(q.data.avatar_url ?? "");
    }
  }, [q.data]);

  const saveProfile = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name, avatar_url: avatar || null }).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("প্রোফাইল আপডেট হয়েছে", "Profile updated"));
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const changePwd = async () => {
    if (newPwd.length < 6) { toast.error(t("পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে", "Password must be at least 6 characters")); return; }
    if (newPwd !== confirmPwd) { toast.error(t("পাসওয়ার্ড মিলছে না", "Passwords do not match")); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("পাসওয়ার্ড পরিবর্তিত", "Password changed"));
    setNewPwd(""); setConfirmPwd("");
  };

  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
      // Keep dashboard-specific keys in sync
      localStorage.setItem("dashboard_chart_range", next.chartRange);
      localStorage.setItem("dashboard_donut_view", next.donutView);
    } catch { /* noop */ }
    toast.success(t("প্রেফারেন্স সংরক্ষিত", "Preferences saved"));
  };

  const saveAi = (next: AiCfg) => {
    setAi(next);
    try { localStorage.setItem(AI_KEY, JSON.stringify(next)); } catch { /* noop */ }
    toast.success(t("AI সেটিংস সংরক্ষিত", "AI settings saved"));
  };

  const toggleAiType = (kind: "alert" | "tip" | "invest") => {
    const next = { ...ai, types: ai.types.includes(kind) ? ai.types.filter((x) => x !== kind) : [...ai.types, kind] };
    if (next.types.length === 0) { toast.error(t("অন্তত একটি ধরন রাখুন", "Keep at least one type")); return; }
    setAi(next);
  };

  const exportData = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const dump: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: user.id };
      for (const tbl of TABLES) {
        const { data, error } = await supabase.from(tbl).select("*");
        if (error) throw error;
        dump[tbl] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `my-finance-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success(t("ডেটা ডাউনলোড হয়েছে", "Data downloaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("এক্সপোর্ট ব্যর্থ", "Export failed"));
    } finally { setBusy(false); }
  };

  const importData = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let total = 0;
      for (const tbl of TABLES) {
        const rows = parsed?.[tbl];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const clean = rows.map((r: Record<string, unknown>) => {
          const { id: _id, created_at: _ca, updated_at: _ua, user_id: _uid, ...rest } = r;
          return { ...rest, user_id: user.id };
        });
        const { error } = await supabase.from(tbl).insert(clean as never);
        if (error) throw new Error(`${tbl}: ${error.message}`);
        total += clean.length;
      }
      toast.success(t(`${total} টি রেকর্ড আমদানি হয়েছে`, `Imported ${total} records`));
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("আমদানি ব্যর্থ", "Import failed"));
    } finally { setBusy(false); }
  };

  const wipeAllData = async () => {
    if (!user) return;
    if (confirmDelete !== "DELETE") { toast.error(t('নিশ্চিত হতে "DELETE" লিখুন', 'Type "DELETE" to confirm')); return; }
    setBusy(true);
    try {
      for (const tbl of TABLES) {
        const { error } = await supabase.from(tbl).delete().eq("user_id", user.id);
        if (error) throw error;
      }
      toast.success(t("সকল ডেটা মুছে ফেলা হয়েছে", "All data deleted"));
      setConfirmDelete("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("ব্যর্থ", "Failed"));
    } finally { setBusy(false); }
  };

  const clearLocalPrefs = () => {
    try {
      localStorage.removeItem(PREF_KEY);
      localStorage.removeItem(AI_KEY);
      localStorage.removeItem("dashboard_chart_range");
      localStorage.removeItem("dashboard_donut_view");
    } catch { /* noop */ }
    setPrefs(DEFAULT_PREFS); setAi(DEFAULT_AI);
    toast.success(t("লোকাল সেটিংস রিসেট হয়েছে", "Local settings reset"));
  };

  const doSignOut = async () => { await signOut(); navigate({ to: "/auth" }); };

  const saveFacebook = () => {
    const url = facebookUrl.trim();
    if (!url) { toast.error(t("লিংক দিন", "Enter a URL")); return; }
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      toast.error(t("সঠিক URL দিন (https://...)", "Enter a valid URL (https://...)"));
      return;
    }
    setSocialLinks({ facebook: url });
    toast.success(t("ফেসবুক লিংক সংরক্ষিত", "Facebook link saved"));
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error(t("শুধু ছবি ফাইল আপলোড করুন", "Please upload an image file")); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(t("ছবির আকার ৫ MB এর কম হতে হবে", "Image must be under 5 MB")); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      setAvatar(path);
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (updErr) throw updErr;
      toast.success(t("ছবি আপলোড হয়েছে", "Image uploaded"));
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("ছবি আপলোড ব্যর্থ", "Image upload failed"));
    } finally { setBusy(false); }
  };

  return (
    <AppShell title={t("সেটিংস", "Settings")}>
      <div className="max-w-3xl space-y-4">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white shadow-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-fuchsia-300/20 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden ring-4 ring-white/30 bg-white/20 flex items-center justify-center text-white text-2xl sm:text-3xl font-extrabold shrink-0">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/15 backdrop-blur rounded-full text-xs font-medium mb-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" /> {t("সেটিংস", "Settings")}
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">{name || t("আপনার অ্যাকাউন্ট", "Your account")}</h2>
              <p className="text-white/80 text-sm truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Profile */}
        <Section icon={<UserIcon className="w-4 h-4 text-indigo-600" />} title={t("প্রোফাইল", "Profile")}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="text-sm text-slate-500">{t("আপনার ছবি ও নাম অ্যাপ জুড়ে দেখা যাবে।", "Your photo and name appear throughout the app.")}</div>
          </div>
          {q.data?.ref_code && (
            <div className="flex items-center justify-between mb-3 p-3 rounded-lg border bg-slate-50">
              <div>
                <div className="text-xs text-slate-500">{t("আপনার রেফারেন্স নম্বর", "Your reference number")}</div>
                <div className="font-mono font-semibold text-lg tracking-wider">{q.data.ref_code}</div>
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(q.data!.ref_code!); toast.success(t("কপি হয়েছে", "Copied")); }}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white"
              >
                {t("কপি", "Copy")}
              </button>
            </div>
          )}
          <Field label={t("ইমেইল", "Email")}>
            <input value={user?.email ?? ""} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
          </Field>
          <Field label={t("পূর্ণ নাম", "Full Name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <Field label={t("ছবির লিংক (URL)", "Image URL")}>
            <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <Field label={t("অথবা সরাসরি ছবি আপলোড", "Or upload an image")}>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 cursor-pointer">
                <ImagePlus className="w-4 h-4" /> {t("ছবি বাছাই করুন", "Choose image")}
                <input type="file" accept="image/*" className="hidden" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
              </label>
              {avatar && (
                <button type="button" onClick={() => setAvatar("")} className="px-3 py-2 text-sm text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50">
                  {t("সরান", "Remove")}
                </button>
              )}
              <span className="text-xs text-slate-500">{t("JPG/PNG, সর্বোচ্চ ৫ MB", "JPG/PNG, max 5 MB")}</span>
            </div>
          </Field>
          <PrimaryBtn onClick={saveProfile} disabled={busy}><Save className="w-4 h-4" /> {t("সংরক্ষণ", "Save")}</PrimaryBtn>
        </Section>

        {/* Password */}
        <Section icon={<KeyRound className="w-4 h-4 text-indigo-600" />} title={t("পাসওয়ার্ড পরিবর্তন", "Change Password")}>
          <Field label={t("নতুন পাসওয়ার্ড", "New password")}>
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <Field label={t("পুনরায় টাইপ করুন", "Re-type password")}>
            <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <PrimaryBtn onClick={changePwd} disabled={busy || !newPwd}>{t("পরিবর্তন", "Change")}</PrimaryBtn>
        </Section>

        {/* App preferences */}
        <Section icon={<SlidersHorizontal className="w-4 h-4 text-indigo-600" />} title={t("অ্যাপ প্রেফারেন্স", "App Preferences")}>
          <Field label={t("ভাষা", "Language")}>
            <div className="flex gap-2">
              {([["bn", "বাংলা"], ["en", "English"]] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => {
                    setLang(v);
                    savePrefs({ ...prefs, language: v });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${lang === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"}`}
                >
                  <Languages className="w-3.5 h-3.5" /> {l}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("ড্যাশবোর্ড চার্ট রেঞ্জ", "Dashboard chart range")}>
            <div className="flex gap-2">
              {([
                ["সাপ্তাহিক", t("সাপ্তাহিক", "Weekly")],
                ["মাসিক", t("মাসিক", "Monthly")],
                ["বার্ষিক", t("বার্ষিক", "Yearly")],
              ] as const).map(([r, label]) => (
                <button key={r} onClick={() => savePrefs({ ...prefs, chartRange: r as Prefs["chartRange"] })}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${prefs.chartRange === r ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"}`}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("ডোনাট চার্ট ডিফল্ট ভিউ", "Donut chart default view")}>
            <div className="flex gap-2">
              {([["expense", t("ব্যয়", "Expense")], ["income", t("আয়", "Income")]] as const).map(([v, l]) => (
                <button key={v} onClick={() => savePrefs({ ...prefs, donutView: v })}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${prefs.donutView === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"}`}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Currency */}
        <Section icon={<Coins className="w-4 h-4 text-indigo-600" />} title={t("মুদ্রা চিহ্ন", "Currency Symbol")}>
          <Field label={t("প্রি-সেট", "Presets")}>
            <div className="flex flex-wrap gap-2">
              {CURRENCY_PRESETS.map(({ sym, name }) => (
                <button key={sym} onClick={() => applyCurrency(sym)}
                  className={`px-3 py-1.5 rounded-lg text-sm border inline-flex items-center gap-1.5 ${currency === sym ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"}`}>
                  <span className="text-base font-semibold">{sym}</span>
                  <span className="text-xs opacity-80">{name}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("কাস্টম চিহ্ন", "Custom symbol")}>
            <div className="flex gap-2">
              <input type="text" value={customCurrency} onChange={(e) => setCustomCurrency(e.target.value)}
                placeholder={t("যেমন: ₿, kr, R$", "e.g. ₿, kr, R$")} maxLength={4}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <button onClick={() => { applyCurrency(customCurrency); setCustomCurrency(""); }}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg inline-flex items-center gap-1.5">
                <Save className="w-4 h-4" /> {t("প্রয়োগ", "Apply")}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">{t("বর্তমান উদাহরণ", "Current example")}: <span className="font-semibold text-slate-700">{fmtTk(12345)}</span></p>
          </Field>
        </Section>

        {/* Social links */}
        <Section icon={<SlidersHorizontal className="w-4 h-4 text-indigo-600" />} title={t("সোশ্যাল লিংক", "Social Links")}>
          <Field label={t("ফেসবুক সাপোর্ট পেজ লিংক", "Facebook support page URL")}>
            <div className="flex gap-2">
              <input
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://www.facebook.com/yourpage"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button
                onClick={saveFacebook}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg inline-flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> {t("সংরক্ষণ", "Save")}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {t("হেডারের ফেসবুক আইকন এই লিংকে নিয়ে যাবে।", "The Facebook icon in the header will open this link.")}
            </p>
          </Field>
        </Section>

        {/* AI settings */}
        <Section icon={<Sparkles className="w-4 h-4 text-indigo-600" />} title={t("AI সাজেশন সেটিংস", "AI Suggestion Settings")}>
          <Field label={t("অ্যালার্টের ধরন", "Alert types")}>
            <div className="flex flex-wrap gap-2">
              {([["alert", t("সতর্কতা", "Alert")], ["tip", t("পরামর্শ", "Tip")], ["invest", t("বিনিয়োগ", "Invest")]] as const).map(([v, l]) => {
                const on = ai.types.includes(v);
                return (
                  <button key={v} onClick={() => toggleAiType(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${on ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-200 text-slate-600"}`}>
                    {on ? "✓ " : ""}{l}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t(`বেশি খরচ থ্রেশহোল্ড — ${ai.expenseRatioPct}% আয়ের`, `High expense threshold — ${ai.expenseRatioPct}% of income`)}>
            <input type="range" min={20} max={150} step={5} value={ai.expenseRatioPct}
              onChange={(e) => setAi({ ...ai, expenseRatioPct: Number(e.target.value) })}
              className="w-full accent-indigo-600" />
          </Field>
          <Field label={t("নগদ কম থ্রেশহোল্ড (৳)", "Low cash threshold (৳)")}>
            <input type="number" min={0} step={500} value={ai.lowCashTk}
              onChange={(e) => setAi({ ...ai, lowCashTk: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <Field label={t(`লক্ষ্য পিছিয়ে থ্রেশহোল্ড — ${ai.goalLagPct}%`, `Goal lag threshold — ${ai.goalLagPct}%`)}>
            <input type="range" min={5} max={60} step={5} value={ai.goalLagPct}
              onChange={(e) => setAi({ ...ai, goalLagPct: Number(e.target.value) })}
              className="w-full accent-indigo-600" />
          </Field>
          <Field label={t("অটো-বিশ্লেষণ", "Auto-analysis")}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ai.autoRun} onChange={(e) => setAi({ ...ai, autoRun: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
              {t("ড্যাশবোর্ড খুললে নিজে থেকেই বিশ্লেষণ", "Auto-analyze on dashboard open")}
            </label>
          </Field>
          <Field label={t(`রিফ্রেশ ইন্টারভাল — ${ai.autoIntervalMin} মিনিট`, `Refresh interval — ${ai.autoIntervalMin} min`)}>
            <input type="range" min={5} max={120} step={5} value={ai.autoIntervalMin} disabled={!ai.autoRun}
              onChange={(e) => setAi({ ...ai, autoIntervalMin: Number(e.target.value) })}
              className="w-full accent-indigo-600 disabled:opacity-50" />
          </Field>
          <PrimaryBtn onClick={() => saveAi(ai)}><Save className="w-4 h-4" /> {t("সংরক্ষণ", "Save")}</PrimaryBtn>
        </Section>

        {/* Data management */}
        <Section icon={<Download className="w-4 h-4 text-indigo-600" />} title={t("ডেটা ব্যবস্থাপনা", "Data Management")}>
          <p className="text-xs text-slate-500 mb-3">{t("সকল লেনদেন, বাজেট, লক্ষ্য, নোট ইত্যাদির ব্যাকআপ ডাউনলোড বা পুনরুদ্ধার করুন।", "Download or restore a backup of all transactions, budgets, goals, notes, etc.")}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportData} disabled={busy} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              <Download className="w-4 h-4" /> {t("JSON এক্সপোর্ট", "Export JSON")}
            </button>
            <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer">
              <Upload className="w-4 h-4" /> {t("JSON ইম্পোর্ট", "Import JSON")}
              <input type="file" accept="application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
            </label>
            <button onClick={clearLocalPrefs} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
              {t("লোকাল সেটিংস রিসেট", "Reset local settings")}
            </button>
          </div>
        </Section>

        {/* Danger zone */}
        <div className="bg-white rounded-xl p-5 border-2 border-rose-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h2 className="font-bold text-rose-700">{t("বিপদ অঞ্চল", "Danger Zone")}</h2>
          </div>
          <p className="text-xs text-slate-600 mb-3">{t("সকল ডেটা মুছে ফেলতে নিচে ", "To delete all data, type ")}<span className="font-mono font-bold">DELETE</span>{t(" লিখুন। এই কাজ ফিরিয়ে আনা যাবে না।", " below. This action cannot be undone.")}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="DELETE"
              className="px-3 py-2 border border-rose-200 rounded-lg text-sm font-mono" />
            <button onClick={wipeAllData} disabled={busy || confirmDelete !== "DELETE"}
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> {t("সকল ডেটা মুছুন", "Delete all data")}
            </button>
          </div>
        </div>

        {/* Account */}
        <Section icon={<LogOut className="w-4 h-4 text-slate-600" />} title={t("অ্যাকাউন্ট", "Account")}>
          <button onClick={doSignOut} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-sm font-medium hover:bg-rose-100">
            <LogOut className="w-4 h-4" /> {t("সাইন আউট", "Sign out")}
          </button>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-80" />
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100 flex items-center justify-center">
          {icon}
        </div>
        <h2 className="font-bold text-slate-800">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function PrimaryBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0">
      {children}
    </button>
  );
}
