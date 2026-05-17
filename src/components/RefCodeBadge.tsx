import { useState } from "react";
import { Copy, Check, Hash } from "lucide-react";
import { useRefCode } from "@/hooks/useRefCode";

type Variant = "header" | "menu" | "sidebar" | "inline";

export function RefCodeBadge({ variant = "inline", label = "রেফারেন্স কোড" }: { variant?: Variant; label?: string }) {
  const refCode = useRefCode();
  const [copied, setCopied] = useState(false);
  if (!refCode) return null;

  const copy = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(refCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  if (variant === "sidebar") {
    return (
      <div className="mx-4 mb-3 px-3 py-2 rounded-lg flex items-center justify-between gap-2" style={{ background: "color-mix(in oklab, var(--brand-gold-500) 8%, transparent)", border: "1px solid color-mix(in oklab, var(--brand-gold-500) 22%, transparent)" }}>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.15em] text-white/55">Ref</div>
          <div className="text-sm font-mono tracking-wider text-white truncate">{refCode}</div>
        </div>
        <button onClick={copy} aria-label="কপি করুন" className="p-1.5 rounded-md hover:bg-white/10 transition shrink-0" style={{ color: "var(--brand-gold-500)" }}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  if (variant === "menu") {
    return (
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={{ borderColor: "var(--brand-line)" }}>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
          <div className="text-sm font-mono tracking-wider truncate" style={{ color: "var(--brand-ink)" }}>{refCode}</div>
        </div>
        <button onClick={copy} aria-label="কপি করুন" className="p-1.5 rounded-md hover:bg-slate-100 transition shrink-0">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
        </button>
      </div>
    );
  }

  if (variant === "header") {
    return (
      <button onClick={copy} title="কপি করুন" className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 bg-white rounded-lg border hover:shadow-sm transition" style={{ borderColor: "var(--brand-line)" }}>
        <Hash className="w-3.5 h-3.5" style={{ color: "var(--brand-ink-soft)" }} />
        <span className="text-xs font-mono tracking-wider" style={{ color: "var(--brand-ink)" }}>{refCode}</span>
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" style={{ color: "var(--brand-ink-soft)" }} />}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white" style={{ borderColor: "var(--brand-line)" }}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm font-mono tracking-wider" style={{ color: "var(--brand-ink)" }}>{refCode}</span>
      <button onClick={copy} aria-label="কপি করুন" className="p-1 rounded hover:bg-slate-100 transition">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
      </button>
    </div>
  );
}