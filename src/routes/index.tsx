import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet, PiggyBank, Target, Users, Sparkles, BarChart3,
  ArrowRight, Check, ShieldCheck, LineChart, ArrowUpRight, Quote,
  Mail, Send, Loader2, Crown, Star,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "আমার হিসাব — আপনার অর্থ, আপনার গল্প" },
      { name: "description", content: "বাংলায় সহজ ব্যক্তিগত আর্থিক ব্যবস্থাপনা। আয়-ব্যয়, বাজেট, লক্ষ্য ও দেনা-পাওনা — সব এক জায়গায়।" },
      { property: "og:title", content: "আমার হিসাব" },
      { property: "og:description", content: "বাংলায় সাজানো ব্যক্তিগত ফাইন্যান্স ড্যাশবোর্ড।" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => subscription.unsubscribe();
  }, []);

  const primaryTo = authed ? "/app" : "/auth";
  const primaryLabel = authed ? "ড্যাশবোর্ডে যান" : "বিনামূল্যে শুরু করুন";

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-page)" }}>
      {/* Nav */}
      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ background: "color-mix(in oklab, var(--brand-ivory) 80%, transparent)", borderBottom: "1px solid var(--brand-line)" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: "var(--gradient-brand)" }}>
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xl tracking-tight" style={{ fontFamily: "var(--font-display)" }}>আমার হিসাব</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm" style={{ color: "var(--brand-ink-soft)" }}>
            <a href="#features" className="hover:opacity-70">ফিচার</a>
            <a href="#how" className="hover:opacity-70">কীভাবে কাজ করে</a>
            <a href="#pricing" className="hover:opacity-70">মূল্য</a>
            <a href="#voices" className="hover:opacity-70">ব্যবহারকারী</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:inline text-sm px-3 py-2 rounded-lg hover:bg-white/60" style={{ color: "var(--brand-ink)" }}>
              লগইন
            </Link>
            <Link to={primaryTo} className="text-sm px-4 py-2 rounded-lg text-white shadow-sm" style={{ background: "var(--gradient-brand)" }}>
              {authed ? "ড্যাশবোর্ড" : "শুরু করুন"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-16 md:pt-24 pb-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border" style={{ borderColor: "var(--brand-line)", background: "white", color: "var(--brand-emerald-700)" }}>
            <Sparkles className="w-3.5 h-3.5" /> বাংলায় সাজানো আর্থিক জার্নাল
          </span>
          <h1 className="mt-5 text-5xl md:text-6xl leading-[1.05]" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>
            আপনার অর্থ,<br />
            <span style={{ color: "var(--brand-emerald-700)" }}>আপনার গল্প।</span>
          </h1>
          <p className="mt-5 text-lg max-w-lg" style={{ color: "var(--brand-ink-soft)" }}>
            প্রতিটি টাকার হিসাব, প্রতিটি স্বপ্নের লক্ষ্য — এক শান্ত, পরিচ্ছন্ন ড্যাশবোর্ডে।
            আয়-ব্যয় থেকে শুরু করে বাজেট, দেনা-পাওনা ও AI পরামর্শ — সবই বাংলায়।
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={primaryTo} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-md" style={{ background: "var(--gradient-brand)" }}>
              {primaryLabel} <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm bg-white border" style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink)" }}>
              ফিচার দেখুন
            </a>
          </div>
          <div className="mt-6 flex items-center gap-5 text-xs" style={{ color: "var(--brand-ink-soft)" }}>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" style={{ color: "var(--brand-emerald-700)" }} /> এনক্রিপ্টেড ডেটা</span>
            <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "var(--brand-emerald-700)" }} /> বিনামূল্যে শুরু</span>
            <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "var(--brand-emerald-700)" }} /> বাংলা ইন্টারফেস</span>
          </div>
        </div>

        {/* Mock dashboard preview */}
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl blur-2xl opacity-50" style={{ background: "var(--gradient-brand)" }} />
          <div className="relative brand-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs" style={{ color: "var(--brand-ink-soft)" }}>মে ২০২৬</div>
                <div className="text-lg" style={{ fontFamily: "var(--font-display)" }}>মাসিক সারাংশ</div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "color-mix(in oklab, var(--brand-emerald-700) 12%, transparent)", color: "var(--brand-emerald-700)" }}>লাইভ</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { l: "আয়", v: "৳ ৮৪,২০০", c: "var(--brand-emerald-700)", Icon: Wallet },
                { l: "ব্যয়", v: "৳ ৫১,৭৩০", c: "#e11d48", Icon: BarChart3 },
                { l: "সঞ্চয়", v: "৳ ৩২,৪৭০", c: "#2563eb", Icon: PiggyBank },
              ].map((s) => (
                <div key={s.l} className="p-3 rounded-xl border bg-white" style={{ borderColor: "var(--brand-line)" }}>
                  <s.Icon className="w-4 h-4 mb-2" style={{ color: s.c }} />
                  <div className="text-[11px]" style={{ color: "var(--brand-ink-soft)" }}>{s.l}</div>
                  <div className="text-sm font-semibold mt-0.5">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="h-32 rounded-xl border flex items-end gap-1.5 p-3" style={{ borderColor: "var(--brand-line)", background: "color-mix(in oklab, var(--brand-cream) 60%, white)" }}>
              {[40, 62, 35, 78, 55, 90, 68, 82, 48, 70, 92, 60].map((h, i) => (
                <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i % 3 === 0 ? "var(--brand-emerald-700)" : "var(--brand-gold-500)", opacity: 0.85 }} />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs" style={{ color: "var(--brand-ink-soft)" }}>
              <span className="inline-flex items-center gap-1"><LineChart className="w-3.5 h-3.5" /> গত ১২ মাস</span>
              <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--brand-emerald-700)" }}>
                +১৮% <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-20">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--brand-gold-600)" }}>ফিচার</div>
          <h2 className="text-3xl md:text-4xl mt-2" style={{ fontFamily: "var(--font-display)" }}>
            আপনার আর্থিক জীবনের প্রতিটি অধ্যায়
          </h2>
          <p className="mt-3" style={{ color: "var(--brand-ink-soft)" }}>
            ছোট ছোট অভ্যাস থেকে বড় বড় লক্ষ্য — সবকিছু এক ছাদের নিচে।
          </p>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { Icon: Wallet, t: "আয় ও ব্যয়", d: "প্রতিটি লেনদেন ক্যাটাগরিভিত্তিক, নোটসহ সংরক্ষণ — মুহূর্তেই সারাংশ।" },
            { Icon: PiggyBank, t: "স্মার্ট বাজেট", d: "মাসিক সীমা দিন, খরচ ছাড়িয়ে গেলে নিজে থেকেই সতর্কতা।" },
            { Icon: Target, t: "লক্ষ্য", d: "স্বপ্ন থেকে সংখ্যা — প্রতিটি লক্ষ্যের অগ্রগতি দৃশ্যমান।" },
            { Icon: Users, t: "দেনা ও পাওনা", d: "কাকে দিতে হবে, কার কাছ থেকে পাওনা — কখনো ভুলবেন না।" },
            { Icon: Sparkles, t: "AI পরামর্শ", d: "আপনার অভ্যাস বুঝে ব্যয় কমানোর বুদ্ধিমান সাজেশন।" },
            { Icon: BarChart3, t: "মাসিক রিপোর্ট", d: "চার্ট, ট্রেন্ড আর তুলনা — এক ক্লিকেই PDF এক্সপোর্ট।" },
          ].map((f) => (
            <div key={f.t} className="brand-card p-6">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "color-mix(in oklab, var(--brand-emerald-700) 10%, white)", color: "var(--brand-emerald-700)" }}>
                <f.Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>{f.t}</h3>
              <p className="text-sm mt-1.5" style={{ color: "var(--brand-ink-soft)" }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-5 py-20">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--brand-gold-600)" }}>কীভাবে কাজ করে</div>
            <h2 className="text-3xl md:text-4xl mt-2" style={{ fontFamily: "var(--font-display)" }}>
              তিন ধাপে শুরু,<br />সারা জীবনের অভ্যাস।
            </h2>
            <p className="mt-3 max-w-md" style={{ color: "var(--brand-ink-soft)" }}>
              জটিল কনফিগারেশন নেই, কোনো সেটআপ ফি নেই — মিনিটেই প্রথম রেকর্ড।
            </p>
            <Link to={primaryTo} className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-medium" style={{ background: "var(--gradient-brand)" }}>
              {primaryLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <ol className="space-y-4">
            {[
              { n: "০১", t: "অ্যাকাউন্ট তৈরি করুন", d: "ইমেল দিয়ে ৩০ সেকেন্ডে যাত্রা শুরু।" },
              { n: "০২", t: "প্রথম লেনদেন যোগ করুন", d: "আয় বা ব্যয় — যেকোনো কিছু দিয়েই শুরু।" },
              { n: "০৩", t: "ড্যাশবোর্ডে দেখুন", d: "চার্ট, লক্ষ্য আর পরামর্শ — সব আপনার সামনে।" },
            ].map((s) => (
              <li key={s.n} className="brand-card p-5 flex gap-4 items-start">
                <span className="text-2xl" style={{ fontFamily: "var(--font-display)", color: "var(--brand-gold-600)" }}>{s.n}</span>
                <div>
                  <div className="font-semibold">{s.t}</div>
                  <div className="text-sm" style={{ color: "var(--brand-ink-soft)" }}>{s.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Testimonials */}
      <section id="voices" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--brand-gold-600)" }}>ব্যবহারকারীদের কথা</div>
        <h2 className="text-3xl md:text-4xl mt-2 max-w-xl" style={{ fontFamily: "var(--font-display)" }}>
          ছোট ছোট অভ্যাসই বদলে দেয় গল্প।
        </h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {[
            { q: "প্রথমবারের মতো জানলাম মাসিক কত খরচ কোথায় যাচ্ছে। সঞ্চয় বেড়েছে দ্বিগুণ।", n: "তানজিনা আহমেদ", r: "শিক্ষক" },
            { q: "বাংলায় হিসাব রাখাটা অনেক স্বাভাবিক লাগে। ইন্টারফেসটা শান্ত ও পরিচ্ছন্ন।", n: "রাফসান কবির", r: "ফ্রিল্যান্সার" },
            { q: "দেনা-পাওনার ট্র্যাকিং দারুণ। আর কখনো ভুলে যাই না কাকে কত দিতে হবে।", n: "নুসরাত জাহান", r: "উদ্যোক্তা" },
          ].map((t) => (
            <figure key={t.n} className="brand-card p-6">
              <Quote className="w-5 h-5 mb-3" style={{ color: "var(--brand-gold-600)" }} />
              <blockquote className="text-base leading-relaxed" style={{ color: "var(--brand-ink)" }}>
                "{t.q}"
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <div className="font-semibold">{t.n}</div>
                <div style={{ color: "var(--brand-ink-soft)" }}>{t.r}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl p-10 md:p-14 text-white text-center" style={{ background: "var(--gradient-brand)" }}>
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-20" style={{ background: "var(--brand-gold-300)" }} />
          <h2 className="text-3xl md:text-5xl relative" style={{ fontFamily: "var(--font-display)" }}>
            আজই শুরু করুন আপনার আর্থিক যাত্রা
          </h2>
          <p className="mt-3 relative opacity-90 max-w-xl mx-auto">
            বিনামূল্যে। কোনো কার্ড লাগবে না। মাত্র এক মিনিটে।
          </p>
          <Link to={primaryTo} className="mt-7 relative inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-sm font-semibold" style={{ color: "var(--brand-emerald-800)" }}>
            {primaryLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

/* ───────────── Pricing ───────────── */

type Tier = {
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
};

const TIERS: Tier[] = [
  {
    name: "ফ্রি",
    price: "৳ ০",
    period: "/চিরকাল",
    tagline: "শুরুর জন্য পারফেক্ট",
    features: ["মাসিক ৫০টি লেনদেন", "মৌলিক বাজেট ও লক্ষ্য", "১টি অ্যাকাউন্ট", "মোবাইল ও ওয়েব"],
    cta: "বিনামূল্যে শুরু",
    Icon: Star,
  },
  {
    name: "প্রো",
    price: "৳ ১৯৯",
    period: "/মাস",
    tagline: "সিরিয়াস ব্যবহারকারীদের জন্য",
    features: ["আনলিমিটেড লেনদেন", "AI পরামর্শ ও ইনসাইট", "অ্যাডভান্সড রিপোর্ট ও PDF", "দেনা-পাওনা রিমাইন্ডার", "অগ্রাধিকার সাপোর্ট"],
    cta: "প্রো নিন",
    highlight: true,
    Icon: Sparkles,
  },
  {
    name: "প্রিমিয়াম",
    price: "৳ ৪৯৯",
    period: "/মাস",
    tagline: "পরিবার ও ছোট ব্যবসার জন্য",
    features: ["প্রো-এর সব ফিচার", "৫টি পর্যন্ত সদস্য", "কাস্টম ক্যাটাগরি ও ট্যাগ", "API অ্যাক্সেস", "ডেডিকেটেড ম্যানেজার"],
    cta: "প্রিমিয়াম নিন",
    Icon: Crown,
  },
];

function PricingSection({ primaryTo }: { primaryTo: string }) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <section id="pricing" className="max-w-6xl mx-auto px-5 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--brand-gold-600)" }}>সাবস্ক্রিপশন</div>
        <h2 className="text-3xl md:text-4xl mt-2" style={{ fontFamily: "var(--font-display)" }}>
          সরল মূল্য, স্বচ্ছ পরিকল্পনা
        </h2>
        <p className="mt-3" style={{ color: "var(--brand-ink-soft)" }}>
          যেকোনো সময় আপগ্রেড বা বাতিল — কোনো লুকানো ফি নেই।
        </p>

        <div className="mt-6 inline-flex p-1 rounded-full border bg-white" style={{ borderColor: "var(--brand-line)" }}>
          {(["monthly", "yearly"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className="px-4 py-1.5 rounded-full text-sm transition-colors"
              style={{
                background: billing === b ? "var(--brand-emerald-700)" : "transparent",
                color: billing === b ? "white" : "var(--brand-ink-soft)",
              }}
            >
              {b === "monthly" ? "মাসিক" : "বার্ষিক"}
              {b === "yearly" && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--brand-gold-300)", color: "var(--brand-emerald-900)" }}>
                  ২০% ছাড়
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid md:grid-cols-3 gap-5">
        {TIERS.map((t) => {
          const isYearly = billing === "yearly" && t.price !== "৳ ০";
          const numeric = Number(t.price.replace(/[^\d]/g, ""));
          const displayPrice = isYearly
            ? `৳ ${Math.round(numeric * 12 * 0.8).toLocaleString("bn-BD")}`
            : t.price;
          const displayPeriod = isYearly ? "/বছর" : t.period;

          return (
            <div
              key={t.name}
              className="relative brand-card p-7 flex flex-col"
              style={
                t.highlight
                  ? {
                      borderColor: "var(--brand-gold-500)",
                      boxShadow: "var(--shadow-elegant)",
                      transform: "translateY(-4px)",
                    }
                  : undefined
              }
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-medium text-white shadow-sm" style={{ background: "var(--gradient-brand)" }}>
                  সর্বাধিক জনপ্রিয়
                </span>
              )}
              <div className="flex items-center gap-2 mb-1">
                <t.Icon className="w-4 h-4" style={{ color: "var(--brand-gold-600)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--brand-emerald-700)" }}>{t.name}</span>
              </div>
              <div className="text-xs" style={{ color: "var(--brand-ink-soft)" }}>{t.tagline}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{displayPrice}</span>
                <span className="text-sm" style={{ color: "var(--brand-ink-soft)" }}>{displayPeriod}</span>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--brand-emerald-700)" }} />
                    <span style={{ color: "var(--brand-ink)" }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={primaryTo}
                className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={
                  t.highlight
                    ? { background: "var(--gradient-brand)", color: "white" }
                    : { background: "white", color: "var(--brand-emerald-800)", border: "1px solid var(--brand-line)" }
                }
              >
                {t.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs" style={{ color: "var(--brand-ink-soft)" }}>
        সকল পরিকল্পনায় ১৪ দিনের ফ্রি ট্রায়াল • যেকোনো সময় বাতিল
      </p>
    </section>
  );
}

/* ───────────── Footer with lead capture ───────────── */

function Footer() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("সঠিক ইমেইল দিন");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("leads").insert({
      name: name.trim() || null,
      email: email.trim(),
      message: message.trim() || null,
      source: "landing_footer",
    });
    setLoading(false);
    if (error) {
      toast.error("জমা দেওয়া যায়নি, আবার চেষ্টা করুন");
      return;
    }
    toast.success("ধন্যবাদ! শীঘ্রই যোগাযোগ করব।");
    setName(""); setEmail(""); setMessage("");
  };

  return (
    <footer className="border-t" style={{ borderColor: "var(--brand-line)", background: "color-mix(in oklab, var(--brand-cream) 60%, white)" }}>
      <div className="max-w-6xl mx-auto px-5 py-14 grid md:grid-cols-2 gap-10">
        {/* Brand + nav */}
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: "var(--gradient-brand)" }}>
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xl" style={{ fontFamily: "var(--font-display)" }}>আমার হিসাব</span>
          </div>
          <p className="mt-3 max-w-sm text-sm" style={{ color: "var(--brand-ink-soft)" }}>
            বাংলায় সাজানো আপনার ব্যক্তিগত আর্থিক জার্নাল। যত্নে তৈরি, প্রতিদিনের জন্য।
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: "var(--brand-ink-soft)" }}>
            <a href="#features" className="hover:text-emerald-800">ফিচার</a>
            <a href="#how" className="hover:text-emerald-800">কীভাবে কাজ করে</a>
            <a href="#pricing" className="hover:text-emerald-800">মূল্য</a>
            <a href="#voices" className="hover:text-emerald-800">ব্যবহারকারী</a>
            <Link to="/auth" className="hover:text-emerald-800">লগইন</Link>
          </div>
        </div>

        {/* Lead form */}
        <div className="brand-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4" style={{ color: "var(--brand-emerald-700)" }} />
            <span className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--brand-gold-600)" }}>যোগাযোগ</span>
          </div>
          <h3 className="text-xl mb-1" style={{ fontFamily: "var(--font-display)" }}>আপডেট ও অফার পেতে চান?</h3>
          <p className="text-sm mb-4" style={{ color: "var(--brand-ink-soft)" }}>
            ইমেইল রেখে যান — নতুন ফিচার ও বিশেষ অফারের খবর সরাসরি পাবেন।
          </p>
          <form onSubmit={submit} className="space-y-2.5">
            <div className="grid sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="আপনার নাম (ঐচ্ছিক)"
                className="px-3 py-2.5 rounded-lg border text-sm bg-white outline-none focus:border-emerald-600"
                style={{ borderColor: "var(--brand-line)" }}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ইমেইল ঠিকানা"
                className="px-3 py-2.5 rounded-lg border text-sm bg-white outline-none focus:border-emerald-600"
                style={{ borderColor: "var(--brand-line)" }}
              />
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="মন্তব্য বা প্রশ্ন (ঐচ্ছিক)"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border text-sm bg-white outline-none focus:border-emerald-600 resize-none"
              style={{ borderColor: "var(--brand-line)" }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-60"
              style={{ background: "var(--gradient-brand)" }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? "পাঠানো হচ্ছে…" : "পাঠিয়ে দিন"}
            </button>
          </form>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: "var(--brand-line)" }}>
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs" style={{ color: "var(--brand-ink-soft)" }}>
          <div>© {new Date().getFullYear()} আমার হিসাব — যত্নে তৈরি, বাংলায়।</div>
          <div className="flex gap-4">
            <span>প্রাইভেসি</span>
            <span>শর্তাবলি</span>
          </div>
        </div>
      </div>
    </footer>
  );
}