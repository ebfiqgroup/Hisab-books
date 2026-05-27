import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Realtime websocket keeps caches fresh via invalidate, so we can
        // trust persisted cache for an instant first paint (<100ms) instead
        // of forcing a network refetch on every mount.
        staleTime: 60_000,
        gcTime: 24 * 60 * 60_000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
        networkMode: "offlineFirst",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPreload: "viewport",
    defaultPreloadDelay: 50,
  });

  return router;
};
