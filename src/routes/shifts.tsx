import { createFileRoute } from "@tanstack/react-router";
import Shifts, { pastShiftsQuery } from "@/features/Shifts";
import { PageSkeleton } from "@/components/shared";
export const Route = createFileRoute("/shifts")({
  head: () => ({
    meta: [
      { title: "Shifts · Shift Match" },
      { name: "description", content: "Review covered shifts, offer counts, and time to fill." },
      { property: "og:title", content: "Shifts · Shift Match" },
      {
        property: "og:description",
        content: "Review covered shifts, offer counts, and time to fill.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pastShiftsQuery),
  pendingComponent: PageSkeleton,
  pendingMs: 0,
  component: Shifts,
});
