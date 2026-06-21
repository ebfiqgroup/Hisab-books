import { useEffect, useState } from "react";
import { Sparkles, X, PartyPopper } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, type Variants } from "framer-motion";

const WELCOME_SHOWN_KEY = "welcome_shown_for_session";

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.3, ease: "easeIn" } },
};

const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      ease: [0.34, 1.56, 0.64, 1] as const,
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: { duration: 0.3, ease: "easeIn" },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

export function WelcomePopup() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const search = useSearch({ from: "/_authenticated" });
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
    if (fromLogin || lastShownFor !== userId) {
      const timer = setTimeout(() => {
        setVisible(true);
        sessionStorage.setItem(WELCOME_SHOWN_KEY, userId);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [user, search?.welcome]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleClose = () => {
    setVisible(false);
    if (search?.welcome === "1") {
      navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, welcome: undefined }) });
    }
  };

  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "";
  const greeting = new Date().getHours() < 12
    ? t("শুভ সকাল", "Good morning")
    : new Date().getHours() < 17
      ? t("শুভ অপরাহ্ণ", "Good afternoon")
      : t("শুভ সন্ধ্যা", "Good evening");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleClose}
        >
          <motion.div
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={{
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)",
            }}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient top banner */}
            <motion.div
              className="h-24 relative overflow-hidden"
              style={{ background: "var(--gradient-brand)" }}
              variants={itemVariants}
            >
              {/* Floating decorative circles */}
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20" style={{ background: "var(--brand-gold-500)" }} />
              <div className="absolute top-4 left-4 w-10 h-10 rounded-full opacity-15" style={{ background: "var(--brand-gold-300)" }} />
              <div className="absolute bottom-2 right-12 w-6 h-6 rounded-full opacity-20" style={{ background: "var(--brand-gold-500)" }} />

              {/* Center icon */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                <motion.div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center border-4"
                  style={{
                    background: "var(--brand-ivory)",
                    borderColor: "var(--brand-gold-500)",
                  }}
                  initial={{ scale: 0.6, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] as const }}
                >
                  <img src="/logo-moneybag.png" alt="" className="h-9 w-9 object-contain animate-float" />
                </motion.div>
              </div>
            </motion.div>

            {/* Close button */}
            <motion.button
              onClick={handleClose}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/20 transition"
              aria-label="বন্ধ করুন"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
              whileHover={{ scale: 1.15, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4 text-white/90" />
            </motion.button>

            {/* Content */}
            <div className="pt-10 pb-6 px-6 text-center">
              <motion.div className="flex items-center justify-center gap-1.5 mb-1" variants={itemVariants}>
                <Sparkles className="w-4 h-4" style={{ color: "var(--brand-gold-600)" }} />
                <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--brand-gold-600)" }}>
                  {greeting}
                </span>
                <Sparkles className="w-4 h-4" style={{ color: "var(--brand-gold-600)" }} />
              </motion.div>

              <motion.h2
                className="text-xl font-bold mb-1"
                style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}
                variants={itemVariants}
              >
                {name ? (
                  <>
                    {t("স্বাগতম", "Welcome")}, <span style={{ color: "var(--brand-emerald-700)" }}>{name}</span>!
                  </>
                ) : (
                  t("হিসাব বইে স্বাগতম!", "Welcome to Hisab Boi!")
                )}
              </motion.h2>

              <motion.p
                className="text-sm mb-5"
                style={{ color: "var(--brand-ink-soft)" }}
                variants={itemVariants}
              >
                {name
                  ? t(
                      `${name}, আপনার আর্থিক যাত্রা আজ থেকে আরও সুন্দর হোক। আমরা আপনার পাশে আছি প্রতিটি পদক্ষেপে।`,
                      `${name}, may your financial journey flourish from today onward. We're with you at every step.`
                    )
                  : t(
                      "আপনার আর্থিক যাত্রা আজকের দিনটি থেকে শুরু হোক। সুস্থ ও সমৃদ্ধিশালী দিন কামনা করছি।",
                      "May your financial journey flourish starting today. Wishing you a healthy and prosperous day."
                    )}
              </motion.p>

              {/* Personalized action hint */}
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium"
                style={{
                  background: "color-mix(in oklab, var(--brand-emerald-700) 8%, transparent)",
                  color: "var(--brand-emerald-700)",
                  border: "1px solid color-mix(in oklab, var(--brand-emerald-700) 20%, transparent)",
                }}
                variants={itemVariants}
              >
                <PartyPopper className="w-3.5 h-3.5" />
                {name
                  ? t(
                      `${name}, আজকের হিসাব দেখতে ড্যাশবোর্ড ভিজিট করুন`,
                      `${name}, visit the dashboard to see today's summary`
                    )
                  : t(
                      "আজকের হিসাব দেখতে ড্যাশবোর্ড ভিজিট করুন",
                      "Visit the dashboard to see today's summary"
                    )}
              </motion.div>
            </div>

            {/* Bottom decorative line */}
            <motion.div
              className="h-1 w-full"
              style={{ background: "var(--gradient-brand)" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
