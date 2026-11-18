import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageSkeleton } from "@/components/shared";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Caregivers, { caregiversQuery } from "@/features/Caregivers";
import Dispatch, { shiftsQuery } from "@/features/Dispatch";
import HowItWorks from "@/features/HowItWorks";
import AgentReport from "@/features/AgentReport";
import Shifts, { pastShiftsQuery } from "@/features/Shifts";
import Simulation from "@/features/Simulation";

function NotFound() {
  return (
    <section className="panel no-results">
      <h2>Page not found</h2>
      <p className="text-muted-foreground text-sm mt-2">That page doesn’t exist.</p>
      <Link to="/" className="underline text-sm mt-4 inline-block">
        Back to Dispatch
      </Link>
    </section>
  );
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: function Root() {
    const { queryClient } = rootRoute.useRouteContext();
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <AppShell>
            <Outlet />
          </AppShell>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    );
  },
  notFoundComponent: NotFound,
});

const page = { pendingComponent: PageSkeleton, pendingMs: 0 } as const;

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    loader: ({ context }) => context.queryClient.ensureQueryData(shiftsQuery),
    component: Dispatch,
    ...page,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/caregivers",
    loader: ({ context }) => context.queryClient.ensureQueryData(caregiversQuery),
    component: Caregivers,
    ...page,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/shifts",
    loader: ({ context }) => context.queryClient.ensureQueryData(pastShiftsQuery),
    component: Shifts,
    ...page,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: "/simulation", component: Simulation }),
  createRoute({ getParentRoute: () => rootRoute, path: "/agent", component: AgentReport }),
  createRoute({ getParentRoute: () => rootRoute, path: "/how-it-works", component: HowItWorks }),
]);

export function createAppRouter(history?: RouterHistory) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } });
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    ...(history ? { history } : {}),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
