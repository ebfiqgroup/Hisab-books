import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  LogOut, User as UserIcon, KeyRound, SlidersHorizontal, Sparkles,
  Download, Upload, Trash2, AlertTriangle, Save, ImagePlus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

type Profile = { id: string; full_name: string | null; avatar_url: string | null };

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
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [ai, setAi] = useState<AiCfg>(DEFAULT_AI);
  const [confirmDelete, setConfirmDelete] = useState("");

  useEffect(() => { setPrefs(loadPrefs()); setAi(loadAi()); }, []);

  const q = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,avatar_url").eq("id", user!.id).maybeSingle();
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
    toast.success("প্রোফাইল আপডেট হয়েছে");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const changePwd = async () => {
    if (newPwd.length < 6) { toast.error("পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে"); return; }
    if (newPwd !== confirmPwd) { toast.error("পাসওয়ার্ড মিলছে না"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("পাসওয়ার্ড পরিবর্তিত");
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
    toast.success("প্রেফারেন্স সংরক্ষিত");
  };

  const saveAi = (next: AiCfg) => {
    setAi(next);
    try { localStorage.setItem(AI_KEY, JSON.stringify(next)); } catch { /* noop */ }
    toast.success("AI সেটিংস সংরক্ষিত");
  };

  const toggleAiType = (t: "alert" | "tip" | "invest") => {
    const next = { ...ai, types: ai.types.includes(t) ? ai.types.filter((x) => x !== t) : [...ai.types, t] };
    if (next.types.length === 0) { toast.error("অন্তত একটি ধরন রাখুন"); return; }
    setAi(next);
  };

  const exportData = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const dump: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: user.id };
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t).select("*");
        if (error) throw error;
        dump[t] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `my-finance-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("ডেটা ডাউনলোড হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "এক্সপোর্ট ব্যর্থ");
    } finally { setBusy(false); }
  };

  const importData = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let total = 0;
      for (const t of TABLES) {
        const rows = parsed?.[t];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const clean = rows.map((r: Record<string, unknown>) => {
          const { id: _id, created_at: _ca, updated_at: _ua, user_id: _uid, ...rest } = r;
          return { ...rest, user_id: user.id };
        });
        const { error } = await supabase.from(t).insert(clean as never);
        if (error) throw new Error(`${t}: ${error.message}`);
        total += clean.length;
      }
      toast.success(`${total} টি রেকর্ড আমদানি হয়েছে`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "আমদানি ব্যর্থ");
    } finally { setBusy(false); }
  };

  const wipeAllData = async () => {
    if (!user) return;
    if (confirmDelete !== "DELETE") { toast.error('নিশ্চিত হতে "DELETE" লিখুন'); return; }
    setBusy(true);
    try {
      for (const t of TABLES) {
        const { error } = await supabase.from(t).delete().eq("user_id", user.id);
        if (error) throw error;
      }
      toast.success("সকল ডেটা মুছে ফেলা হয়েছে");
      setConfirmDelete("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
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
    toast.success("লোকাল সেটিংস রিসেট হয়েছে");
  };

  const doSignOut = async () => { await signOut(); navigate({ to: "/auth" }); };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("শুধু ছবি ফাইল আপলোড করুন"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("ছবির আকার ৫ MB এর কম হতে হবে"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      setAvatar(url);
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (updErr) throw updErr;
      toast.success("ছবি আপলোড হয়েছে");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ছবি আপলোড ব্যর্থ");
    } finally { setBusy(false); }
  };

  return (
    <AppShell title="সেটিংস">
      <div className="max-w-3xl space-y-4">
        {/* Profile */}
        <Section icon={<UserIcon className="w-4 h-4 text-indigo-600" />} title="প্রোফাইল">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="text-sm text-slate-500">আপনার ছবি ও নাম অ্যাপ জুড়ে দেখা যাবে।</div>
          </div>
          <Field label="ইমেইল">
            <input value={user?.email ?? ""} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
          </Field>
          <Field label="পূর্ণ নাম">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <Field label="ছবির লিংক (URL)">
            <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <Field label="অথবা সরাসরি ছবি আপলোড">
            <div className="flex flex-wrap gap-2 items-center">
              <label className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 cursor-pointer">
                <ImagePlus className="w-4 h-4" /> ছবি বাছাই করুন
                <input type="file" accept="image/*" className="hidden" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
              </label>
              {avatar && (
                <button type="button" onClick={() => setAvatar("")} className="px-3 py-2 text-sm text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50">
                  সরান
                </button>
              )}
              <span className="text-xs text-slate-500">JPG/PNG, সর্বোচ্চ ৫ MB</span>
            </div>
          </Field>
          <PrimaryBtn onClick={saveProfile} disabled={busy}><Save className="w-4 h-4" /> সংরক্ষণ</PrimaryBtn>
        </Section>

        {/* Password */}
        <Section icon={<KeyRound className="w-4 h-4 text-indigo-600" />} title="পাসওয়ার্ড পরিবর্তন">
          <Field label="নতুন পাসওয়ার্ড">
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <Field label="পুনরায় টাইপ করুন">
            <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <PrimaryBtn onClick={changePwd} disabled={busy || !newPwd}>পরিবর্তন</PrimaryBtn>
        </Section>

        {/* App preferences */}
        <Section icon={<SlidersHorizontal className="w-4 h-4 text-indigo-600" />} title="অ্যাপ প্রেফারেন্স">
          <Field label="ড্যাশবোর্ড চার্ট রেঞ্জ">
            <div className="flex gap-2">
              {(["সাপ্তাহিক", "মাসিক", "বার্ষিক"] as const).map((r) => (
                <button key={r} onClick={() => savePrefs({ ...prefs, chartRange: r })}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${prefs.chartRange === r ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"}`}>
                  {r}
                </button>
              ))}
            </div>
          </Field>
          <Field label="ডোনাট চার্ট ডিফল্ট ভিউ">
            <div className="flex gap-2">
              {([["expense", "ব্যয়"], ["income", "আয়"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => savePrefs({ ...prefs, donutView: v })}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${prefs.donutView === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"}`}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* AI settings */}
        <Section icon={<Sparkles className="w-4 h-4 text-indigo-600" />} title="AI সাজেশন সেটিংস">
          <Field label="অ্যালার্টের ধরন">
            <div className="flex flex-wrap gap-2">
              {([["alert", "সতর্কতা"], ["tip", "পরামর্শ"], ["invest", "বিনিয়োগ"]] as const).map(([v, l]) => {
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
          <Field label={`বেশি খরচ থ্রেশহোল্ড — ${ai.expenseRatioPct}% আয়ের`}>
            <input type="range" min={20} max={150} step={5} value={ai.expenseRatioPct}
              onChange={(e) => setAi({ ...ai, expenseRatioPct: Number(e.target.value) })}
              className="w-full accent-indigo-600" />
          </Field>
          <Field label="নগদ কম থ্রেশহোল্ড (৳)">
            <input type="number" min={0} step={500} value={ai.lowCashTk}
              onChange={(e) => setAi({ ...ai, lowCashTk: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </Field>
          <Field label={`লক্ষ্য পিছিয়ে থ্রেশহোল্ড — ${ai.goalLagPct}%`}>
            <input type="range" min={5} max={60} step={5} value={ai.goalLagPct}
              onChange={(e) => setAi({ ...ai, goalLagPct: Number(e.target.value) })}
              className="w-full accent-indigo-600" />
          </Field>
          <Field label="অটো-বিশ্লেষণ">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ai.autoRun} onChange={(e) => setAi({ ...ai, autoRun: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
              ড্যাশবোর্ড খুললে নিজে থেকেই বিশ্লেষণ
            </label>
          </Field>
          <Field label={`রিফ্রেশ ইন্টারভাল — ${ai.autoIntervalMin} মিনিট`}>
            <input type="range" min={5} max={120} step={5} value={ai.autoIntervalMin} disabled={!ai.autoRun}
              onChange={(e) => setAi({ ...ai, autoIntervalMin: Number(e.target.value) })}
              className="w-full accent-indigo-600 disabled:opacity-50" />
          </Field>
          <PrimaryBtn onClick={() => saveAi(ai)}><Save className="w-4 h-4" /> সংরক্ষণ</PrimaryBtn>
        </Section>

        {/* Data management */}
        <Section icon={<Download className="w-4 h-4 text-indigo-600" />} title="ডেটা ব্যবস্থাপনা">
          <p className="text-xs text-slate-500 mb-3">সকল লেনদেন, বাজেট, লক্ষ্য, নোট ইত্যাদির ব্যাকআপ ডাউনলোড বা পুনরুদ্ধার করুন।</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportData} disabled={busy} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              <Download className="w-4 h-4" /> JSON এক্সপোর্ট
            </button>
            <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer">
              <Upload className="w-4 h-4" /> JSON ইম্পোর্ট
              <input type="file" accept="application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
            </label>
            <button onClick={clearLocalPrefs} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
              লোকাল সেটিংস রিসেট
            </button>
          </div>
        </Section>

        {/* Danger zone */}
        <div className="bg-white rounded-xl p-5 border-2 border-rose-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h2 className="font-bold text-rose-700">বিপদ অঞ্চল</h2>
          </div>
          <p className="text-xs text-slate-600 mb-3">সকল ডেটা মুছে ফেলতে নিচে <span className="font-mono font-bold">DELETE</span> লিখুন। এই কাজ ফিরিয়ে আনা যাবে না।</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="DELETE"
              className="px-3 py-2 border border-rose-200 rounded-lg text-sm font-mono" />
            <button onClick={wipeAllData} disabled={busy || confirmDelete !== "DELETE"}
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> সকল ডেটা মুছুন
            </button>
          </div>
        </div>

        {/* Account */}
        <Section icon={<LogOut className="w-4 h-4 text-slate-600" />} title="অ্যাকাউন্ট">
          <button onClick={doSignOut} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-sm font-medium hover:bg-rose-100">
            <LogOut className="w-4 h-4" /> সাইন আউট
          </button>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        {icon}
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
    <button {...rest} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
      {children}
    </button>
  );
}
