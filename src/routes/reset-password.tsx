import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "পাসওয়ার্ড রিসেট - হিসাব বই" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error(t("অন্তত ৬ অক্ষর", "At least 6 characters")); return; }
    if (password !== confirm) { toast.error(t("পাসওয়ার্ড মিলছে না", "Passwords do not match")); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("পাসওয়ার্ড পরিবর্তিত হয়েছে", "Password changed"));
      navigate({ to: "/app" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("ত্রুটি হয়েছে", "Something went wrong"));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-brand)" }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 brand-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in oklab, var(--brand-gold-500) 18%, transparent)", border: "1px solid color-mix(in oklab, var(--brand-gold-500) 35%, transparent)" }}>
            <Wallet className="w-6 h-6" style={{ color: "var(--brand-emerald-700)" }} />
          </div>
          <div>
            <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{t("নতুন পাসওয়ার্ড", "New password")}</h1>
            <p className="text-xs text-slate-500">{t("নতুন পাসওয়ার্ড সেট করুন", "Set a new password")}</p>
          </div>
        </div>

        {!ready ? (
          <div className="text-center py-6 text-sm text-slate-500">
            {t("রিসেট লিংক যাচাই করা হচ্ছে…", "Verifying reset link…")}
            <p className="text-xs mt-3">{t("যদি না খুলে, ইমেইলের লিংক আবার ক্লিক করুন।", "If it does not open, click the email link again.")}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">{t("নতুন পাসওয়ার্ড", "New password")}</label>
              <input
                type="password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">{t("পুনরায় টাইপ করুন", "Type again")}</label>
              <input
                type="password" required minLength={6}
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={busy}
              className="w-full py-2.5 text-white rounded-lg font-medium text-sm shadow-md hover:opacity-95 transition disabled:opacity-50"
              style={{ background: "var(--gradient-brand)" }}
            >
              {busy ? t("অপেক্ষা করুন...", "Please wait...") : t("পাসওয়ার্ড পরিবর্তন", "Change password")}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400 mt-4">
          <Link to="/auth" className="hover:text-slate-600">{t("লগইনে ফিরে যান", "Back to sign in")}</Link>
        </p>
      </div>
    </div>
  );
}