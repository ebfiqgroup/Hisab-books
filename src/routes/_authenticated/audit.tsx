import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useRole";
import { Shield, RefreshCw, ChevronDown, ChevronRight, Activity } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
});

type Log = {
  id: string;
  actor_id: string | null;
  table_name: string;
  operation: string;
  record_id: string | null;
  target_user_id: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
};

const OP_COLOR: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-amber-100 text-amber-700",
  DELETE: "bg-rose-100 text-rose-700",
};

function AuditPage() {
  const { t, lang } = useLanguage();
  const isAdmin = useIsAdmin();
  const [logs, setLogs] = useState<Log[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [filterTable, setFilterTable] = useState("");
  const [filterOp, setFilterOp] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (data || []) as Log[];
    setLogs(list);

    const ids = Array.from(new Set(list.flatMap(l => [l.actor_id, l.target_user_id]).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const m: Record<string, string> = {};
      (profs || []).forEach((p: any) => { m[p.id] = p.full_name || p.id.slice(0, 8); });
      setNames(m);
    }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (isAdmin === null) return <AppShell title={t("অডিট লগ", "Audit log")}><div className="p-8 text-slate-500">{t("লোড হচ্ছে…", "Loading…")}</div></AppShell>;
  if (!isAdmin) {
    return (
      <AppShell title={t("অডিট লগ", "Audit log")}>
        <div className="max-w-xl mx-auto mt-10 brand-card p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--brand-emerald-700)" }} />
          <h2 className="text-xl font-semibold mb-2">{t("অ্যাক্সেস নেই", "No access")}</h2>
          <p className="text-sm text-slate-600">{t("এই পেজটি দেখতে অ্যাডমিন অনুমতি লাগবে।", "You need admin permission to view this page.")}</p>
        </div>
      </AppShell>
    );
  }

  const tables = Array.from(new Set(logs.map(l => l.table_name)));
  const filtered = logs.filter(l =>
    (!filterTable || l.table_name === filterTable) &&
    (!filterOp || l.operation === filterOp)
  );

  const nameOf = (id: string | null) => id ? (names[id] || id.slice(0, 8) + "…") : t("সিস্টেম", "System");

  return (
    <AppShell
      title={t("অডিট লগ", "Audit log")}
      actions={
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
          <RefreshCw className="w-4 h-4" /> {t("রিফ্রেশ", "Refresh")}
        </button>
      }
    >
      <div className="brand-card p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5" style={{ color: "var(--brand-emerald-700)" }} />
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {t(`শেষ ${filtered.length} টি পরিবর্তন`, `Last ${filtered.length} changes`)}
            </h3>
          </div>
          <div className="flex gap-2">
            <select value={filterTable} onChange={e => setFilterTable(e.target.value)} className="px-2 py-1.5 rounded-md border text-sm" style={{ borderColor: "var(--brand-line)" }}>
              <option value="">{t("সব টেবিল", "All tables")}</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterOp} onChange={e => setFilterOp(e.target.value)} className="px-2 py-1.5 rounded-md border text-sm" style={{ borderColor: "var(--brand-line)" }}>
              <option value="">{t("সব অপারেশন", "All operations")}</option>
              <option value="INSERT">{t("যোগ", "Insert")}</option>
              <option value="UPDATE">{t("আপডেট", "Update")}</option>
              <option value="DELETE">{t("ডিলিট", "Delete")}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">{t("লোড হচ্ছে…", "Loading…")}</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500">{t("কোনো লগ নেই", "No logs")}</div>
        ) : (
          <div className="space-y-1">
            {filtered.map(l => {
              const isOpen = open === l.id;
              return (
                <div key={l.id} className="border rounded-lg" style={{ borderColor: "var(--brand-line)" }}>
                  <button
                    onClick={() => setOpen(isOpen ? null : l.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${OP_COLOR[l.operation] || "bg-slate-100"}`}>
                      {l.operation}
                    </span>
                    <span className="text-sm font-medium">{l.table_name}</span>
                    <span className="text-xs text-slate-500 flex-1 truncate">
                      <span className="font-medium">{nameOf(l.actor_id)}</span>
                      {l.target_user_id && l.target_user_id !== l.actor_id && (
                        <> → <span className="font-medium">{nameOf(l.target_user_id)}</span></>
                      )}
                    </span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t p-3 bg-slate-50/50 space-y-3 text-xs" style={{ borderColor: "var(--brand-line)" }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {l.old_data && (
                          <div>
                            <div className="font-semibold text-rose-600 mb-1">{t("আগে", "Before")}</div>
                            <pre className="bg-white border rounded p-2 overflow-auto max-h-64 font-mono text-[11px]">{JSON.stringify(l.old_data, null, 2)}</pre>
                          </div>
                        )}
                        {l.new_data && (
                          <div>
                            <div className="font-semibold text-emerald-700 mb-1">{t("পরে", "After")}</div>
                            <pre className="bg-white border rounded p-2 overflow-auto max-h-64 font-mono text-[11px]">{JSON.stringify(l.new_data, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">{t("রেকর্ড", "record")}: {l.record_id || "—"}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}