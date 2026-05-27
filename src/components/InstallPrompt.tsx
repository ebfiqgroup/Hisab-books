import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "amar-hishab-install-dismissed";

export function InstallPrompt() {
  const { t } = useLanguage();
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) { setHidden(true); return; }
    // Already installed?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true;
    if (standalone) { setHidden(true); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden || !evt) return null;

  const install = async () => {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "dismissed") localStorage.setItem(DISMISS_KEY, "1");
    setEvt(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center">
        <Download className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800">
          {t("অ্যাপ ইনস্টল করুন", "Install the app")}
        </div>
        <div className="text-xs text-slate-500">
          {t("অফলাইনেও কাজ করবে", "Works offline too")}
        </div>
      </div>
      <button onClick={install} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold">
        {t("ইনস্টল", "Install")}
      </button>
      <button onClick={dismiss} className="p-1 text-slate-400 hover:text-slate-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}