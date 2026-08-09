import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  StickyNote, Search, Pencil, Trash2, Clock, FileText, Plus, Pin, PinOff,
  MoreVertical, Copy, ArrowUpDown, Share2, Tag, RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/SearchableSelect";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "নোটস - হিসাব বই" },
      { name: "description", content: "আর্থিক নোট ও আইডিয়া সংরক্ষণ করুন — শিরোনাম, ক্যাটাগরি, রঙ ও পিন সহ।" },
      { property: "og:title", content: "নোটস - হিসাব বই" },
      { property: "og:description", content: "আর্থিক নোট ও আইডিয়া সংরক্ষণ করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotesPage,
});

type Note = {
  id: string;
  body: string;
  title: string | null;
  category: string | null;
  color: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

const COLORS = [
  { key: "default", ring: "border-slate-200", bar: "from-slate-300 to-slate-400", chip: "bg-slate-100 text-slate-600" },
  { key: "indigo", ring: "border-indigo-200", bar: "from-indigo-400 to-violet-500", chip: "bg-indigo-50 text-indigo-600" },
  { key: "emerald", ring: "border-emerald-200", bar: "from-emerald-400 to-teal-500", chip: "bg-emerald-50 text-emerald-600" },
  { key: "amber", ring: "border-amber-200", bar: "from-amber-400 to-orange-500", chip: "bg-amber-50 text-amber-700" },
  { key: "rose", ring: "border-rose-200", bar: "from-rose-400 to-pink-500", chip: "bg-rose-50 text-rose-600" },
  { key: "sky", ring: "border-sky-200", bar: "from-sky-400 to-blue-500", chip: "bg-sky-50 text-sky-600" },
];
const colorOf = (k: string) => COLORS.find((c) => c.key === k) ?? COLORS[0];

const DRAFT_KEY = "notes_draft_v1";
type SortKey = "pinned" | "newest" | "oldest" | "updated" | "title";

const emptyForm = { title: "", body: "", category: "", color: "default", pinned: false };

function NotesPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const uid = useCurrentUserId();

  const notesQ = useQuery({
    queryKey: ["notes", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id,body,title,category,color,pinned,created_at,updated_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  const notes = notesQ.data ?? [];

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortKey>("pinned");
  const [catFilter, setCatFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Note | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<{ body?: string; title?: string }>({});
  const [saving, setSaving] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Note | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search (keeps filtering cheap on large lists).
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim().toLowerCase()), 200);
    return () => clearTimeout(id);
  }, [search]);

  // Close the ⋮ action menu on any outside click.
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  // Autosave draft for new notes.
  useEffect(() => {
    if (!open || edit) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* noop */ }
    }, 500);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [form, open, edit]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const n of notes) if (n.category) s.add(n.category);
    return Array.from(s).sort();
  }, [notes]);

  const visible = useMemo(() => {
    let list = notes;
    if (catFilter) list = list.filter((n) => (n.category ?? "") === catFilter);
    if (debounced) {
      list = list.filter((n) =>
        n.body.toLowerCase().includes(debounced) ||
        (n.title ?? "").toLowerCase().includes(debounced) ||
        (n.category ?? "").toLowerCase().includes(debounced));
    }
    const arr = list.slice();
    const byNew = (a: Note, b: Note) => b.created_at.localeCompare(a.created_at);
    if (sort === "pinned") arr.sort((a, b) => Number(b.pinned) - Number(a.pinned) || byNew(a, b));
    else if (sort === "newest") arr.sort(byNew);
    else if (sort === "oldest") arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sort === "updated") arr.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    else arr.sort((a, b) => (a.title ?? a.body).localeCompare(b.title ?? b.body));
    return arr;
  }, [notes, debounced, sort, catFilter]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return t("এইমাত্র", "just now");
    if (mins < 60) return t(`${mins} মিনিট আগে`, `${mins}m ago`);
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t(`${hrs} ঘন্টা আগে`, `${hrs}h ago`);
    const days = Math.floor(hrs / 24);
    if (days < 7) return t(`${days} দিন আগে`, `${days}d ago`);
    return d.toLocaleDateString();
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["notes"] });

  const openNew = () => {
    setEdit(null);
    setErrors({});
    let draft = emptyForm;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const p = JSON.parse(raw) as typeof emptyForm;
        if (p && (p.body || p.title)) draft = { ...emptyForm, ...p };
      }
    } catch { /* noop */ }
    setForm(draft);
    setOpen(true);
  };

  const openEdit = (n: Note) => {
    setEdit(n);
    setErrors({});
    setForm({
      title: n.title ?? "",
      body: n.body,
      category: n.category ?? "",
      color: n.color || "default",
      pinned: n.pinned,
    });
    setOpen(true);
  };

  const validate = () => {
    const e: { body?: string; title?: string } = {};
    const body = form.body.trim();
    if (!body) e.body = t("নোটের বিবরণ লিখুন", "Description is required");
    else if (body.length > 5000) e.body = t("সর্বোচ্চ ৫০০০ অক্ষর", "Max 5000 characters");
    if (form.title.trim().length > 120) e.title = t("সর্বোচ্চ ১২০ অক্ষর", "Max 120 characters");
    const dup = notes.some((n) => n.id !== edit?.id && n.body.trim() === body);
    if (dup) e.body = t("হুবহু এই নোট ইতিমধ্যে আছে", "An identical note already exists");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      body: form.body.trim(),
      title: form.title.trim() || null,
      category: form.category.trim() || null,
      color: form.color,
      pinned: form.pinned,
    };
    const { error } = edit
      ? await supabase.from("notes").update(payload).eq("id", edit.id).eq("user_id", uid)
      : await supabase.from("notes").insert({ ...payload, user_id: uid });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (!edit) { try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ } }
    toast.success(edit ? t("নোট আপডেট হয়েছে", "Note updated") : t("নোট যোগ হয়েছে", "Note added"));
    setOpen(false);
    setForm(emptyForm);
    refresh();
  };

  const remove = async (n: Note) => {
    const { error } = await supabase.from("notes").delete().eq("id", n.id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success(t("নোট মুছে ফেলা হয়েছে", "Note deleted"));
    setConfirmDel(null);
    refresh();
  };

  const togglePin = async (n: Note) => {
    const { error } = await supabase.from("notes").update({ pinned: !n.pinned }).eq("id", n.id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success(n.pinned ? t("পিন সরানো হয়েছে", "Unpinned") : t("পিন করা হয়েছে", "Pinned"));
    refresh();
  };

  const duplicate = async (n: Note) => {
    const { error } = await supabase.from("notes").insert({
      user_id: uid,
      body: `${n.body} (${t("কপি", "copy")})`,
      title: n.title ? `${n.title} (${t("কপি", "copy")})` : null,
      category: n.category,
      color: n.color,
      pinned: false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t("নোট কপি হয়েছে", "Note duplicated"));
    refresh();
  };

  const share = async (n: Note) => {
    const text = `${n.title ? n.title + "\n\n" : ""}${n.body}`;
    try {
      if (navigator.share) await navigator.share({ title: n.title ?? t("নোট", "Note"), text });
      else { await navigator.clipboard.writeText(text); toast.success(t("নোট কপি হয়েছে", "Copied to clipboard")); }
    } catch { /* user cancelled */ }
  };

  const sortOptions: { k: SortKey; label: string }[] = [
    { k: "pinned", label: t("পিন প্রথমে", "Pinned first") },
    { k: "newest", label: t("নতুন আগে", "Newest") },
    { k: "oldest", label: t("পুরনো আগে", "Oldest") },
    { k: "updated", label: t("সদ্য আপডেট", "Recently updated") },
    { k: "title", label: t("শিরোনাম (অ-আ)", "Title (A-Z)") },
  ];

  return (
    <AppShell title={t("নোটস", "Notes")}>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg shadow-indigo-500/20">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
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

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-sm shadow-indigo-500/30">
            <Plus className="w-4 h-4" /> {t("নতুন নোট", "New note")}
          </button>
          <button onClick={refresh} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${notesQ.isFetching ? "animate-spin" : ""}`} /> {t("রিফ্রেশ", "Refresh")}
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("শিরোনাম, বিবরণ, ক্যাটাগরি খুঁজুন...", "Search title, body, category...")}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <SearchableSelect
                value={catFilter}
                options={categories}
                onChange={setCatFilter}
                allowClear
                clearLabel={t("সব ক্যাটাগরি", "All categories")}
                placeholder={t("সব ক্যাটাগরি", "All categories")}
                searchPlaceholder={t("ক্যাটাগরি খুঁজুন...", "Search category...")}
                emptyText={t("কোনো ক্যাটাগরি নেই", "No categories")}
                recentLabel={t("সাম্প্রতিক", "Recent")}
              />
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400"
              >
                {sortOptions.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {t("দেখানো হচ্ছে", "Showing")} <span className="font-semibold text-slate-700">{visible.length}</span> / {notes.length}
          </div>
        </div>

        {/* List */}
        {notesQ.isLoading ? (
          <div className="text-center text-slate-500 py-16">{t("লোড হচ্ছে...", "Loading...")}</div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center mb-3">
              <StickyNote className="w-7 h-7 text-indigo-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {search || catFilter ? t("কোনো নোট পাওয়া যায়নি", "No notes found") : t("এখনও কোনো নোট নেই", "No notes yet")}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search || catFilter ? t("অন্য শব্দ দিয়ে খুঁজে দেখুন", "Try a different search") : t('"নতুন নোট" দিয়ে শুরু করুন', 'Start with "New note"')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((n) => {
              const c = colorOf(n.color);
              return (
                <div key={n.id} className={`group relative rounded-xl border ${c.ring} bg-white p-4 hover:shadow-md hover:shadow-indigo-100/50 transition-all flex flex-col`}>
                  <div className={`absolute top-0 left-4 right-4 h-0.5 rounded-b bg-gradient-to-r ${c.bar}`} />
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      {n.title && <h3 className="text-sm font-bold text-slate-800 truncate">{n.title}</h3>}
                      {n.category && (
                        <span className={`inline-flex items-center gap-1 mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${c.chip}`}>
                          <Tag className="w-2.5 h-2.5" /> {n.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => togglePin(n)}
                        title={n.pinned ? t("পিন সরান", "Unpin") : t("পিন করুন", "Pin")}
                        className={`p-1.5 rounded-md transition ${n.pinned ? "text-amber-500 bg-amber-50" : "text-slate-300 hover:text-amber-500 hover:bg-amber-50"}`}
                      >
                        {n.pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === n.id ? null : n.id); }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          title={t("অ্যাকশন", "Actions")}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {menuFor === n.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-xl z-30 overflow-hidden"
                          >
                            <button onClick={() => { setMenuFor(null); openEdit(n); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                              <Pencil className="w-3.5 h-3.5" /> {t("এডিট", "Edit")}
                            </button>
                            <button onClick={() => { setMenuFor(null); duplicate(n); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                              <Copy className="w-3.5 h-3.5" /> {t("ডুপ্লিকেট", "Duplicate")}
                            </button>
                            <button onClick={() => { setMenuFor(null); share(n); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                              <Share2 className="w-3.5 h-3.5" /> {t("শেয়ার", "Share")}
                            </button>
                            <button onClick={() => { setMenuFor(null); setConfirmDel(n); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 border-t border-slate-100">
                              <Trash2 className="w-3.5 h-3.5" /> {t("ডিলিট", "Delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed line-clamp-6 flex-1">{n.body}</p>
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatTime(n.created_at)}
                    </span>
                    {n.updated_at !== n.created_at && (
                      <span className="truncate">{t("আপডেট", "Updated")}: {formatTime(n.updated_at)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              {edit ? t("নোট এডিট", "Edit note") : t("নতুন নোট", "New note")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t("শিরোনাম (ঐচ্ছিক)", "Title (optional)")}</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("যেমন: মাসিক বাজেটের হিসাব", "e.g. Monthly budget notes")}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.title ? "border-rose-400" : "border-slate-200"}`}
              />
              {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                {t("বিবরণ", "Description")} <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={5}
                placeholder={t("এখানে আপনার নোট লিখুন...", "Write your note here...")}
                className={`w-full px-3 py-2 border rounded-lg text-sm resize-none ${errors.body ? "border-rose-400" : "border-slate-200"}`}
              />
              <div className="flex items-center justify-between mt-1">
                {errors.body ? <p className="text-xs text-rose-500">{errors.body}</p> : <span />}
                <span className="text-[11px] text-slate-400">{form.body.length}/5000</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t("ক্যাটাগরি", "Category")}</label>
              <SearchableSelect
                value={form.category}
                options={categories}
                onChange={(v) => setForm({ ...form, category: v })}
                recentKey="note_cats"
                allowClear
                clearLabel={t("ক্যাটাগরি নেই", "No category")}
                placeholder={t("ক্যাটাগরি বাছুন", "Select category")}
                searchPlaceholder={t("ক্যাটাগরি খুঁজুন...", "Search category...")}
                emptyText={t("কোনো ক্যাটাগরি নেই", "No categories")}
                recentLabel={t("সাম্প্রতিক", "Recent")}
              />
              <div className="flex gap-2 mt-2">
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder={t("অথবা নতুন ক্যাটাগরি লিখুন", "Or type a new category")}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1.5">{t("রঙের লেবেল", "Color label")}</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.key })}
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${c.bar} ${form.color === c.key ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
                    title={c.key}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="rounded border-slate-300" />
              <Pin className="w-3.5 h-3.5 text-amber-500" /> {t("উপরে পিন করুন", "Pin to top")}
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
                {t("বাতিল", "Cancel")}
              </button>
              <button
                onClick={() => { setForm(edit ? { title: edit.title ?? "", body: edit.body, category: edit.category ?? "", color: edit.color, pinned: edit.pinned } : emptyForm); setErrors({}); }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
              >
                {t("রিসেট", "Reset")}
              </button>
              <button onClick={save} disabled={saving} className="flex-1 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? t("সেভ হচ্ছে...", "Saving...") : t("সেভ", "Save")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("নোট মুছে ফেলবেন?", "Delete this note?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("এই কাজটি ফিরিয়ে আনা যাবে না।", "This action cannot be undone.")}
              {confirmDel?.title ? ` — “${confirmDel.title}”` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("বাতিল", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && remove(confirmDel)} className="bg-rose-600 hover:bg-rose-700">
              {t("ডিলিট", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
