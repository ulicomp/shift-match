import { createFileRoute } from "@tanstack/react-router";
import Simulation from "@/features/Simulation";
export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation · Shift Match" },
      {
        name: "description",
        content: "Compare caregiver offer strategies, coverage speed, and fairness.",
      },
      { property: "og:title", content: "Simulation · Shift Match" },
      {
        property: "og:description",
        content: "Compare caregiver offer strategies, coverage speed, and fairness.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Simulation,
});
