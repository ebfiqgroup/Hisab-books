import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StickyNote, Search, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

export const Route = createFileRoute("/_authenticated/notes")({ component: NotesPage });

type Note = { id: string; body: string; created_at: string };

function NotesPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const uid = useCurrentUserId();

  const notesQ = useQuery({
    queryKey: ["notes", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id,body,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  const notes = notesQ.data ?? [];

  const [noteInput, setNoteInput] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteInput, setEditNoteInput] = useState("");

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.body.toLowerCase().includes(q));
  }, [notes, noteSearch]);

  const saveNote = async () => {
    const body = noteInput.trim();
    if (!body) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const exists = notes.some((n) => n.body.trim() === body);
    if (exists) {
      toast.warning(t("এই নোট ইতিমধ্যে আছে।", "This note already exists."));
      return;
    }
    const { error } = await supabase.from("notes").insert({ user_id: user.id, body });
    if (error) { toast.error(error.message); return; }
    setNoteInput("");
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  const startEditNote = (n: Note) => {
    setEditingNoteId(n.id);
    setEditNoteInput(n.body);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteInput("");
  };

  const updateNote = async () => {
    const body = editNoteInput.trim();
    if (!body || !editingNoteId) return;
    const { error } = await supabase.from("notes").update({ body }).eq("id", editingNoteId);
    if (error) { toast.error(error.message); return; }
    setEditingNoteId(null);
    setEditNoteInput("");
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  const removeNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  return (
    <AppShell title={t("নোটস", "Notes")}>
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <StickyNote className="w-4 h-4 text-amber-500" />
            </div>
            <h2 className="font-bold text-slate-800">{t("নতুন নোট যোগ করুন", "Add a new note")}</h2>
          </div>
          <div className="flex gap-2">
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveNote()}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-300"
              placeholder={t("নোট লিখুন...", "Write a note...")}
            />
            <button
              onClick={saveNote}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {t("সেভ", "Save")}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800">{t("আপনার নোটস", "Your Notes")}</h2>
            <span className="text-xs text-slate-500">{filteredNotes.length} / {notes.length}</span>
          </div>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              placeholder={t("নোট খুঁজুন...", "Search notes...")}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
            />
          </div>
          <div className="space-y-2">
            {filteredNotes.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-8">
                {noteSearch
                  ? t("কোনো নোট পাওয়া যায়নি", "No notes found")
                  : t("কোনো নোট নেই", "No notes")}
              </div>
            )}
            {filteredNotes.map((n) =>
              editingNoteId === n.id ? (
                <div key={n.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <input
                    autoFocus
                    value={editNoteInput}
                    onChange={(e) => setEditNoteInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && updateNote()}
                    className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
                  />
                  <button onClick={updateNote} className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelEditNote} className="p-1.5 rounded-md hover:bg-rose-50 text-rose-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div key={n.id} className="group flex items-center gap-3 bg-amber-50/60 border border-amber-100 rounded-lg p-3 text-sm text-slate-700">
                  <span className="flex-1">{n.body}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => startEditNote(n)}
                      className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                      title={t("এডিট", "Edit")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeNote(n.id)}
                      className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                      title={t("ডিলিট", "Delete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
