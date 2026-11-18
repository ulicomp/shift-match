import { createFileRoute } from "@tanstack/react-router";
import HowItWorks from "@/features/HowItWorks";
export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works · Shift Match" },
      {
        name: "description",
        content: "Understand eligibility rules, likelihood rankings, and caregiver fairness.",
      },
      { property: "og:title", content: "How it works · Shift Match" },
      {
        property: "og:description",
        content: "Understand eligibility rules, likelihood rankings, and caregiver fairness.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});
