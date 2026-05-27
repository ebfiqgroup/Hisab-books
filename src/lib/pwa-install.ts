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
    deferredEvt.prompt();
    return deferredEvt.userChoice;
  }
  return Promise.resolve<{ outcome: "accepted" | "dismissed" }>({ outcome: "dismissed" });
}

export function useDeferredPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(deferredEvt);
  useEffect(() => {
    listeners.add(setEvt);
    return () => { listeners.delete(setEvt); };
  }, []);
  return evt;
}
