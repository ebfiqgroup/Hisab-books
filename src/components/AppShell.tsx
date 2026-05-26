import { ReactNode, useState, useRef, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Bell, ChevronDown, LogOut, User as UserIcon, Settings as SettingsIcon, LifeBuoy, ArrowLeft, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useRouter, useLocation } from "@tanstack/react-router";
import { RefCodeBadge } from "./RefCodeBadge";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { RealtimeStatusBadge } from "./RealtimeStatusBadge";

export function AppShell({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();
  const { t, lang, toggle } = useLanguage();
  const { theme, toggle: toggleTheme } = useTheme();
  const rtStatus = useRealtimeStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) { setMenuOpen(false); setBellOpen(false); }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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

  return (
    <div className="h-[100dvh] lg:h-screen flex overflow-hidden min-h-0 min-w-0" style={{ background: "var(--gradient-page)" }}>
      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      <main className="flex-1 px-2 sm:px-3 lg:px-6 pb-2 sm:pb-3 lg:pb-6 overflow-y-auto overflow-x-hidden h-full w-full min-w-0 min-h-0">
        <div className="sticky top-0 z-30 flex flex-col gap-2 mb-4 lg:mb-6 -mx-2 sm:-mx-3 lg:-mx-6 px-2 sm:px-3 lg:px-6 pb-2 border-b lg:flex-row lg:items-center lg:justify-between lg:gap-3" style={{ backgroundColor: "color-mix(in oklab, var(--brand-ivory) 92%, transparent)", backdropFilter: "blur(8px)", borderColor: "var(--brand-line)" }} ref={ref}>
          {/* === TOP ROW (mobile) / single row (desktop) === */}
          <div className="flex items-center justify-between gap-2 lg:gap-3 min-w-0">
            {/* LEFT: hamburger only on mobile/tablet; full left on desktop */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 lg:flex-none lg:w-auto">
              <button
                onClick={() => setNavOpen(true)}
                className="lg:hidden p-2 bg-white rounded-lg border hover:shadow-sm transition shrink-0 flex flex-col gap-[3px] items-center justify-center w-9 h-9"
                style={{ borderColor: "var(--brand-line)" }}
                aria-label="মেনু খুলুন"
              >
                <span className="block w-4 h-[2px] rounded" style={{ background: "var(--brand-ink)" }} />
                <span className="block w-4 h-[2px] rounded" style={{ background: "var(--brand-ink)" }} />
                <span className="block w-4 h-[2px] rounded" style={{ background: "var(--brand-ink)" }} />
              </button>
              {/* Desktop left side: back + divider + title */}
              <div className="hidden lg:flex items-center gap-2 md:gap-3 min-w-0">
                {showBack && (
                  <button
                    onClick={goBack}
                    title={t("ফিরে যান", "Back")}
                    aria-label={t("ফিরে যান", "Back")}
                    className="p-2 bg-white rounded-lg border hover:shadow-sm transition shrink-0 w-9 h-9 flex items-center justify-center"
                    style={{ borderColor: "var(--brand-line)" }}
                  >
                    <ArrowLeft className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                  </button>
                )}
                <span className="h-7 w-1 rounded-full" style={{ background: "var(--gradient-brand)" }} />
                <h1 className="text-lg md:text-2xl lg:text-3xl tracking-tight truncate flex-1 min-w-0" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{title}</h1>
              </div>
              {/* Mobile/tablet: back + title */}
              <div className="flex lg:hidden items-center gap-2 min-w-0">
                {showBack && (
                  <button
                    onClick={goBack}
                    title={t("ফিরে যান", "Back")}
                    aria-label={t("ফিরে যান", "Back")}
                    className="p-2 bg-white rounded-lg border hover:shadow-sm transition shrink-0 w-9 h-9 flex items-center justify-center"
                    style={{ borderColor: "var(--brand-line)" }}
                  >
                    <ArrowLeft className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                  </button>
                )}
                <h1 className="text-lg tracking-tight truncate min-w-0" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{title}</h1>
              </div>
            </div>

            {/* RIGHT (top row): actions + realtime on mobile; full right on desktop */}
            <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
              {actions && (
                <div className="flex items-center gap-2 flex-wrap">
                  {actions}
                </div>
              )}
              <RealtimeStatusBadge status={rtStatus} />
              {/* Mobile top-right icons */}
              <div className="flex lg:hidden items-center gap-2">
                <a
                  href="https://www.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Facebook"
                  aria-label="Facebook"
                  className="p-2 bg-white rounded-lg border hover:shadow-sm transition w-9 h-9 flex items-center justify-center"
                  style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink-soft)" }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
                </a>
                <Link
                  to="/support"
                  title={t("nav.support")}
                  aria-label={t("nav.support")}
                  className="p-2 bg-white rounded-lg border hover:shadow-sm transition w-9 h-9 flex items-center justify-center"
                  style={{ borderColor: "var(--brand-line)" }}
                >
                  <LifeBuoy className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                </Link>
                <div className="relative">
                  <button onClick={() => { setBellOpen(o => !o); setMenuOpen(false); }} className="relative p-2 bg-white rounded-lg border hover:shadow-sm transition w-9 h-9 flex items-center justify-center" style={{ borderColor: "var(--brand-line)" }}>
                    <Bell className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                  </button>
                  {bellOpen && (
                    <div className="absolute right-0 top-12 w-72 bg-white rounded-xl p-3 z-50 brand-card">
                      <div className="text-sm font-semibold mb-2" style={{ color: "var(--brand-ink)" }}>{t("header.notifications")}</div>
                      <div className="text-xs text-slate-500 py-6 text-center">{t("header.noNotifications")}</div>
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
                <a
                  href="https://www.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Facebook"
                  aria-label="Facebook"
                  className="p-2 bg-white rounded-lg border hover:shadow-sm transition w-9 h-9 flex items-center justify-center"
                  style={{ borderColor: "var(--brand-line)", color: "var(--brand-ink-soft)" }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
                </a>
                <Link
                  to="/support"
                  title={t("nav.support")}
                  aria-label={t("nav.support")}
                  className="p-2 bg-white rounded-lg border hover:shadow-sm transition"
                  style={{ borderColor: "var(--brand-line)" }}
                >
                  <LifeBuoy className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                </Link>
                <div className="relative">
                  <button onClick={() => { setBellOpen(o => !o); setMenuOpen(false); }} className="relative p-2 bg-white rounded-lg border hover:shadow-sm transition" style={{ borderColor: "var(--brand-line)" }}>
                    <Bell className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                  </button>
                  {bellOpen && (
                    <div className="absolute right-0 top-12 w-72 bg-white rounded-xl p-3 z-50 brand-card">
                      <div className="text-sm font-semibold mb-2" style={{ color: "var(--brand-ink)" }}>{t("header.notifications")}</div>
                      <div className="text-xs text-slate-500 py-6 text-center">{t("header.noNotifications")}</div>
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
                    <div className="absolute right-0 top-12 w-56 bg-white rounded-xl p-1 z-50 brand-card">
                      <div className="px-3 py-2 border-b" style={{ borderColor: "var(--brand-line)" }}>
                        <div className="text-sm font-semibold truncate" style={{ color: "var(--brand-ink)" }}>{name}</div>
                        <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                      </div>
                      <RefCodeBadge variant="menu" />
                      <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md">
                        <UserIcon className="w-4 h-4" /> {t("header.profile")}
                      </Link>
                      <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md">
                        <SettingsIcon className="w-4 h-4" /> {t("header.settings")}
                      </Link>
                      <button onClick={doSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-md">
                        <LogOut className="w-4 h-4" /> {t("header.signOut")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* === BOTTOM ROW: mobile/tablet icons only === */}
          <div className="flex lg:hidden items-center justify-end gap-2 border-t pt-2" style={{ borderColor: "var(--brand-line)" }}>
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
            <div className="relative">
              <button onClick={() => { setMenuOpen(o => !o); setBellOpen(false); }} className="flex items-center gap-2 px-2 py-1 bg-white rounded-lg border hover:shadow-sm transition" style={{ borderColor: "var(--brand-line)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "var(--gradient-brand)" }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm hidden sm:inline max-w-[120px] truncate">{name}</span>
                <ChevronDown className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 w-56 bg-white rounded-xl p-1 z-50 brand-card">
                  <div className="px-3 py-2 border-b" style={{ borderColor: "var(--brand-line)" }}>
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--brand-ink)" }}>{name}</div>
                    <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                  </div>
                  <RefCodeBadge variant="menu" />
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md">
                    <UserIcon className="w-4 h-4" /> {t("header.profile")}
                  </Link>
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md">
                    <SettingsIcon className="w-4 h-4" /> {t("header.settings")}
                  </Link>
                  <button onClick={doSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-md">
                    <LogOut className="w-4 h-4" /> {t("header.signOut")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="pt-2 sm:pt-3 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}