import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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

  const signInWithGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/app",
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/app" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("ত্রুটি হয়েছে", "Something went wrong");
      toast.error(msg);
      setBusy(false);
    }
  };

  // Always show the login form on /auth. Do NOT auto-redirect to /app even
  // if a previous Supabase session is cached in localStorage — the user must
  // explicitly log in. If they already have a valid session and want the
  // dashboard, they can navigate to /app directly.

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

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] uppercase tracking-wider text-slate-400">{t("অথবা", "Or")}</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="w-full py-2.5 rounded-lg font-medium text-sm border border-slate-200 bg-white hover:bg-slate-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ color: "var(--brand-ink)" }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.91 6.91 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
          {t("গুগল দিয়ে লগইন", "Continue with Google")}
        </button>

        <p className="text-center text-[11px] text-slate-400 mt-3">
          {t("ফেইসবুক বর্তমানে সাপোর্টেড নয়", "Facebook is not currently supported")}
        </p>

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