import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useRole";
import { LifeBuoy, Plus, Send, RefreshCw, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  const [uid, setUid] = useState<string | null>(null);
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id || null));
  }, []);

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

  const loadMsgs = async (tid: string) => {
    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", tid)
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setMsgs((data || []) as Msg[]);
  };

  useEffect(() => { if (selected) loadMsgs(selected); else setMsgs([]); }, [selected]);

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
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
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
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${selected === t.id ? "shadow-sm" : "hover:bg-slate-50"}`}
                  style={{ borderColor: selected === t.id ? "var(--brand-emerald-700)" : "var(--brand-line)" }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-medium text-sm truncate flex-1">{t.subject}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{isAdmin ? (names[t.user_id] || t.user_id.slice(0, 8)) : PRIORITY_LABEL[t.priority]}</span>
                    <span>{new Date(t.updated_at).toLocaleDateString("bn-BD")}</span>
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
