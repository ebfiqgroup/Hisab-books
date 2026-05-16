import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, RotateCcw } from "lucide-react";
import {
  BUILTIN_CATS_RAW,
  builtinsFor,
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
  const [confirmDel, setConfirmDel] = useState<
    | { kind: "custom" | "builtin"; name: string; raw?: string; used: number; target: string }
    | null
  >(null);

  const custom = map[type];
  const builtInsRaw = BUILTIN_CATS_RAW[type];
  const renames = map.renames?.[type] ?? {};
  const effective = (raw: string) => renames[raw] ?? raw;
  const fallbackTarget = () => {
    // Effective name of "অন্যান্য" if it's still active; otherwise raw.
    const hidden = new Set(map.hidden?.[type] ?? []);
    if (hidden.has("অন্যান্য")) return "অন্যান্য"; // re-activate raw on use
    return effective("অন্যান্য");
  };

  // All currently-available category names (excluding the one being deleted)
  const availableTargets = (excludeEffective: string): string[] => {
    const active = [...builtinsFor(type, map), ...custom];
    return active.filter((n) => n !== excludeEffective);
  };

  const startEdit = (name: string) => { setEditingName(name); setDraft(name); };
  const cancelEdit = () => { setEditingName(null); setDraft(""); };

  const saveRenameCustom = async (oldName: string) => {
    const newName = draft.trim();
    if (!newName) { toast.error("নাম দিন"); return; }
    if (newName === oldName) { cancelEdit(); return; }
    const all = [...builtinsFor(type, map), ...custom];
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

  const saveRenameBuiltin = async (rawName: string) => {
    const newName = draft.trim();
    const currentEffective = effective(rawName);
    if (!newName) { toast.error("নাম দিন"); return; }
    if (newName === currentEffective) { cancelEdit(); return; }
    const all = [...builtinsFor(type, map).filter((n) => n !== currentEffective), ...custom];
    if (all.includes(newName)) { toast.error("এই নাম ইতিমধ্যে আছে"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("transactions")
      .update({ category: newName })
      .eq("type", type)
      .eq("category", currentEffective);
    if (error) { setBusy(false); toast.error(error.message); return; }
    const nextRenames = {
      income: { ...(map.renames?.income ?? {}) },
      expense: { ...(map.renames?.expense ?? {}) },
    };
    if (newName === rawName) delete nextRenames[type][rawName];
    else nextRenames[type][rawName] = newName;
    const next = { ...map, renames: nextRenames };
    setMap(next); saveCustomCats(next);
    cancelEdit(); setBusy(false);
    toast.success("ক্যাটাগরি আপডেট হয়েছে");
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const resetBuiltin = async (rawName: string) => {
    const currentEffective = effective(rawName);
    if (currentEffective === rawName) return;
    if (!confirm(`"${currentEffective}" কে আবার "${rawName}" নামে ফিরিয়ে আনবেন?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("transactions")
      .update({ category: rawName })
      .eq("type", type)
      .eq("category", currentEffective);
    if (error) { setBusy(false); toast.error(error.message); return; }
    const nextRenames = {
      income: { ...(map.renames?.income ?? {}) },
      expense: { ...(map.renames?.expense ?? {}) },
    };
    delete nextRenames[type][rawName];
    const next = { ...map, renames: nextRenames };
    setMap(next); saveCustomCats(next);
    setBusy(false);
    toast.success("রিসেট হয়েছে");
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
    setConfirmDel({ kind: "custom", name, used, target: fallbackTarget() });
  };

  const removeBuiltin = async (raw: string) => {
    if (raw === "অন্যান্য") { toast.error("\"অন্যান্য\" মুছে ফেলা যাবে না (ফলব্যাক ক্যাটাগরি)"); return; }
    const cur = effective(raw);
    const { count, error: ce } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("type", type)
      .eq("category", cur);
    if (ce) { toast.error(ce.message); return; }
    const used = count ?? 0;
    setConfirmDel({ kind: "builtin", name: cur, raw, used, target: fallbackTarget() });
  };

  const performDelete = async () => {
    if (!confirmDel) return;
    const { kind, name, raw, used, target } = confirmDel;
    if (used > 0 && !target) { toast.error("টার্গেট ক্যাটাগরি দিন"); return; }
    setBusy(true);
    if (used > 0) {
      const { error } = await supabase
        .from("transactions")
        .update({ category: target })
        .eq("type", type)
        .eq("category", name);
      if (error) { setBusy(false); toast.error(error.message); return; }
    }
    if (kind === "custom") {
      const next = { ...map, [type]: custom.filter((c) => c !== name) };
      setMap(next); saveCustomCats(next);
    } else if (raw) {
      const nextHidden = {
        income: [...(map.hidden?.income ?? [])],
        expense: [...(map.hidden?.expense ?? [])],
      };
      if (!nextHidden[type].includes(raw)) nextHidden[type].push(raw);
      const next = { ...map, hidden: nextHidden };
      setMap(next); saveCustomCats(next);
    }
    setBusy(false);
    setConfirmDel(null);
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const restoreBuiltin = (raw: string) => {
    const nextHidden = {
      income: (map.hidden?.income ?? []).filter((x) => x !== raw),
      expense: (map.hidden?.expense ?? []).filter((x) => x !== raw),
    };
    const next = { ...map, hidden: nextHidden };
    setMap(next); saveCustomCats(next);
    toast.success("ফিরিয়ে আনা হয়েছে");
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
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {builtInsRaw.map((raw) => {
                const cur = effective(raw);
                const isEditing = editingName === `builtin:${raw}`;
                const isHidden = (map.hidden?.[type] ?? []).includes(raw);
                return (
                  <li key={raw} className={`flex items-center gap-2 px-3 py-2 ${isHidden ? "opacity-50" : ""}`}>
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); saveRenameBuiltin(raw); }
                            if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                          }}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded-md text-sm"
                        />
                        <button disabled={busy} onClick={() => saveRenameBuiltin(raw)} className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 disabled:opacity-50" title="সেভ">
                          <Check className="w-4 h-4" />
                        </button>
                        <button disabled={busy} onClick={cancelEdit} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-50" title="বাতিল">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700">
                          {cur}{isHidden && <span className="ml-2 text-[11px] text-rose-500">(মুছে ফেলা)</span>}
                          {cur !== raw && <span className="ml-2 text-[11px] text-slate-400">(মূল: {raw})</span>}
                        </span>
                        {isHidden ? (
                          <button disabled={busy} onClick={() => restoreBuiltin(raw)} className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 disabled:opacity-50" title="ফিরিয়ে আনুন">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button disabled={busy} onClick={() => { setEditingName(`builtin:${raw}`); setDraft(cur); }} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 disabled:opacity-50" title="এডিট">
                              <Pencil className="w-4 h-4" />
                            </button>
                            {cur !== raw && (
                              <button disabled={busy} onClick={() => resetBuiltin(raw)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-50" title="রিসেট">
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {raw !== "অন্যান্য" && (
                              <button disabled={busy} onClick={() => removeBuiltin(raw)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50" title="মুছুন">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
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
                            if (e.key === "Enter") { e.preventDefault(); saveRenameCustom(c); }
                            if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                          }}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded-md text-sm"
                        />
                        <button disabled={busy} onClick={() => saveRenameCustom(c)} className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 disabled:opacity-50" title="সেভ">
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
      <Dialog open={!!confirmDel} onOpenChange={(v) => { if (!busy && !v) setConfirmDel(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ক্যাটাগরি মুছে ফেলুন</DialogTitle>
          </DialogHeader>
          {confirmDel && (
            <div className="space-y-3 text-sm">
              <div className="text-slate-700">
                <span className="font-medium">"{confirmDel.name}"</span> ক্যাটাগরি মুছবেন?
              </div>
              {confirmDel.used > 0 ? (
                <div className="space-y-2">
                  <div className="text-slate-600">
                    এই ক্যাটাগরিতে <span className="font-medium">{confirmDel.used}</span>টি লেনদেন আছে। সেগুলো কোন ক্যাটাগরিতে সরাবেন?
                  </div>
                  <select
                    value={confirmDel.target}
                    onChange={(e) => setConfirmDel({ ...confirmDel, target: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-200 rounded-md text-sm"
                    disabled={busy}
                  >
                    {availableTargets(confirmDel.name).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-slate-500 text-xs">এই ক্যাটাগরিতে কোনো লেনদেন নেই।</div>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              disabled={busy}
              onClick={() => setConfirmDel(null)}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              বাতিল
            </button>
            <button
              disabled={busy}
              onClick={performDelete}
              className="px-3 py-1.5 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {busy ? "মুছছি..." : "মুছুন"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}