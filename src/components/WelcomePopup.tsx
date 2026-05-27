import { useEffect, useState } from "react";
import { Sparkles, X, PartyPopper } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useSearch, useNavigate } from "@tanstack/react-router";

const WELCOME_SHOWN_KEY = "welcome_shown_for_session";

export function WelcomePopup() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const search = useSearch({ from: "/_authenticated" });
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    // Clear the flag when the user signs out so the next login shows the popup again
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(WELCOME_SHOWN_KEY);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const lastShownFor = sessionStorage.getItem(WELCOME_SHOWN_KEY);
    const fromLogin = search?.welcome === "1";
    // Show if explicitly coming from login flow OR if not shown in this session yet
    if (fromLogin || lastShownFor !== userId) {
      const timer = setTimeout(() => {
        setVisible(true);
        sessionStorage.setItem(WELCOME_SHOWN_KEY, userId);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [user, search?.welcome]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleClose = () => {
    setDismissing(true);
    setTimeout(() => setVisible(false), 350);
    // Remove the ?welcome=1 param from the URL so refresh does not re-trigger
    if (search?.welcome === "1") {
      navigate({ to: ".", search: (prev) => ({ ...prev, welcome: undefined }) });
    }
  };

  if (!visible && !dismissing) return null;

  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "";
  const greeting = new Date().getHours() < 12
    ? t("শুভ সকাল", "Good morning")
    : new Date().getHours() < 17
      ? t("শুভ অপরাহ্ণ", "Good afternoon")
      : t("শুভ সন্ধ্যা", "Good evening");

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center p-4 transition-opacity duration-300 ${dismissing ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-350 ${dismissing ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
        style={{
          animation: dismissing ? undefined : "welcome-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient top banner */}
        <div
          className="h-24 relative overflow-hidden"
          style={{ background: "var(--gradient-brand)" }}
        >
          {/* Floating decorative circles */}
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20" style={{ background: "var(--brand-gold-500)" }} />
          <div className="absolute top-4 left-4 w-10 h-10 rounded-full opacity-15" style={{ background: "var(--brand-gold-300)" }} />
          <div className="absolute bottom-2 right-12 w-6 h-6 rounded-full opacity-20" style={{ background: "var(--brand-gold-500)" }} />

          {/* Center icon */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center border-4"
              style={{
                background: "var(--brand-ivory)",
                borderColor: "var(--brand-gold-500)",
              }}
            >
              <img src="/logo-moneybag.png" alt="" className="h-9 w-9 object-contain animate-float" />
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/20 transition"
          aria-label="বন্ধ করুন"
        >
          <X className="w-4 h-4 text-white/90" />
        </button>

        {/* Content */}
        <div className="pt-10 pb-6 px-6 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Sparkles className="w-4 h-4" style={{ color: "var(--brand-gold-600)" }} />
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--brand-gold-600)" }}>
              {greeting}
            </span>
            <Sparkles className="w-4 h-4" style={{ color: "var(--brand-gold-600)" }} />
          </div>

          <h2
            className="text-xl font-bold mb-1"
            style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}
          >
            {name ? (
              <>
                {t("স্বাগতম", "Welcome")}, <span style={{ color: "var(--brand-emerald-700)" }}>{name}</span>!
              </>
            ) : (
              t("আমার হিসাবে স্বাগতম!", "Welcome to Amar Hishab!")
            )}
          </h2>

          <p className="text-sm mb-5" style={{ color: "var(--brand-ink-soft)" }}>
            {t(
              "আপনার আর্থিক যাত্রা আজকের দিনটি থেকে শুরু হোক। সুস্থ ও সমৃদ্ধিশালী দিন কামনা করছি।",
              "May your financial journey flourish starting today. Wishing you a healthy and prosperous day."
            )}
          </p>

          {/* Fun stat / action hint */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium"
            style={{
              background: "color-mix(in oklab, var(--brand-emerald-700) 8%, transparent)",
              color: "var(--brand-emerald-700)",
              border: "1px solid color-mix(in oklab, var(--brand-emerald-700) 20%, transparent)",
            }}
          >
            <PartyPopper className="w-3.5 h-3.5" />
            {t("আজকের হিসাব দেখতে ড্যাশবোর্ড ভিজিট করুন", "Visit the dashboard to see today's summary")}
          </div>
        </div>

        {/* Bottom decorative line */}
        <div className="h-1 w-full" style={{ background: "var(--gradient-brand)" }} />
      </div>

      <style>{`
        @keyframes welcome-pop {
          0% {
            opacity: 0;
            transform: scale(0.85) translateY(20px);
          }
          60% {
            opacity: 1;
            transform: scale(1.02) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
