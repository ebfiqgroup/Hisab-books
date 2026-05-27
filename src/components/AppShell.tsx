import { ReactNode, useState, useRef, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Bell, ChevronDown, LogOut, User as UserIcon, Settings as SettingsIcon, Headset, ArrowLeft, Sun, Moon, Download, Copy, Check, Share2, Smartphone, Apple, Monitor, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useRouter, useLocation } from "@tanstack/react-router";
import { RefCodeBadge } from "./RefCodeBadge";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { RealtimeStatusBadge } from "./RealtimeStatusBadge";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { Tooltip } from "./Tooltip";
import { useDeferredPrompt, promptInstall } from "@/lib/pwa-install";

export function AppShell({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();
  const { t, lang, toggle } = useLanguage();
  const { theme, toggle: toggleTheme } = useTheme();
  const rtStatus = useRealtimeStatus();
  const { facebook: fbUrl } = useSocialLinks();
  const deferred = useDeferredPrompt();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [platformHelp, setPlatformHelp] = useState<null | "ios" | "android" | "desktop">(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) { setMenuOpen(false); setBellOpen(false); }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, []);

  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || t("header.you");

  const showBack = location.pathname !== "/app" && location.pathname !== "/";
  const goBack = () => {
    try {
      const idx = (router.history as unknown as { index?: number }).index ?? 0;
      if (idx > 0) {
        router.history.back();
        return;
      }
    } catch { /* noop */ }
    navigate({ to: "/app" });
  };

  const doSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true);

  const handleInstallClick = async () => {
    setInstallHelpOpen(true);
  };

  const appUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/`
      : "https://amarhishabs.lovable.app/";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = appUrl;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  };

  const shareLink = async () => {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "আমার হিসাব",
          text: t("আমার হিসাব অ্যাপ", "Amar Hishab app"),
          url: appUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  const doNativeInstall = async () => {
    const res = await promptInstall();
    if (res.outcome === "accepted") setInstallHelpOpen(false);
    return res.outcome;
  };

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  const isAndroid = /Android/i.test(ua);

  const handlePlatformInstall = async (p: "ios" | "android" | "desktop") => {
    if (p === "ios") { setPlatformHelp("ios"); return; }
    if (deferred) {
      const outcome = await doNativeInstall();
      if (outcome === "accepted") return;
    }
    setPlatformHelp(p);
  };

  const showInstallBtn = !isStandalone;

  return (
    <div className="h-[100dvh] lg:h-screen flex overflow-hidden min-h-0 min-w-0" style={{ background: "var(--gradient-page)" }}>
      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      <main className="flex-1 px-2 sm:px-3 lg:px-6 pb-2 sm:pb-3 lg:pb-6 overflow-y-auto overflow-x-hidden h-full w-full min-w-0 min-h-0">
        <div className="sticky top-0 z-30 flex flex-col gap-0 mb-3 lg:mb-4 -mx-2 sm:-mx-3 lg:-mx-6 px-2 sm:px-3 lg:px-6 pb-1 border-b lg:flex-row lg:items-center lg:justify-between lg:gap-2" style={{ backgroundColor: "color-mix(in oklab, var(--brand-ivory) 92%, transparent)", backdropFilter: "blur(8px)", borderColor: "var(--brand-line)" }} ref={ref}>
          {/* === TOP ROW (mobile) / single row (desktop) === */}
          <div className="flex items-center justify-between gap-1 lg:gap-3 min-w-0">
            {/* LEFT: logo+name on all sizes; then back/divider/title on desktop */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 lg:flex-none lg:w-auto">
              <Link to="/app" className="flex lg:hidden items-center gap-2 hover:opacity-80 transition shrink-0">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-brand)" }}>
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <span className="text-base font-bold tracking-wide" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>আমার হিসাব</span>
              </Link>
              {/* Desktop left side: back + divider + title */}
              <div className="hidden lg:flex items-center gap-2 md:gap-3 min-w-0">
                {showBack && (
                  <button
                    type="button"
                    onClick={goBack}
                    title={t("ফিরে যান", "Back")}
                    aria-label={t("ফিরে যান", "Back")}
                    className="relative z-[35] p-2 bg-white rounded-lg border hover:shadow-sm transition shrink-0 w-9 h-9 flex items-center justify-center"
                    style={{ borderColor: "var(--brand-line)" }}
                  >
                    <ArrowLeft className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                  </button>
                )}
                <span className="h-7 w-1 rounded-full" style={{ background: "var(--gradient-brand)" }} />
                <h1 className="text-lg md:text-2xl lg:text-3xl tracking-tight truncate flex-1 min-w-0" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{title}</h1>
              </div>
            </div>

            {/* RIGHT (top row): actions + realtime on mobile; full right on desktop */}
            <div className="flex items-center gap-1 md:gap-3 flex-wrap justify-end w-full lg:w-auto">
              {actions && (
                <div className="flex items-center gap-2 flex-wrap">
                  {actions}
                </div>
              )}
              <RealtimeStatusBadge status={rtStatus} />
              {/* Mobile top-right icons */}
              <div className="flex lg:hidden items-center gap-0.5">
              <Tooltip label={t("header.facebook")} side="bottom">
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("header.facebook")}
                  className="p-1 rounded-lg hover:bg-white/60 transition w-8 h-8 flex items-center justify-center"
                  style={{ color: "var(--brand-ink-soft)" }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
                </a>
              </Tooltip>
              {showInstallBtn && (
                <Tooltip label={t("অ্যাপ ডাউনলোড", "Install app")} side="bottom">
                  <button
                    onClick={handleInstallClick}
                    aria-label={t("অ্যাপ ডাউনলোড", "Install app")}
                    className="p-1 rounded-lg hover:bg-white/60 transition w-8 h-8 flex items-center justify-center"
                    style={{ color: "var(--brand-ink-soft)" }}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              <Tooltip label={t("nav.support")} side="bottom">
                <Link
                  to="/support"
                  aria-label={t("nav.support")}
                  className="p-1 rounded-lg hover:bg-white/60 transition w-8 h-8 flex items-center justify-center"
                >
                  <Headset className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                </Link>
              </Tooltip>
              <div className="relative">
                <Tooltip label={t("header.notifications")} side="bottom">
                  <button onClick={() => { setBellOpen(o => !o); setMenuOpen(false); }} className="relative p-1 rounded-lg hover:bg-white/60 transition w-8 h-8 flex items-center justify-center">
                    <Bell className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                  </button>
                </Tooltip>
                  {bellOpen && (
                    <div className="absolute right-0 top-11 w-[min(18rem,calc(100vw-5rem))] bg-white rounded-xl p-3 z-50 shadow-lg border" style={{ borderColor: "var(--brand-line)" }}>
                      <div className="text-sm font-semibold mb-2" style={{ color: "var(--brand-ink)" }}>{t("header.notifications")}</div>
                      <div className="text-xs py-6 text-center" style={{ color: "var(--brand-ink-soft)" }}>{t("header.noNotifications")}</div>
                    </div>
                  )}
                </div>
              </div>
              {/* Desktop right icons */}
              <div className="hidden lg:flex items-center gap-2 md:gap-3">
                <button
                  onClick={toggleTheme}
                  title={theme === "dark" ? t("লাইট মোড", "Light mode") : t("ডার্ক মোড", "Dark mode")}
                  aria-label={theme === "dark" ? t("লাইট মোড", "Light mode") : t("ডার্ক মোড", "Dark mode")}
                  className="p-2 bg-white rounded-lg border hover:shadow-sm transition w-9 h-9 flex items-center justify-center"
                  style={{ borderColor: "var(--brand-line)" }}
                >
                  {theme === "dark"
                    ? <Sun className="w-4 h-4" style={{ color: "var(--brand-gold-500)" }} />
                    : <Moon className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />}
                </button>
                <button
                  onClick={toggle}
                  title={t("lang.label")}
                  aria-label={t("lang.label")}
                  className="px-2.5 h-9 bg-white rounded-lg border hover:shadow-sm transition text-xs font-bold tracking-wide"
                  style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink)" }}
                >
                  {lang === "bn" ? "EN" : "বাং"}
                </button>
                {showInstallBtn && (
                  <Tooltip label={t("অ্যাপ ডাউনলোড", "Install app")} side="bottom">
                    <button
                      onClick={handleInstallClick}
                      aria-label={t("অ্যাপ ডাউনলোড", "Install app")}
                      className="p-2 bg-white rounded-lg border hover:shadow-sm transition w-9 h-9 flex items-center justify-center"
                      style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink-soft)" }}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </Tooltip>
                )}
                <Tooltip label={t("header.facebook")} side="bottom">
                  <a
                    href={fbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("header.facebook")}
                    className="p-2 bg-white rounded-lg border hover:shadow-sm transition w-9 h-9 flex items-center justify-center"
                    style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink-soft)" }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
                  </a>
                </Tooltip>
                <Tooltip label={t("nav.support")} side="bottom">
                  <Link
                    to="/support"
                    aria-label={t("nav.support")}
                    className="p-2 bg-white rounded-lg border hover:shadow-sm transition"
                    style={{ borderColor: "var(--brand-line)" }}
                  >
                    <Headset className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                  </Link>
                </Tooltip>
                <div className="relative">
                  <Tooltip label={t("header.notifications")} side="bottom">
                    <button onClick={() => { setBellOpen(o => !o); setMenuOpen(false); }} className="relative p-2 bg-white rounded-lg border hover:shadow-sm transition" style={{ borderColor: "var(--brand-line)" }}>
                      <Bell className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                    </button>
                  </Tooltip>
                  {bellOpen && (
                    <div className="absolute right-0 top-12 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl p-3 z-50 shadow-lg border" style={{ position: "absolute", borderColor: "var(--brand-line)" }}>
                      <div className="text-sm font-semibold mb-2" style={{ color: "var(--brand-ink)" }}>{t("header.notifications")}</div>
                      <div className="text-xs py-6 text-center" style={{ color: "var(--brand-ink-soft)" }}>{t("header.noNotifications")}</div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button onClick={() => { setMenuOpen(o => !o); setBellOpen(false); }} className="flex items-center gap-2 px-2 py-1 bg-white rounded-lg border hover:shadow-sm transition" style={{ borderColor: "var(--brand-line)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "var(--gradient-brand)" }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm hidden sm:inline max-w-[120px] truncate">{name}</span>
                    <ChevronDown className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-12 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-xl p-1 z-50 shadow-lg border" style={{ position: "absolute", borderColor: "var(--brand-line)" }}>
                      <div className="px-3 py-2 border-b" style={{ borderColor: "var(--brand-line)" }}>
                        <div className="text-sm font-semibold truncate" style={{ color: "var(--brand-ink)" }}>{name}</div>
                        <div className="text-xs truncate" style={{ color: "var(--brand-ink-soft)" }}>{user?.email}</div>
                      </div>
                      <RefCodeBadge variant="menu" />
                      <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[var(--brand-ivory)]" style={{ color: "var(--brand-ink)" }}>
                        <UserIcon className="w-4 h-4" /> {t("header.profile")}
                      </Link>
                      <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[var(--brand-ivory)]" style={{ color: "var(--brand-ink)" }}>
                        <SettingsIcon className="w-4 h-4" /> {t("header.settings")}
                      </Link>
                      <button onClick={doSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[var(--brand-ivory)]" style={{ color: "var(--expense)" }}>
                        <LogOut className="w-4 h-4" /> {t("header.signOut")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* === BOTTOM ROW: mobile/tablet — left: hamburger + back + title; right: theme/lang/profile === */}
          <div className="flex lg:hidden items-center justify-between gap-2 pt-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                className="relative z-[35] p-1.5 rounded-lg hover:bg-white/60 transition shrink-0 flex flex-col gap-[3px] items-center justify-center w-9 h-9"
                aria-label="মেনু খুলুন"
              >
                <span className="block w-4 h-[2px] rounded" style={{ background: "var(--brand-ink)" }} />
                <span className="block w-4 h-[2px] rounded" style={{ background: "var(--brand-ink)" }} />
                <span className="block w-4 h-[2px] rounded" style={{ background: "var(--brand-ink)" }} />
              </button>
              {showBack && (
                <button
                  type="button"
                  onClick={goBack}
                  title={t("ফিরে যান", "Back")}
                  aria-label={t("ফিরে যান", "Back")}
                  className="relative z-[35] p-1.5 rounded-lg hover:bg-white/60 transition shrink-0 w-9 h-9 flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5" style={{ color: "var(--brand-ink-soft)" }} />
                </button>
              )}
              <h1 className="text-lg tracking-tight truncate min-w-0" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{title}</h1>
            </div>
            <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? t("লাইট মোড", "Light mode") : t("ডার্ক মোড", "Dark mode")}
              aria-label={theme === "dark" ? t("লাইট মোড", "Light mode") : t("ডার্ক মোড", "Dark mode")}
              className="p-1.5 rounded-lg hover:bg-white/60 transition w-9 h-9 flex items-center justify-center"
            >
              {theme === "dark"
                ? <Sun className="w-5 h-5" style={{ color: "var(--brand-gold-500)" }} />
                : <Moon className="w-5 h-5" style={{ color: "var(--brand-ink-soft)" }} />}
            </button>
            <button
              onClick={toggle}
              title={t("lang.label")}
              aria-label={t("lang.label")}
              className="px-2 h-9 rounded-lg hover:bg-white/60 transition text-xs font-bold tracking-wide"
              style={{ color: "var(--brand-ink)" }}
            >
              {lang === "bn" ? "EN" : "বাং"}
            </button>
            <button onClick={() => { setMenuOpen(o => !o); setBellOpen(false); }} className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-white/60 transition shrink-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "var(--gradient-brand)" }}>
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm hidden sm:inline max-w-[100px] truncate">{name}</span>
              <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--brand-ink-soft)" }} />
            </button>
            </div>
          </div>
        </div>
        {menuOpen && (
          <>
            <div className="lg:hidden fixed inset-0 z-[55]" onMouseDown={() => setMenuOpen(false)} onTouchStart={() => setMenuOpen(false)} aria-hidden="true" />
            <div
              className="lg:hidden fixed right-3 top-[calc(env(safe-area-inset-top)+5.5rem)] w-56 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl p-1 z-[60] shadow-2xl border"
              style={{ position: "fixed", borderColor: "var(--brand-line)" }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: "var(--brand-line)" }}>
                <div className="text-sm font-semibold truncate" style={{ color: "var(--brand-ink)" }}>{name}</div>
                <div className="text-xs truncate" style={{ color: "var(--brand-ink-soft)" }}>{user?.email}</div>
              </div>
              <RefCodeBadge variant="menu" />
              <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[var(--brand-ivory)]" style={{ color: "var(--brand-ink)" }}>
                <UserIcon className="w-4 h-4" /> {t("header.profile")}
              </Link>
              <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[var(--brand-ivory)]" style={{ color: "var(--brand-ink)" }}>
                <SettingsIcon className="w-4 h-4" /> {t("header.settings")}
              </Link>
              <button onClick={doSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[var(--brand-ivory)]" style={{ color: "var(--expense)" }}>
                <LogOut className="w-4 h-4" /> {t("header.signOut")}
              </button>
            </div>
          </>
        )}
        <div className="pt-2 sm:pt-3 lg:pt-6">
          {children}
        </div>
      </main>
      {installHelpOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => { setInstallHelpOpen(false); setPlatformHelp(null); }}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ background: "var(--gradient-brand)" }}>
                <Download className="w-5 h-5" />
              </div>
              <div className="text-base font-semibold" style={{ color: "var(--brand-ink)" }}>
                {t("অ্যাপ ইনস্টল করুন", "Install the app")}
              </div>
            </div>

            <p className="text-xs mb-3" style={{ color: "var(--brand-ink-soft)" }}>
              {t("আপনার ডিভাইস নির্বাচন করুন — সম্ভব হলে এক ক্লিকেই ইনস্টল হবে।", "Pick your device — it will install in one click when supported.")}
            </p>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={() => handlePlatformInstall("ios")}
                className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-xs font-semibold hover:shadow-sm transition"
                style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink)", background: isIOS ? "var(--brand-ivory)" : "white" }}
              >
                <Apple className="w-5 h-5" />
                iOS
              </button>
              <button
                onClick={() => handlePlatformInstall("android")}
                className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-xs font-semibold hover:shadow-sm transition relative"
                style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink)", background: isAndroid ? "var(--brand-ivory)" : "white" }}
              >
                <Smartphone className="w-5 h-5" />
                Android
                {deferred && isAndroid && <span className="absolute -top-1 -right-1 text-[9px] px-1.5 py-0.5 rounded-full text-white font-bold" style={{ background: "var(--gradient-brand)" }}>1‑click</span>}
              </button>
              <button
                onClick={() => handlePlatformInstall("desktop")}
                className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-xs font-semibold hover:shadow-sm transition relative"
                style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink)", background: !isIOS && !isAndroid ? "var(--brand-ivory)" : "white" }}
              >
                <Monitor className="w-5 h-5" />
                {t("ডেস্কটপ", "Desktop")}
                {deferred && !isIOS && !isAndroid && <span className="absolute -top-1 -right-1 text-[9px] px-1.5 py-0.5 rounded-full text-white font-bold" style={{ background: "var(--gradient-brand)" }}>1‑click</span>}
              </button>
            </div>

            {deferred && (
              <button
                onClick={doNativeInstall}
                className="w-full mb-3 px-4 py-2.5 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: "var(--gradient-brand)" }}
              >
                <Download className="w-4 h-4" />
                {t("এক ক্লিকে এখনই ইনস্টল করুন", "Install now in one click")}
              </button>
            )}

            <div className="flex gap-2 mb-3">
              <div
                className="flex-1 px-3 py-2 rounded-lg border text-xs truncate font-mono"
                style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink-soft)", background: "var(--brand-ivory)" }}
              >
                {appUrl}
              </div>
              <button
                onClick={copyLink}
                title={t("লিংক কপি", "Copy link")}
                className="px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-1.5"
                style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink)" }}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? t("কপি হয়েছে", "Copied") : t("কপি", "Copy")}
              </button>
              <button
                onClick={shareLink}
                title={t("শেয়ার", "Share")}
                className="px-3 py-2 rounded-lg border text-sm font-semibold flex items-center"
                style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink)" }}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {platformHelp && (
              <div className="text-sm space-y-1.5 border-t pt-3" style={{ color: "var(--brand-ink-soft)", borderColor: "var(--brand-line)" }}>
                {platformHelp === "ios" && (
                  <>
                    <p className="font-semibold" style={{ color: "var(--brand-ink)" }}>{t("iPhone / iPad (Safari)", "iPhone / iPad (Safari)")}</p>
                    <p>{t("১) Safari-তে এই লিংক খুলুন। ২) নিচের Share বাটন (⬆) চাপুন। ৩) \"Add to Home Screen\" নির্বাচন করুন।", "1) Open this link in Safari. 2) Tap the Share button (⬆). 3) Choose \"Add to Home Screen\".")}</p>
                  </>
                )}
                {platformHelp === "android" && (
                  <>
                    <p className="font-semibold" style={{ color: "var(--brand-ink)" }}>{t("Android (Chrome)", "Android (Chrome)")}</p>
                    <p>{t("ব্রাউজার মেনু (⋮) → \"Install app\" / \"হোম স্ক্রিনে যোগ করুন\" নির্বাচন করুন।", "Open browser menu (⋮) → tap \"Install app\" / \"Add to Home screen\".")}</p>
                  </>
                )}
                {platformHelp === "desktop" && (
                  <>
                    <p className="font-semibold" style={{ color: "var(--brand-ink)" }}>{t("ডেস্কটপ (Chrome / Edge)", "Desktop (Chrome / Edge)")}</p>
                    <p>{t("অ্যাড্রেস বারের ডানে ইনস্টল আইকন (⤓) চাপুন, অথবা মেনু → \"Install আমার হিসাব\"।", "Click the install icon (⤓) on the right of the address bar, or menu → \"Install Amar Hishab\".")}</p>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => { setInstallHelpOpen(false); setPlatformHelp(null); }}
              className="mt-4 w-full px-4 py-2 rounded-lg border text-sm font-semibold"
              style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink)" }}
            >
              {t("ঠিক আছে", "OK")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}