import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useRole";
import { LifeBuoy, Plus, Send, RefreshCw, MessageSquare, Trash2, Star, MessageCircle, Paperclip, X as XIcon, Loader2, Inbox, BellDot } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportPage,
});

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  updated_at: string;
};

type Msg = {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_admin: boolean;
  body: string;
  created_at: string;
};

type Feedback = {
  id: string;
  name: string | null;
  email: string;
  message: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  open: "খোলা", in_progress: "চলমান", resolved: "সমাধান", closed: "বন্ধ",
};
const STATUS_COLOR: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "নিম্ন", normal: "সাধারণ", high: "উচ্চ", urgent: "জরুরি",
};

function SupportPage() {
  const isAdmin = useIsAdmin();
  const { t } = useLanguage();
  const [uid, setUid] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newSubj, setNewSubj] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newPri, setNewPri] = useState<"low"|"normal"|"high"|"urgent">("normal");
  const [filter, setFilter] = useState<string>("");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [seen, setSeen] = useState<Record<string, string>>({});

  // Load last-seen ticket times from localStorage (per user, for new-reply badge)
  useEffect(() => {
    if (!uid) return;
    try {
      const raw = localStorage.getItem(`ah_ticket_seen_${uid}`);
      setSeen(raw ? JSON.parse(raw) : {});
    } catch { setSeen({}); }
  }, [uid]);

  const markSeen = (tid: string, ts: string) => {
    if (!uid) return;
    setSeen(prev => {
      const next = { ...prev, [tid]: ts };
      try { localStorage.setItem(`ah_ticket_seen_${uid}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUid(data.user?.id || null);
      setUserEmail(data.user?.email || "");
      setUserName(((data.user?.user_metadata as any)?.full_name as string) || "");
    });
  }, []);

  // Feedback form state
  const [fbName, setFbName] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbRating, setFbRating] = useState(0);
  const [fbMsg, setFbMsg] = useState("");
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbFiles, setFbFiles] = useState<File[]>([]);
  const [fbPreviews, setFbPreviews] = useState<string[]>([]);
  const [fbUploading, setFbUploading] = useState(false);

  useEffect(() => {
    if (!fbName && userName) setFbName(userName);
    if (!fbEmail && userEmail) setFbEmail(userEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, userEmail]);

  const MAX_FILES = 4;
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const next: File[] = [];
    for (const f of incoming) {
      if (!f.type.startsWith("image/")) { toast.error(t("শুধু ছবি আপলোড করা যাবে", "Only image files are allowed")); continue; }
      if (f.size > MAX_SIZE) { toast.error(t("সর্বোচ্চ ৫MB", "Max 5MB per file")); continue; }
      next.push(f);
    }
    const merged = [...fbFiles, ...next].slice(0, MAX_FILES);
    setFbFiles(merged);
    setFbPreviews(prev => {
      prev.forEach(u => URL.revokeObjectURL(u));
      return merged.map(f => URL.createObjectURL(f));
    });
  };

  const removeFile = (idx: number) => {
    setFbFiles(prev => prev.filter((_, i) => i !== idx));
    setFbPreviews(prev => {
      const u = prev[idx]; if (u) URL.revokeObjectURL(u);
      return prev.filter((_, i) => i !== idx);
    });
  };

  useEffect(() => () => { fbPreviews.forEach(u => URL.revokeObjectURL(u)); }, []); // eslint-disable-line

  const submitFeedback = async () => {
    const name = fbName.trim().slice(0, 100);
    const email = fbEmail.trim().slice(0, 255);
    const msg = fbMsg.trim().slice(0, 1000);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t("সঠিক ইমেইল দিন", "Enter a valid email"));
      return;
    }
    if (!msg) {
      toast.error(t("ফিডব্যাক লিখুন", "Please write your feedback"));
      return;
    }
    setFbSubmitting(true);
    // Upload attachments first
    const urls: string[] = [];
    if (fbFiles.length && uid) {
      setFbUploading(true);
      for (const f of fbFiles) {
        const ext = (f.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("feedback").upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) { toast.error(upErr.message); setFbUploading(false); setFbSubmitting(false); return; }
        const { data: pub } = supabase.storage.from("feedback").getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
      setFbUploading(false);
    }
    const attachBlock = urls.length ? `\n\n${t("সংযুক্ত ছবি", "Attachments")}:\n${urls.join("\n")}` : "";
    const composed = `${fbRating ? `★ ${fbRating}/5\n` : ""}${msg}${attachBlock}`;
    const { error } = await supabase.from("leads").insert({
      name: name || null, email, message: composed, source: "support_feedback",
    });
    setFbSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("ফিডব্যাকের জন্য ধন্যবাদ!", "Thanks for your feedback!"));
    setFbMsg(""); setFbRating(0);
    fbPreviews.forEach(u => URL.revokeObjectURL(u));
    setFbFiles([]); setFbPreviews([]);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (data || []) as Ticket[];
    setTickets(list);
    if (isAdmin) {
      const ids = Array.from(new Set(list.map(t => t.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const m: Record<string, string> = {};
        (profs || []).forEach((p: any) => { m[p.id] = p.full_name || p.id.slice(0, 8); });
        setNames(m);
      }
    }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin !== null) load(); }, [isAdmin]);

  // Admin: load feedback (source=support_feedback) from leads
  const loadFeedback = async () => {
    if (!isAdmin) return;
    setFbLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, email, message, created_at")
      .eq("source", "support_feedback")
      .order("created_at", { ascending: false });
    setFbLoading(false);
    if (error) { toast.error(error.message); return; }
    setFeedbacks((data || []) as Feedback[]);
  };
  useEffect(() => { if (isAdmin) loadFeedback(); }, [isAdmin]);

  const deleteFeedback = async (id: string) => {
    if (!confirm(t("ফিডব্যাক ডিলিট করবেন?", "Delete this feedback?"))) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setFeedbacks(prev => prev.filter(f => f.id !== id));
  };

  const extractAttachments = (msg: string | null) => {
    if (!msg) return { text: "", urls: [] as string[], rating: 0 };
    const urls = Array.from(msg.matchAll(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg)/gi)).map(m => m[0]);
    let text = msg;
    let rating = 0;
    const rm = msg.match(/^★\s*(\d)\s*\/\s*5/);
    if (rm) { rating = parseInt(rm[1], 10); text = text.replace(rm[0], "").trim(); }
    // strip attachment block
    text = text.replace(/\n*(?:সংযুক্ত ছবি|Attachments)\s*:\s*\n[\s\S]*$/i, "").trim();
    return { text, urls, rating };
  };

  const loadMsgs = async (tid: string) => {
    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", tid)
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setMsgs((data || []) as Msg[]);
  };

  useEffect(() => {
    if (selected) {
      loadMsgs(selected);
      const tk = tickets.find(x => x.id === selected);
      if (tk) markSeen(selected, tk.updated_at);
    } else setMsgs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const filtered = useMemo(
    () => tickets.filter(t => !filter || t.status === filter),
    [tickets, filter]
  );
  const current = tickets.find(t => t.id === selected);

  const createTicket = async () => {
    if (!uid || !newSubj.trim() || !newBody.trim()) return;
    const { data: t, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: uid, subject: newSubj.trim(), priority: newPri })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("support_messages").insert({
      ticket_id: t.id, sender_id: uid, is_admin: false, body: newBody.trim(),
    });
    toast.success("টিকেট তৈরি হয়েছে");
    setShowNew(false); setNewSubj(""); setNewBody(""); setNewPri("normal");
    await load();
    setSelected(t.id);
  };

  const sendReply = async () => {
    if (!uid || !selected || !reply.trim()) return;
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected, sender_id: uid, is_admin: !!isAdmin, body: reply.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setReply("");
    await loadMsgs(selected);
    await load();
  };

  const updateStatus = async (s: Ticket["status"]) => {
    if (!selected) return;
    const { error } = await supabase.from("support_tickets").update({ status: s }).eq("id", selected);
    if (error) { toast.error(error.message); return; }
    toast.success("স্ট্যাটাস আপডেট হয়েছে");
    await load();
  };

  const deleteTicket = async (id: string) => {
    if (!confirm("টিকেট ডিলিট করবেন?")) return;
    const { error } = await supabase.from("support_tickets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (selected === id) setSelected(null);
    await load();
  };

  return (
    <AppShell
      title="সাপোর্ট"
      actions={
        <div className="flex gap-2">
          <button onClick={() => { load(); if (isAdmin) loadFeedback(); }} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
            <RefreshCw className="w-4 h-4" /> রিফ্রেশ
          </button>
          {!isAdmin && (
            <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white" style={{ background: "var(--brand-emerald-700)" }}>
              <Plus className="w-4 h-4" /> নতুন টিকেট
            </button>
          )}
        </div>
      }
    >
      {/* Admin feedback list */}
      {isAdmin && (
        <div className="brand-card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Inbox className="w-5 h-5" style={{ color: "var(--brand-emerald-700)" }} />
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                {t("ইউজার ফিডব্যাক", "User feedback")}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{feedbacks.length}</span>
            </div>
            <button onClick={loadFeedback} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md border hover:bg-slate-50" style={{ borderColor: "var(--brand-line)" }}>
              <RefreshCw className="w-3 h-3" /> {t("রিফ্রেশ", "Refresh")}
            </button>
          </div>
          {fbLoading ? (
            <div className="py-6 text-center text-sm text-slate-500">{t("লোড হচ্ছে…", "Loading…")}</div>
          ) : feedbacks.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">{t("কোনো ফিডব্যাক নেই", "No feedback yet")}</div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {feedbacks.map(f => {
                const { text, urls, rating } = extractAttachments(f.message);
                return (
                  <div key={f.id} className="p-3 rounded-lg border" style={{ borderColor: "var(--brand-line)" }}>
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{f.name || t("নামহীন", "Anonymous")}</div>
                        <a href={`mailto:${f.email}`} className="text-xs text-slate-500 hover:underline truncate block">{f.email}</a>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {rating > 0 && (
                          <span className="flex items-center gap-0.5 text-xs">
                            <Star className="w-3.5 h-3.5" fill="#f59e0b" stroke="#f59e0b" /> {rating}/5
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">{new Date(f.created_at).toLocaleString("bn-BD")}</span>
                        <button onClick={() => deleteFeedback(f.id)} className="p-1 rounded hover:bg-rose-50 text-rose-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {text && <div className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{text}</div>}
                    {urls.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {urls.map(u => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-md overflow-hidden border" style={{ borderColor: "var(--brand-line)" }}>
                            <img src={u} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Feedback form */}
      {!isAdmin && (
        <div className="brand-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="w-5 h-5" style={{ color: "var(--brand-emerald-700)" }} />
            <h3 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {t("ফিডব্যাক দিন", "Send feedback")}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            {t("আপনার মতামত আমাদের অ্যাপটি উন্নত করতে সাহায্য করবে।", "Your feedback helps us improve the app.")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium text-slate-600">{t("নাম", "Name")}</label>
              <input value={fbName} onChange={e => setFbName(e.target.value)} maxLength={100} className="w-full mt-1 px-3 py-2 rounded-md border text-sm" style={{ borderColor: "var(--brand-line)" }} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">{t("ইমেইল", "Email")}</label>
              <input value={fbEmail} onChange={e => setFbEmail(e.target.value)} maxLength={255} type="email" className="w-full mt-1 px-3 py-2 rounded-md border text-sm" style={{ borderColor: "var(--brand-line)" }} />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-600">{t("রেটিং", "Rating")}</label>
            <div className="flex items-center gap-1 mt-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setFbRating(n === fbRating ? 0 : n)} aria-label={`${n}`} className="p-1">
                  <Star className="w-6 h-6" fill={n <= fbRating ? "#f59e0b" : "none"} stroke={n <= fbRating ? "#f59e0b" : "#94a3b8"} />
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-600">{t("আপনার মতামত", "Your feedback")}</label>
            <textarea value={fbMsg} onChange={e => setFbMsg(e.target.value)} rows={4} maxLength={1000} className="w-full mt-1 px-3 py-2 rounded-md border text-sm resize-none" style={{ borderColor: "var(--brand-line)" }} />
            <div className="text-[10px] text-slate-400 mt-1 text-right">{fbMsg.length}/1000</div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-600">{t("ছবি/স্ক্রিনশট সংযুক্ত করুন", "Attach images/screenshots")}</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {fbPreviews.map((u, i) => (
                <div key={u} className="relative w-16 h-16 rounded-md overflow-hidden border" style={{ borderColor: "var(--brand-line)" }}>
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeFile(i)} className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full p-0.5" aria-label="remove">
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {fbFiles.length < MAX_FILES && (
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs hover:bg-slate-50" style={{ borderColor: "var(--brand-line)" }}>
                  <Paperclip className="w-3.5 h-3.5" />
                  {t("ছবি যোগ করুন", "Add image")}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => { onPickFiles(e.target.files); e.currentTarget.value = ""; }} />
                </label>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{t(`সর্বোচ্চ ${MAX_FILES}টি ছবি, প্রতিটি ৫MB পর্যন্ত`, `Up to ${MAX_FILES} images, 5MB each`)}</div>
          </div>
          <div className="flex justify-end">
            <button onClick={submitFeedback} disabled={fbSubmitting} className="px-4 py-2 rounded-md text-white text-sm disabled:opacity-50 flex items-center gap-2" style={{ background: "var(--brand-emerald-700)" }}>
              {fbSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {fbUploading ? t("আপলোড হচ্ছে…", "Uploading…") : fbSubmitting ? t("পাঠানো হচ্ছে…", "Sending…") : t("ফিডব্যাক পাঠান", "Send feedback")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* List */}
        <div className="brand-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5" style={{ color: "var(--brand-emerald-700)" }} />
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                {isAdmin ? "সব টিকেট" : "আমার টিকেট"}
              </h3>
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)} className="px-2 py-1 rounded-md border text-xs" style={{ borderColor: "var(--brand-line)" }}>
              <option value="">সব</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">লোড হচ্ছে…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">কোনো টিকেট নেই</div>
          ) : (
            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
              {filtered.map(tk => (
                <button
                  key={tk.id}
                  onClick={() => setSelected(tk.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${selected === tk.id ? "shadow-sm" : "hover:bg-slate-50"}`}
                  style={{ borderColor: selected === tk.id ? "var(--brand-emerald-700)" : "var(--brand-line)" }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-medium text-sm truncate flex-1">{tk.subject}</div>
                    <div className="flex items-center gap-1 shrink-0">
                      {seen[tk.id] && new Date(tk.updated_at) > new Date(seen[tk.id]) && selected !== tk.id && (
                        <span title={t("নতুন আপডেট", "New update")} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                          <BellDot className="w-3 h-3 mr-0.5" /> {t("নতুন", "New")}
                        </span>
                      )}
                      {!seen[tk.id] && selected !== tk.id && (
                        <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[tk.status]}`}>{STATUS_LABEL[tk.status]}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{isAdmin ? (names[tk.user_id] || tk.user_id.slice(0, 8)) : PRIORITY_LABEL[tk.priority]}</span>
                    <span>{new Date(tk.updated_at).toLocaleDateString("bn-BD")}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread */}
        <div className="brand-card p-4 flex flex-col min-h-[70vh]">
          {!current ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <MessageSquare className="w-12 h-12 mb-2" />
              <div className="text-sm">একটি টিকেট সিলেক্ট করুন</div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 pb-3 border-b mb-3" style={{ borderColor: "var(--brand-line)" }}>
                <div>
                  <div className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>{current.subject}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {isAdmin && <>ইউজার: <span className="font-medium">{names[current.user_id] || current.user_id.slice(0, 8)}</span> · </>}
                    অগ্রাধিকার: {PRIORITY_LABEL[current.priority]} · {new Date(current.created_at).toLocaleString("bn-BD")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <select value={current.status} onChange={e => updateStatus(e.target.value as any)} className="px-2 py-1 rounded-md border text-xs" style={{ borderColor: "var(--brand-line)" }}>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[current.status]}`}>{STATUS_LABEL[current.status]}</span>
                  )}
                  {(isAdmin || current.user_id === uid) && (
                    <button onClick={() => deleteTicket(current.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                {msgs.map(m => {
                  const mine = m.sender_id === uid;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-lg p-3 text-sm`} style={{
                        background: m.is_admin ? "color-mix(in oklab, var(--brand-emerald-700) 10%, white)" : "rgb(241 245 249)",
                        border: m.is_admin ? "1px solid color-mix(in oklab, var(--brand-emerald-700) 25%, transparent)" : "1px solid transparent",
                      }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: m.is_admin ? "var(--brand-emerald-700)" : "rgb(100 116 139)" }}>
                            {m.is_admin ? "অ্যাডমিন" : "ইউজার"}
                          </span>
                          <span className="text-[10px] text-slate-400">{new Date(m.created_at).toLocaleString("bn-BD")}</span>
                        </div>
                        <div className="whitespace-pre-wrap">{m.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {current.status !== "closed" && (
                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "var(--brand-line)" }}>
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder={isAdmin ? "অ্যাডমিন রিপ্লাই…" : "আপনার বার্তা লিখুন…"}
                    className="flex-1 px-3 py-2 rounded-md border text-sm resize-none"
                    style={{ borderColor: "var(--brand-line)" }}
                    rows={2}
                  />
                  <button onClick={sendReply} disabled={!reply.trim()} className="px-4 rounded-md text-white text-sm disabled:opacity-50 flex items-center gap-2" style={{ background: "var(--brand-emerald-700)" }}>
                    <Send className="w-4 h-4" /> পাঠান
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New ticket modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="brand-card p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>নতুন সাপোর্ট টিকেট</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">বিষয়</label>
                <input value={newSubj} onChange={e => setNewSubj(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border text-sm" style={{ borderColor: "var(--brand-line)" }} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">অগ্রাধিকার</label>
                <select value={newPri} onChange={e => setNewPri(e.target.value as any)} className="w-full mt-1 px-3 py-2 rounded-md border text-sm" style={{ borderColor: "var(--brand-line)" }}>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">সমস্যার বিবরণ</label>
                <textarea value={newBody} onChange={e => setNewBody(e.target.value)} rows={5} className="w-full mt-1 px-3 py-2 rounded-md border text-sm resize-none" style={{ borderColor: "var(--brand-line)" }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-md border text-sm" style={{ borderColor: "var(--brand-line)" }}>বাতিল</button>
              <button onClick={createTicket} disabled={!newSubj.trim() || !newBody.trim()} className="px-4 py-2 rounded-md text-white text-sm disabled:opacity-50" style={{ background: "var(--brand-emerald-700)" }}>জমা দিন</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
