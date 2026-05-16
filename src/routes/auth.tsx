import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "লগইন - আমার হিসাব" }, { name: "description", content: "ব্যক্তিগত আর্থিক ড্যাশবোর্ডে লগইন" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("সাইনআপ সফল! ড্যাশবোর্ডে নিয়ে যাচ্ছি...");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("স্বাগতম!");
        navigate({ to: "/" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ত্রুটি হয়েছে";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "oklch(0.22 0.04 250)" }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">আমার হিসাব</h1>
            <p className="text-xs text-slate-500">{mode === "login" ? "লগইন করুন" : "নতুন একাউন্ট তৈরি করুন"}</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">পূর্ণ নাম</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="আপনার নাম"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">ইমেইল</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">পাসওয়ার্ড</label>
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
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "অপেক্ষা করুন..." : mode === "login" ? "লগইন" : "সাইনআপ"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 mt-5">
          {mode === "login" ? "একাউন্ট নেই? " : "ইতিমধ্যে একাউন্ট আছে? "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-indigo-600 font-medium hover:underline"
          >
            {mode === "login" ? "সাইনআপ করুন" : "লগইন করুন"}
          </button>
        </p>
        <p className="text-center text-xs text-slate-400 mt-4">
          <Link to="/" className="hover:text-slate-600">ফিরে যান</Link>
        </p>
      </div>
    </div>
  );
}