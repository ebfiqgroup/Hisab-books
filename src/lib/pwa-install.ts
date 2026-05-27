import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredEvt: BIPEvent | null = null;
const listeners = new Set<(evt: BIPEvent | null) => void>();

function notify() {
  listeners.forEach((cb) => cb(deferredEvt));
}

export function setDeferredPrompt(e: BIPEvent | null) {
  deferredEvt = e;
  notify();
}

export function getDeferredPrompt() {
  return deferredEvt;
}

export function promptInstall() {
  if (deferredEvt) {
    const evt = deferredEvt;
    evt.prompt();
    const choice = evt.userChoice;
    choice.then((r) => {
      if (r.outcome === "accepted") setDeferredPrompt(null);
    }).catch(() => {});
    return choice;
  }
  return Promise.resolve<{ outcome: "accepted" | "dismissed" }>({ outcome: "dismissed" });
}

export function useDeferredPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(deferredEvt);
  useEffect(() => {
    listeners.add(setEvt);
    setEvt(deferredEvt);
    return () => { listeners.delete(setEvt); };
  }, []);
  return evt;
}

// Register the listener at module load (NOT inside React useEffect) — Chrome
// fires `beforeinstallprompt` very early and listeners attached later miss it.
if (typeof window !== "undefined") {
  const onBIP = (e: Event) => {
    e.preventDefault();
    setDeferredPrompt(e as BIPEvent);
  };
  const onInstalled = () => {
    setDeferredPrompt(null);
  };
  // Guard against double-registration during HMR
  const w = window as unknown as { __ahPWAInit?: boolean };
  if (!w.__ahPWAInit) {
    w.__ahPWAInit = true;
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
  }
}
