import { createFileRoute, redirect, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Ban, LogOut } from "lucide-react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  // Optimistic: render the app immediately after beforeLoad confirms session.
  // Profile status is verified in background; only block if explicitly pending/suspended.
  const [status, setStatus] = useState<"approved" | "pending" | "suspended">("approved");
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancel = false;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      if (!cancel) setUserId(session.user.id);
      const { data } = await supabase.from("profiles").select("status").eq("id", session.user.id).maybeSingle();
      if (cancel) return;
      const s = (data?.status as "approved" | "pending" | "suspended" | null) || "approved";
      setStatus(s);
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) { navigate({ to: "/auth" }); return; }
      setUserId(s.user.id);
    });
    return () => { cancel = true; subscription.unsubscribe(); };
  }, [navigate]);

  useRealtimeSync(userId);

  if (status === "pending" || status === "suspended") {
    const isPending = status === "pending";
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-brand)" }}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center brand-card">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: isPending ? "color-mix(in oklab, #f59e0b 18%, transparent)" : "color-mix(in oklab, #e11d48 18%, transparent)" }}>
            {isPending
              ? <Clock className="w-7 h-7 text-amber-600" />
              : <Ban className="w-7 h-7 text-rose-600" />}
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>
            {isPending ? "অনুমোদনের অপেক্ষায়" : "অ্যাকাউন্ট সাসপেন্ডেড"}
          </h1>
          <p className="text-sm text-slate-600 mb-5">
            {isPending
              ? "আপনার অ্যাকাউন্ট এখনো অ্যাডমিন কর্তৃক অনুমোদিত হয়নি। অনুগ্রহ করে অপেক্ষা করুন।"
              : "আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে। বিস্তারিত জানতে অ্যাডমিনের সাথে যোগাযোগ করুন।"}
          </p>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm hover:bg-slate-50"
          >
            <LogOut className="w-4 h-4" /> লগআউট
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}