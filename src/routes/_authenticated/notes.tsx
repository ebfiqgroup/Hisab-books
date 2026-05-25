import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StickyNote, Search, Pencil, Trash2, Check, X, Send, Clock, FileText } from "lucide-react";
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

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t("এইমাত্র", "just now");
    if (mins < 60) return t(`${mins} মিনিট আগে`, `${mins}m ago`);
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t(`${hrs} ঘন্টা আগে`, `${hrs}h ago`);
    const days = Math.floor(hrs / 24);
    if (days < 7) return t(`${days} দিন আগে`, `${days}d ago`);
    return d.toLocaleDateString();
  };

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
    const { error } = await supabase.from("notes").update({ body }).eq("id", editingNoteId).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    setEditingNoteId(null);
    setEditNoteInput("");
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  const removeNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  return (
    <AppShell title={t("নোটস", "Notes")}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg shadow-indigo-500/20">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
                <StickyNote className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("নোটস", "Notes")}</h1>
                <p className="text-sm text-white/80">{t("আপনার চিন্তা ও আইডিয়া সংরক্ষণ করুন", "Capture your thoughts and ideas")}</p>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <div className="text-3xl font-bold leading-none">{notes.length}</div>
              <div className="text-xs text-white/70 mt-1">{t("মোট নোট", "Total notes")}</div>
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-center gap-2 border-b border-slate-100">
            <FileText className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">{t("নতুন নোট", "New Note")}</span>
            <span className="ml-auto text-xs text-slate-400">{noteInput.length} {t("অক্ষর", "chars")}</span>
          </div>
          <div className="p-4">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveNote();
                }
              }}
              rows={4}
              className="w-full px-3 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 focus:bg-white transition resize-none placeholder:text-slate-400"
              placeholder={t("এখানে আপনার নোট লিখুন... (Enter দিয়ে সেভ, Shift+Enter দিয়ে নতুন লাইন)", "Write your note here... (Enter to save, Shift+Enter for new line)")}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400">
                {t("টিপস: Enter চাপুন সেভ করতে", "Tip: Press Enter to save")}
              </span>
              <button
                onClick={saveNote}
                disabled={!noteInput.trim()}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm shadow-indigo-500/30 transition"
              >
                <Send className="w-4 h-4" /> {t("সেভ করুন", "Save Note")}
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-800">{t("আপনার নোটস", "Your Notes")}</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                {filteredNotes.length}{noteSearch && ` / ${notes.length}`}
              </span>
            </div>
            <div className="relative w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder={t("খুঁজুন...", "Search...")}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          <div className="p-4">
            {filteredNotes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center mb-3">
                  <StickyNote className="w-7 h-7 text-indigo-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">
                  {noteSearch
                    ? t("কোনো নোট পাওয়া যায়নি", "No notes found")
                    : t("এখনও কোনো নোট নেই", "No notes yet")}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {noteSearch
                    ? t("অন্য শব্দ দিয়ে খুঁজে দেখুন", "Try a different search term")
                    : t("উপরে থেকে আপনার প্রথম নোট যোগ করুন", "Add your first note above")}
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {filteredNotes.map((n) =>
                editingNoteId === n.id ? (
                  <div key={n.id} className="sm:col-span-2 rounded-xl border-2 border-indigo-300 bg-indigo-50/40 p-3 shadow-sm">
                    <textarea
                      autoFocus
                      value={editNoteInput}
                      onChange={(e) => setEditNoteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          updateNote();
                        }
                      }}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <button
                        onClick={cancelEditNote}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> {t("বাতিল", "Cancel")}
                      </button>
                      <button
                        onClick={updateNote}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> {t("সেভ", "Save")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={n.id}
                    className="group relative rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-4 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50 transition-all"
                  >
                    <div className="absolute top-0 left-4 right-4 h-0.5 bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 rounded-b opacity-0 group-hover:opacity-100 transition" />
                    <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed line-clamp-6">
                      {n.body}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {formatTime(n.created_at)}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => startEditNote(n)}
                          className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition"
                          title={t("এডিট", "Edit")}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeNote(n.id)}
                          className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title={t("ডিলিট", "Delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
