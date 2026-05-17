import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";

type Props = {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

type EntityKey = "transactions" | "budgets" | "debts" | "goals" | "notes" | "plan_tasks";

const SCHEMAS: Record<EntityKey, { label: string; fields: { key: string; label: string; type?: string; required?: boolean }[] }> = {
  transactions: {
    label: "লেনদেন",
    fields: [
      { key: "type", label: "ধরন (income/expense)", required: true },
      { key: "category", label: "ক্যাটাগরি", required: true },
      { key: "amount", label: "পরিমাণ", type: "number", required: true },
      { key: "occurred_on", label: "তারিখ", type: "date" },
      { key: "note", label: "নোট" },
    ],
  },
  budgets: {
    label: "বাজেট",
    fields: [
      { key: "category", label: "ক্যাটাগরি", required: true },
      { key: "monthly_limit", label: "মাসিক সীমা", type: "number", required: true },
      { key: "label", label: "লেবেল" },
    ],
  },
  debts: {
    label: "ঋণ",
    fields: [
      { key: "person", label: "ব্যক্তি", required: true },
      { key: "kind", label: "ধরন (receivable/payable)", required: true },
      { key: "amount", label: "পরিমাণ", type: "number", required: true },
      { key: "due_date", label: "শেষ তারিখ", type: "date" },
      { key: "note", label: "নোট" },
      { key: "settled", label: "পরিশোধিত (true/false)" },
    ],
  },
  goals: {
    label: "লক্ষ্য",
    fields: [
      { key: "label", label: "নাম", required: true },
      { key: "target", label: "লক্ষ্য", type: "number", required: true },
      { key: "current", label: "বর্তমান", type: "number" },
      { key: "deadline", label: "শেষ তারিখ", type: "date" },
      { key: "color", label: "রঙ" },
    ],
  },
  notes: {
    label: "নোট",
    fields: [{ key: "body", label: "নোট", required: true }],
  },
  plan_tasks: {
    label: "টাস্ক",
    fields: [
      { key: "task", label: "টাস্ক", required: true },
      { key: "priority", label: "অগ্রাধিকার (উচ্চ/মাঝারি/নিম্ন)" },
      { key: "due_text", label: "শেষ" },
      { key: "amount_text", label: "পরিমাণ" },
      { key: "done", label: "সম্পন্ন (true/false)" },
    ],
  },
};

function coerce(value: string, type?: string): any {
  if (value === "" || value == null) return null;
  if (type === "number") return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function EntityTable({ entity, userId }: { entity: EntityKey; userId: string }) {
  const schema = SCHEMAS[entity];
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(entity)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [entity, userId]);

  const startEdit = (row: any) => {
    setEditing(row.id);
    const f: Record<string, string> = {};
    schema.fields.forEach((fd) => { f[fd.key] = row[fd.key] == null ? "" : String(row[fd.key]); });
    setForm(f);
    setAdding(false);
  };

  const startAdd = () => {
    setEditing(null);
    setAdding(true);
    const f: Record<string, string> = {};
    schema.fields.forEach((fd) => { f[fd.key] = ""; });
    setForm(f);
  };

  const cancel = () => { setEditing(null); setAdding(false); setForm({}); };

  const save = async () => {
    const payload: any = { user_id: userId };
    for (const fd of schema.fields) {
      const v = coerce(form[fd.key], fd.type);
      if (fd.required && (v === null || v === "")) {
        toast.error(`"${fd.label}" আবশ্যক`);
        return;
      }
      payload[fd.key] = v;
    }
    const t = toast.loading("সংরক্ষণ হচ্ছে…");
    try {
      if (editing) {
        const { error } = await supabase.from(entity).update(payload).eq("id", editing);
        if (error) throw error;
        toast.success("আপডেট হয়েছে", { id: t });
      } else {
        const { error } = await supabase.from(entity).insert(payload);
        if (error) throw error;
        toast.success("যোগ হয়েছে", { id: t });
      }
      cancel();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "ব্যর্থ", { id: t });
    }
  };

  const del = async (id: string) => {
    if (!confirm("নিশ্চিতভাবে মুছে ফেলবেন?")) return;
    const t = toast.loading("মুছে ফেলা হচ্ছে…");
    const { error } = await supabase.from(entity).delete().eq("id", id);
    if (error) toast.error(error.message, { id: t });
    else { toast.success("মুছে ফেলা হয়েছে", { id: t }); await load(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-500">মোট: {rows.length}</div>
        {!adding && !editing && (
          <Button size="sm" onClick={startAdd}><Plus className="w-4 h-4" /> নতুন যোগ করুন</Button>
        )}
      </div>

      {(adding || editing) && (
        <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {schema.fields.map((fd) => (
              <div key={fd.key}>
                <label className="text-xs text-slate-600">{fd.label}{fd.required && " *"}</label>
                <Input
                  type={fd.type === "number" ? "number" : fd.type === "date" ? "date" : "text"}
                  value={form[fd.key] || ""}
                  onChange={(e) => setForm({ ...form, [fd.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={cancel}><X className="w-4 h-4" /> বাতিল</Button>
            <Button size="sm" onClick={save}><Check className="w-4 h-4" /> সংরক্ষণ</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase">
            <tr>
              {schema.fields.map((fd) => (
                <th key={fd.key} className="text-left p-2">{fd.label}</th>
              ))}
              <th className="p-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={schema.fields.length + 1} className="p-6 text-center text-slate-500">লোড হচ্ছে…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={schema.fields.length + 1} className="p-6 text-center text-slate-400">কোনো তথ্য নেই</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t">
                {schema.fields.map((fd) => (
                  <td key={fd.key} className="p-2 max-w-[200px] truncate">
                    {r[fd.key] == null ? "—" : String(r[fd.key])}
                  </td>
                ))}
                <td className="p-2">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(r.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UserDataManager({ userId, userName, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{userName || "ব্যবহারকারী"} — সম্পূর্ণ তথ্য ব্যবস্থাপনা</DialogTitle>
          <DialogDescription className="font-mono text-xs">{userId}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
            {(Object.keys(SCHEMAS) as EntityKey[]).map((k) => (
              <TabsTrigger key={k} value={k}>{SCHEMAS[k].label}</TabsTrigger>
            ))}
          </TabsList>
          {(Object.keys(SCHEMAS) as EntityKey[]).map((k) => (
            <TabsContent key={k} value={k} className="mt-4">
              {open && <EntityTable entity={k} userId={userId} />}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}