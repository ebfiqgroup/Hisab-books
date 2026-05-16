import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

type Profile = { id: string; full_name: string | null; avatar_url: string | null };

function SettingsPage() {
  const qc = useQueryClient();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPwd, setNewPwd] = useState("");

  const q = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,avatar_url").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  useEffect(() => { if (q.data?.full_name) setName(q.data.full_name); }, [q.data]);

  const saveProfile = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("প্রোফাইল আপডেট হয়েছে");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const changePwd = async () => {
    if (newPwd.length < 6) { toast.error("পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("পাসওয়ার্ড পরিবর্তিত");
    setNewPwd("");
  };

  const doSignOut = async () => { await signOut(); navigate({ to: "/auth" }); };

  return (
    <AppShell title="সেটিংস">
      <div className="max-w-2xl space-y-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="font-bold text-slate-800 mb-4">প্রোফাইল</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-600 mb-1 block">ইমেইল</label>
              <input value={user?.email ?? ""} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">পূর্ণ নাম</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <button onClick={saveProfile} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">সংরক্ষণ</button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="font-bold text-slate-800 mb-4">পাসওয়ার্ড পরিবর্তন</h2>
          <div className="space-y-3">
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="নতুন পাসওয়ার্ড" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <button onClick={changePwd} disabled={busy || !newPwd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">পরিবর্তন</button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="font-bold text-slate-800 mb-4">অ্যাকাউন্ট</h2>
          <button onClick={doSignOut} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-sm font-medium hover:bg-rose-100">
            <LogOut className="w-4 h-4" /> সাইন আউট
          </button>
        </div>
      </div>
    </AppShell>
  );
}