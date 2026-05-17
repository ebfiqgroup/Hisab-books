import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "লগইন - আমার হিসাব" }, { name: "description", content: "ব্যক্তিগত আর্থিক ড্যাশবোর্ডে লগইন" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে", "Reset link sent to your email"));
        setMode("login");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success(t("সাইনআপ সফল! ড্যাশবোর্ডে নিয়ে যাচ্ছি...", "Sign-up successful! Redirecting…"));
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("স্বাগতম!", "Welcome!"));
        navigate({ to: "/app" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("ত্রুটি হয়েছে", "Something went wrong");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-brand)" }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 brand-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in oklab, var(--brand-gold-500) 18%, transparent)", border: "1px solid color-mix(in oklab, var(--brand-gold-500) 35%, transparent)" }}>
            <Wallet className="w-6 h-6" style={{ color: "var(--brand-emerald-700)" }} />
          </div>
          <div>
            <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{t("আমার হিসাব", "My Finance")}</h1>
            <p className="text-xs text-slate-500">
              {mode === "login" ? t("লগইন করুন", "Sign in") : mode === "signup" ? t("নতুন একাউন্ট তৈরি করুন", "Create a new account") : t("পাসওয়ার্ড রিসেট করুন", "Reset password")}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">{t("পূর্ণ নাম", "Full name")}</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder={t("আপনার নাম", "Your name")}
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">{t("ইমেইল", "Email")}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="you@example.com"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-600">{t("পাসওয়ার্ড", "Password")}</label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs font-medium hover:underline"
                    style={{ color: "var(--brand-emerald-700)" }}
                  >
                    {t("পাসওয়ার্ড ভুলে গেছেন?", "Forgot password?")}
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="••••••••"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 text-white rounded-lg font-medium text-sm shadow-md hover:opacity-95 transition disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {busy ? t("অপেক্ষা করুন...", "Please wait...") : mode === "login" ? t("লগইন", "Sign in") : mode === "signup" ? t("সাইনআপ", "Sign up") : t("রিসেট লিংক পাঠান", "Send reset link")}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 mt-5">
          {mode === "forgot" ? (
            <button onClick={() => setMode("login")} className="font-medium hover:underline" style={{ color: "var(--brand-emerald-700)" }}>
              ← {t("লগইনে ফিরে যান", "Back to sign in")}
            </button>
          ) : (
            <>
              {mode === "login" ? t("একাউন্ট নেই? ", "No account? ") : t("ইতিমধ্যে একাউন্ট আছে? ", "Already have an account? ")}
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="font-medium hover:underline"
                style={{ color: "var(--brand-emerald-700)" }}
              >
                {mode === "login" ? t("সাইনআপ করুন", "Sign up") : t("লগইন করুন", "Sign in")}
              </button>
            </>
          )}
        </p>
        <p className="text-center text-xs text-slate-400 mt-4">
          <Link to="/" className="hover:text-slate-600">{t("ফিরে যান", "Back")}</Link>
        </p>
      </div>
    </div>
  );
}