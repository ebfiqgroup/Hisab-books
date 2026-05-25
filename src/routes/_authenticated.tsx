import { createFileRoute, redirect, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Ban, LogOut } from "lucide-react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { RealtimeStatusProvider } from "@/hooks/useRealtimeStatus";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      try { await supabase.auth.signOut(); } catch { /* noop */ }
      throw redirect({ to: "/auth" });
    }
    return { initialUserId: data.session.user.id };
  },
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { initialUserId } = Route.useRouteContext();
  // beforeLoad already verified the session — render the app immediately.
  const [status, setStatus] = useState<"approved" | "pending" | "suspended">("approved");
  const [userId, setUserId] = useState<string | undefined>(initialUserId);

  useEffect(() => {
    let cancel = false;
    const checkStatus = async (uid: string) => {
      const { data } = await supabase.from("profiles").select("status").eq("id", uid).maybeSingle();
      if (cancel) return;
      const s = (data?.status as "approved" | "pending" | "suspended" | null) || "approved";
      setStatus(s);
    };
    if (initialUserId) checkStatus(initialUserId);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      // Only react to real sign-in/out transitions. INITIAL_SESSION and
      // TOKEN_REFRESHED events fire frequently and would otherwise trigger
      // a refetch storm that makes the screen jump.
      if (_e === "SIGNED_OUT") {
        navigate({ to: "/auth" });
        return;
      }
      if (_e === "SIGNED_IN" && s) {
        setUserId((prev) => (prev === s.user.id ? prev : s.user.id));
        queryClient.invalidateQueries({ refetchType: "active" });
      }
    });
    return () => { cancel = true; subscription.unsubscribe(); };
  }, [navigate, queryClient, initialUserId]);

  const rtStatus = useRealtimeSync(userId);

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-500">ডাটা প্রস্তুত হচ্ছে…</div>
      </div>
    );
  }

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

  return (
    <RealtimeStatusProvider value={rtStatus}>
      <Outlet />
    </RealtimeStatusProvider>
  );
}