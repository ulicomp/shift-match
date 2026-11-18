import { createFileRoute } from "@tanstack/react-router";
import Caregivers, { caregiversQuery } from "@/features/Caregivers";
import { PageSkeleton } from "@/components/shared";
export const Route = createFileRoute("/caregivers")({
  head: () => ({
    meta: [
      { title: "Caregivers · Shift Match" },
      {
        name: "description",
        content: "Browse caregiver skills, credentials, availability, and offer history.",
      },
      { property: "og:title", content: "Caregivers · Shift Match" },
      {
        property: "og:description",
        content: "Browse caregiver skills, credentials, availability, and offer history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(caregiversQuery),
  pendingComponent: PageSkeleton,
  pendingMs: 0,
  component: Caregivers,
});
