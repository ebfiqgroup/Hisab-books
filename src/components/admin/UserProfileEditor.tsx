import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminUpdateUser, adminSendPasswordReset } from "@/lib/admin-users.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Save, Mail, KeyRound, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  userId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
};

export function UserProfileEditor({ userId, open, onOpenChange, onSaved }: Props) {
  const updateUser = useServerFn(adminUpdateUser);
  const sendReset = useServerFn(adminSendPasswordReset);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [refCode, setRefCode] = useState<string>("");
  const [email, setEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, ref_code")
        .eq("id", userId)
        .maybeSingle();
      setFullName(prof?.full_name ?? "");
      setAvatarUrl(prof?.avatar_url ?? "");
      setRefCode(prof?.ref_code ?? "");
      setEmail("");
      setNewPwd("");
      setLoading(false);
    })();
  }, [open, userId]);

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("শুধু ছবি"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("সর্বোচ্চ ৫ MB"); return; }
    setBusy(true);
    const t = toast.loading("আপলোড হচ্ছে…");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      toast.success("আপলোড হয়েছে", { id: t });
    } catch (e: any) {
      toast.error(e?.message || "ব্যর্থ", { id: t });
    } finally { setBusy(false); }
  };

  const saveProfile = async () => {
    setBusy(true);
    const t = toast.loading("সংরক্ষণ হচ্ছে…");
    try {
      await updateUser({ data: { user_id: userId, full_name: fullName, avatar_url: avatarUrl || null } });
      toast.success("প্রোফাইল আপডেট", { id: t });
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || "ব্যর্থ", { id: t });
    } finally { setBusy(false); }
  };

  const saveEmail = async () => {
    if (!email) return;
    setBusy(true);
    const t = toast.loading("ইমেইল পরিবর্তন…");
    try {
      await updateUser({ data: { user_id: userId, email, email_confirm: true } });
      toast.success("ইমেইল পরিবর্তিত", { id: t });
      setEmail("");
    } catch (e: any) {
      toast.error(e?.message || "ব্যর্থ", { id: t });
    } finally { setBusy(false); }
  };

  const savePassword = async () => {
    if (newPwd.length < 6) { toast.error("অন্তত ৬ অক্ষর"); return; }
    setBusy(true);
    const t = toast.loading("পাসওয়ার্ড সেট…");
    try {
      await updateUser({ data: { user_id: userId, password: newPwd } });
      toast.success("পাসওয়ার্ড পরিবর্তিত", { id: t });
      setNewPwd("");
    } catch (e: any) {
      toast.error(e?.message || "ব্যর্থ", { id: t });
    } finally { setBusy(false); }
  };

  const toggleBan = async (ban: boolean) => {
    setBusy(true);
    const t = toast.loading(ban ? "ব্লক করা হচ্ছে…" : "আনব্লক…");
    try {
      await updateUser({ data: { user_id: userId, ban } });
      toast.success(ban ? "ব্লক করা হয়েছে" : "আনব্লক হয়েছে", { id: t });
    } catch (e: any) {
      toast.error(e?.message || "ব্যর্থ", { id: t });
    } finally { setBusy(false); }
  };

  const sendResetLink = async () => {
    if (!email) { toast.error("ইমেইল লিখুন"); return; }
    setBusy(true);
    const t = toast.loading("রিসেট লিংক পাঠানো হচ্ছে…");
    try {
      await sendReset({ data: { email } });
      toast.success("রিসেট লিংক পাঠানো হয়েছে", { id: t });
    } catch (e: any) {
      toast.error(e?.message || "ব্যর্থ", { id: t });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>প্রোফাইল সেটিংস</DialogTitle>
          <DialogDescription className="font-mono text-xs">{userId}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-slate-500">লোড হচ্ছে…</div>
        ) : (
          <div className="space-y-6">
            {refCode && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
                <div>
                  <div className="text-xs text-slate-500">রেফারেন্স নম্বর</div>
                  <div className="font-mono font-semibold text-base tracking-wider">{refCode}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(refCode); toast.success("কপি হয়েছে"); }}>কপি</Button>
              </div>
            )}
            {/* Profile section */}
            <section className="space-y-3 p-4 border rounded-lg">
              <h4 className="text-sm font-semibold">মূল প্রোফাইল</h4>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (fullName || "?").charAt(0).toUpperCase()}
                </div>
                <label className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 cursor-pointer">
                  <ImagePlus className="w-4 h-4" /> ছবি বদলান
                  <input type="file" accept="image/*" className="hidden" disabled={busy}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
                </label>
                {avatarUrl && (
                  <Button size="sm" variant="outline" onClick={() => setAvatarUrl("")}>সরান</Button>
                )}
              </div>
              <div>
                <Label className="text-xs">পূর্ণ নাম</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">ছবির লিংক</Label>
                <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
              </div>
              <Button onClick={saveProfile} disabled={busy} size="sm">
                <Save className="w-4 h-4" /> প্রোফাইল সংরক্ষণ
              </Button>
            </section>

            {/* Email */}
            <section className="space-y-3 p-4 border rounded-lg">
              <h4 className="text-sm font-semibold flex items-center gap-2"><Mail className="w-4 h-4" /> ইমেইল</h4>
              <Input type="email" placeholder="নতুন ইমেইল" value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="flex gap-2 flex-wrap">
                <Button onClick={saveEmail} disabled={busy || !email} size="sm">ইমেইল পরিবর্তন</Button>
                <Button onClick={sendResetLink} disabled={busy || !email} size="sm" variant="outline">রিসেট লিংক পাঠান</Button>
              </div>
              <p className="text-xs text-slate-500">নতুন ইমেইল সরাসরি কনফার্ম হিসেবে সেট হবে।</p>
            </section>

            {/* Password */}
            <section className="space-y-3 p-4 border rounded-lg">
              <h4 className="text-sm font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> পাসওয়ার্ড রিসেট</h4>
              <Input type="text" placeholder="নতুন পাসওয়ার্ড (অন্তত ৬ অক্ষর)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
              <Button onClick={savePassword} disabled={busy || newPwd.length < 6} size="sm">পাসওয়ার্ড সেট করুন</Button>
            </section>

            {/* Ban */}
            <section className="space-y-3 p-4 border rounded-lg">
              <h4 className="text-sm font-semibold flex items-center gap-2"><Ban className="w-4 h-4" /> অ্যাক্সেস নিয়ন্ত্রণ</h4>
              <p className="text-xs text-slate-500">ব্লক করা ব্যবহারকারী লগইন করতে পারবেন না।</p>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => toggleBan(true)} disabled={busy} size="sm" variant="outline" className="text-rose-600">
                  <Ban className="w-4 h-4" /> ব্লক করুন
                </Button>
                <Button onClick={() => toggleBan(false)} disabled={busy} size="sm" variant="outline" className="text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> আনব্লক করুন
                </Button>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}