import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageLoadError, PageSkeleton } from "./components/site/loading/RouteLoading";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // Only published agency content gets this cache policy. Admin/session queries
  // retain their own freshness and privacy rules. staleTime is deliberately
  // short so admin edits to team / portfolio / case studies surface within
  // seconds — the CDN (s-maxage=10) and this both revalidate quickly.
  queryClient.setQueryDefaults(["public"], {
    staleTime: 20_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 80,
    defaultPreloadStaleTime: 5 * 60_000,
    defaultStaleTime: 5 * 60_000,
    defaultGcTime: 30 * 60_000,
    defaultPendingMs: 80,
    defaultPendingMinMs: 120,
    defaultPendingComponent: PageSkeleton,
    defaultErrorComponent: PageLoadError,
  });

  return router;
};
