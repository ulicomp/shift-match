import { createFileRoute } from "@tanstack/react-router";
import Dispatch, { shiftsQuery } from "@/features/Dispatch";
import { PageSkeleton } from "@/components/shared";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dispatch · Shift Match" },
      {
        name: "description",
        content: "Rank qualified caregivers and fill cancelled home-care shifts with Shift Match.",
      },
      { property: "og:title", content: "Dispatch · Shift Match" },
      {
        property: "og:description",
        content: "A clear path from cancelled shift to qualified caregiver.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(shiftsQuery),
  pendingComponent: PageSkeleton,
  pendingMs: 0,
  component: Dispatch,
});
