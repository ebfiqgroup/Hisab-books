import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, Lock } from "lucide-react";
import {
  BUILTIN_CATS,
  loadCustomCats,
  saveCustomCats,
  type TxnType,
} from "@/lib/finance";

export function CategoryManager({
  open,
  onOpenChange,
  type,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: TxnType;
}) {
  const qc = useQueryClient();
  const [map, setMap] = useState(() => loadCustomCats());
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const custom = map[type];
  const builtIns = BUILTIN_CATS[type];

  const startEdit = (name: string) => { setEditingName(name); setDraft(name); };
  const cancelEdit = () => { setEditingName(null); setDraft(""); };

  const saveRename = async (oldName: string) => {
    const newName = draft.trim();
    if (!newName) { toast.error("নাম দিন"); return; }
    if (newName === oldName) { cancelEdit(); return; }
    const all = [...builtIns, ...custom];
    if (all.includes(newName)) { toast.error("এই নাম ইতিমধ্যে আছে"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("transactions")
      .update({ category: newName })
      .eq("type", type)
      .eq("category", oldName);
    if (error) { setBusy(false); toast.error(error.message); return; }
    const next = { ...map, [type]: custom.map((c) => (c === oldName ? newName : c)) };
    setMap(next); saveCustomCats(next);
    cancelEdit(); setBusy(false);
    toast.success("ক্যাটাগরি আপডেট হয়েছে");
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const removeCategory = async (name: string) => {
    const { count, error: ce } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("type", type)
      .eq("category", name);
    if (ce) { toast.error(ce.message); return; }
    const used = count ?? 0;
    const msg = used > 0
      ? `এই ক্যাটাগরিতে ${used}টি লেনদেন আছে। সেগুলো "অন্যান্য"-তে সরিয়ে নিয়ে ক্যাটাগরি মুছবেন?`
      : "এই ক্যাটাগরি মুছবেন?";
    if (!confirm(msg)) return;
    setBusy(true);
    if (used > 0) {
      const { error } = await supabase
        .from("transactions")
        .update({ category: "অন্যান্য" })
        .eq("type", type)
        .eq("category", name);
      if (error) { setBusy(false); toast.error(error.message); return; }
    }
    const next = { ...map, [type]: custom.filter((c) => c !== name) };
    setMap(next); saveCustomCats(next);
    setBusy(false);
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ক্যাটাগরি ব্যবস্থাপনা ({type === "income" ? "আয়" : "ব্যয়"})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-500 mb-2">বিল্ট-ইন ক্যাটাগরি</div>
            <div className="flex flex-wrap gap-1.5">
              {builtIns.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-full text-xs">
                  <Lock className="w-3 h-3" /> {c}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-2">আমার ক্যাটাগরি</div>
            {custom.length === 0 ? (
              <div className="text-sm text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">কোনো কাস্টম ক্যাটাগরি নেই</div>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {custom.map((c) => (
                  <li key={c} className="flex items-center gap-2 px-3 py-2">
                    {editingName === c ? (
                      <>
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); saveRename(c); }
                            if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                          }}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded-md text-sm"
                        />
                        <button disabled={busy} onClick={() => saveRename(c)} className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 disabled:opacity-50" title="সেভ">
                          <Check className="w-4 h-4" />
                        </button>
                        <button disabled={busy} onClick={cancelEdit} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-50" title="বাতিল">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700">{c}</span>
                        <button disabled={busy} onClick={() => startEdit(c)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 disabled:opacity-50" title="এডিট">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button disabled={busy} onClick={() => removeCategory(c)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50" title="মুছুন">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="text-[11px] text-slate-400">টিপ: নতুন ক্যাটাগরি যোগ করতে "নতুন আয়/ব্যয়" ডায়ালগ ব্যবহার করুন।</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}