import type { Router } from "@tanstack/react-router";

export type PerfMetric = {
  from: string;
  to: string;
  tti: number; // ms from nav start → interactive (network idle + idle callback)
  requests: number; // network requests during the transition
  transferSize: number; // bytes transferred during the transition
  longTasks: number; // count of long tasks (>50ms) during the transition
  at: number; // timestamp
};

declare global {
  interface Window {
    __perfMetrics?: PerfMetric[];
    __perfTrackerAttached?: boolean;
  }
}

const IDLE_MS = 500; // network-quiet window
const MAX_WAIT_MS = 8000; // hard cap

function nowSafe() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Attaches navigation perf tracking to a TanStack router. Idempotent.
 * Each metric is appended to `window.__perfMetrics`, logged to the console,
 * and dispatched as a `perf:navigation` CustomEvent.
 */
export function attachPerfTracker(router: Router<any, any>) {
  if (typeof window === "undefined") return;
  if (window.__perfTrackerAttached) return;
  window.__perfTrackerAttached = true;
  window.__perfMetrics = window.__perfMetrics ?? [];

  let startTime = nowSafe();
  let startResourceCount = 0;
  let startTransfer = 0;
  let fromPath = router.state.location.pathname;
  let toPath = fromPath;
  let longTasks = 0;
  let lastResourceTs = startTime;
  let pending = false;

  // Long-task observer (best-effort; not all browsers support it)
  try {
    const lto = new PerformanceObserver((list) => {
      if (!pending) return;
      longTasks += list.getEntries().length;
    });
    lto.observe({ type: "longtask", buffered: false });
  } catch { /* noop */ }

  // Resource observer — tracks request count + transfer size while pending
  let liveRequests = 0;
  let liveTransfer = 0;
  try {
    const rto = new PerformanceObserver((list) => {
      if (!pending) return;
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        liveRequests += 1;
        liveTransfer += e.transferSize || 0;
        lastResourceTs = nowSafe();
      }
    });
    rto.observe({ type: "resource", buffered: false });
  } catch { /* noop */ }

  const snapshotResources = () => {
    try {
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const transfer = entries.reduce((s, e) => s + (e.transferSize || 0), 0);
      return { count: entries.length, transfer };
    } catch {
      return { count: 0, transfer: 0 };
    }
  };

  const finish = () => {
    if (!pending) return;
    pending = false;
    const end = nowSafe();
    const snap = snapshotResources();
    const requests = liveRequests || Math.max(0, snap.count - startResourceCount);
    const transferSize = liveTransfer || Math.max(0, snap.transfer - startTransfer);
    const metric: PerfMetric = {
      from: fromPath,
      to: toPath,
      tti: Math.round(end - startTime),
      requests,
      transferSize,
      longTasks,
      at: Date.now(),
    };
    window.__perfMetrics!.push(metric);
    if (window.__perfMetrics!.length > 50) window.__perfMetrics!.shift();
    // Pretty log
    // eslint-disable-next-line no-console
    console.info(
      `[perf] ${metric.from} → ${metric.to}  TTI ${metric.tti}ms · ${metric.requests} req · ${(metric.transferSize / 1024).toFixed(1)}KB · ${metric.longTasks} long-task(s)`,
    );
    window.dispatchEvent(new CustomEvent<PerfMetric>("perf:navigation", { detail: metric }));
  };

  const waitForIdle = () => {
    const deadline = startTime + MAX_WAIT_MS;
    const tick = () => {
      if (!pending) return;
      const t = nowSafe();
      if (t >= deadline) { finish(); return; }
      if (t - lastResourceTs >= IDLE_MS) {
        const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
        if (ric) ric(() => finish(), { timeout: 200 });
        else setTimeout(finish, 0);
        return;
      }
      setTimeout(tick, 100);
    };
    setTimeout(tick, IDLE_MS);
  };

  router.subscribe("onBeforeNavigate", (e) => {
    fromPath = e.fromLocation?.pathname ?? router.state.location.pathname;
    toPath = e.toLocation.pathname;
    if (fromPath === toPath) return;
    startTime = nowSafe();
    const snap = snapshotResources();
    startResourceCount = snap.count;
    startTransfer = snap.transfer;
    liveRequests = 0;
    liveTransfer = 0;
    longTasks = 0;
    lastResourceTs = startTime;
    pending = true;
  });

  router.subscribe("onResolved", (e) => {
    if (!pending) return;
    toPath = e.toLocation.pathname;
    // Start idle-waiter once route resolves
    waitForIdle();
  });
}

/** Returns a snapshot copy of collected metrics. */
export function getPerfMetrics(): PerfMetric[] {
  return (typeof window !== "undefined" && window.__perfMetrics) ? [...window.__perfMetrics] : [];
}

/** Clears collected metrics. */
export function clearPerfMetrics() {
  if (typeof window !== "undefined") window.__perfMetrics = [];
}