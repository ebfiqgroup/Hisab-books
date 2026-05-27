import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/hooks/useLanguage";
import { useEffect } from "react";
import { attachPerfTracker } from "@/lib/perf-tracker";
import { OfflineBadge } from "@/components/OfflineBadge";
import { InstallPrompt } from "@/components/InstallPrompt";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "আমার হিসাব - মাসিক ড্যাশবোর্ড" },
      { name: "description", content: "ব্যক্তিগত আর্থিক ব্যবস্থাপনা ড্যাশবোর্ড" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "আমার হিসাব - মাসিক ড্যাশবোর্ড" },
      { property: "og:description", content: "ব্যক্তিগত আর্থিক ব্যবস্থাপনা ড্যাশবোর্ড" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "আমার হিসাব - মাসিক ড্যাশবোর্ড" },
      { name: "twitter:description", content: "ব্যক্তিগত আর্থিক ব্যবস্থাপনা ড্যাশবোর্ড" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e4c74f2a-9cd0-4ed8-8fd3-2f742a2ddf81/id-preview-7a4679a1--97858387-bb12-42fe-a0f2-52f858e4f990.lovable.app-1779001011397.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e4c74f2a-9cd0-4ed8-8fd3-2f742a2ddf81/id-preview-7a4679a1--97858387-bb12-42fe-a0f2-52f858e4f990.lovable.app-1779001011397.png" },
      { name: "theme-color", content: "#4f46e5" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "আমার হিসাব" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.maateen.me/nikosh/nikosh.css",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style>{`
          /* Hide Google Translate UI chrome */
          #google_translate_element, .goog-te-banner-frame, .skiptranslate { display: none !important; }
          body { top: 0 !important; }
          .goog-tooltip, .goog-tooltip:hover, .goog-text-highlight {
            display: none !important; background: transparent !important; box-shadow: none !important;
          }
        `}</style>
      </head>
      <body>
        {children}
        <div id="google_translate_element" aria-hidden="true" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.googleTranslateElementInit = function() {
                new window.google.translate.TranslateElement({
                  pageLanguage: 'bn',
                  includedLanguages: 'en,bn',
                  autoDisplay: false,
                }, 'google_translate_element');
              };
            `,
          }}
        />
        <script src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" async />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    attachPerfTracker(router);
  }, [router]);

  // Register the service worker (production only, never in iframes/preview)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const host = window.location.hostname;
    const isPreview =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.endsWith("-dev.lovable.app") ||
      host === "localhost";
    if (inIframe || isPreview) {
      // Clean up any prior SW that may have been registered
      navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const persister = typeof window === "undefined"
    ? undefined
    : createSyncStoragePersister({ storage: window.localStorage, key: "amar-hishab-rq-cache" });

  if (!persister) {
    return (
      <LanguageProvider>
        <Outlet />
        <Toaster />
      </LanguageProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 /* 7d */, buster: "v1" }}
    >
      <LanguageProvider>
        <Outlet />
        <Toaster />
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto">
          <OfflineBadge />
        </div>
        <InstallPrompt />
      </LanguageProvider>
    </PersistQueryClientProvider>
  );
}
