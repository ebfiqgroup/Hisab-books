import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const RECENT_PREFIX = "recent_select_";

const loadRecent = (bucket: string): string[] => {
  if (typeof window === "undefined" || !bucket) return [];
  try { return JSON.parse(localStorage.getItem(RECENT_PREFIX + bucket) || "[]") as string[]; } catch { return []; }
};
const pushRecent = (bucket: string, value: string) => {
  if (typeof window === "undefined" || !bucket || !value) return;
  const next = [value, ...loadRecent(bucket).filter((v) => v !== value)].slice(0, 5);
  try { localStorage.setItem(RECENT_PREFIX + bucket, JSON.stringify(next)); } catch { /* noop */ }
};

export type SearchableSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  recentLabel?: string;
  /** localStorage bucket key for "recently used" tracking. Omit to disable. */
  recentKey?: string;
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  renderOption?: (value: string) => React.ReactNode;
};

/**
 * Accessible searchable dropdown: type-to-filter, arrow-key navigation,
 * Enter to pick, Escape to close, optional "recently used" section.
 */
export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "নির্বাচন করুন",
  searchPlaceholder = "খুঁজুন...",
  emptyText = "কিছু পাওয়া যায়নি",
  recentLabel = "সাম্প্রতিক",
  recentKey,
  allowClear = false,
  clearLabel = "সব",
  className,
  disabled,
  invalid,
  renderOption,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => { if (recentKey) setRecent(loadRecent(recentKey)); }, [recentKey, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) { setQuery(""); setActive(0); requestAnimationFrame(() => inputRef.current?.focus()); }
  }, [open]);

  const recentVisible = useMemo(
    () => (query ? [] : recent.filter((r) => options.includes(r) && r !== value).slice(0, 3)),
    [recent, options, query, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    return base;
  }, [options, query]);

  const flat = useMemo<string[]>(() => {
    const arr: string[] = [];
    if (allowClear && !query) arr.push("");
    arr.push(...recentVisible);
    arr.push(...filtered.filter((f) => !recentVisible.includes(f)));
    return arr;
  }, [allowClear, query, recentVisible, filtered]);

  const pick = (v: string) => {
    onChange(v);
    if (recentKey && v) pushRecent(recentKey, v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (flat.length) pick(flat[Math.min(active, flat.length - 1)]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "Tab") setOpen(false);
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const label = value || placeholder;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { e.preventDefault(); setOpen(true); } }}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-white text-sm text-left transition",
          invalid ? "border-rose-400" : "border-slate-200 hover:border-indigo-300",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className={cn("truncate", !value && "text-slate-400")}>
          {value && renderOption ? renderOption(value) : label}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-slate-100">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="w-full text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div ref={listRef} role="listbox" className="max-h-56 overflow-y-auto py-1">
            {flat.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-slate-400">{emptyText}</div>
            )}
            {flat.map((opt, idx) => {
              const isRecent = recentVisible.includes(opt) && !!opt;
              const prevRecent = idx > 0 && recentVisible.includes(flat[idx - 1]) && !!flat[idx - 1];
              return (
                <div key={`${opt}-${idx}`}>
                  {isRecent && idx === (allowClear && !query ? 1 : 0) && (
                    <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{recentLabel}</div>
                  )}
                  {!isRecent && prevRecent && <div className="my-1 border-t border-slate-100" />}
                  <button
                    type="button"
                    data-idx={idx}
                    role="option"
                    aria-selected={opt === value}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => pick(opt)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left",
                      idx === active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <span className="truncate">{opt ? (renderOption ? renderOption(opt) : opt) : clearLabel}</span>
                    {opt === value && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
