/**
 * What the agency can actually observe about an offer. These are the model's inputs.
 */
import type { Slot } from "../types.ts";

export const FEATURES = [
  { key: "distance", label: "Distance to client", description: "Driving miles from the caregiver's home to the client." },
  { key: "servedBefore", label: "Served this client before", description: "Familiar faces say yes more, and clients prefer them." },
  { key: "utilization", label: "Weekly hours after visit", description: "Hours this week plus this visit, divided by their max. Near overtime → fewer yeses." },
  { key: "notice", label: "Notice time", description: "Hours between the offer and the visit (log scale). Short notice is harder." },
  { key: "weekend", label: "Weekend visit", description: "Saturday or Sunday visits." },
  { key: "recentOffers", label: "Offers in last 7 days", description: "How often we already asked this person this week." },
  { key: "pastAcceptance", label: "Past acceptance rate", description: "Their own yes rate, blended with their skill group's average when history is thin." },
  { key: "slotPreference", label: "Time-of-day preference", description: "How much more (or less) often they say yes at this time of day than they do overall." },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];

export interface FeatureInput {
  miles: number;
  servedBefore: boolean;
  utilization: number;
  noticeHours: number;
  weekend: boolean;
  offersLast7Days: number;
  pastAcceptance: number;
  slotAcceptance: number;
}

export function toVector(f: FeatureInput): number[] {
  return [
    f.miles,
    f.servedBefore ? 1 : 0,
    f.utilization,
    Math.log1p(Math.max(0, f.noticeHours)),
    f.weekend ? 1 : 0,
    f.offersLast7Days,
    f.pastAcceptance,
    f.slotAcceptance - f.pastAcceptance,
  ];
}

/** Per-person counters the agency keeps from past yes/no answers. */
export interface OfferStats {
  offers: number;
  accepted: number;
  bySlot: Record<Slot, { offers: number; accepted: number }>;
}

export const emptyStats = (): OfferStats => ({
  offers: 0,
  accepted: 0,
  bySlot: {
    morning: { offers: 0, accepted: 0 },
    afternoon: { offers: 0, accepted: 0 },
    evening: { offers: 0, accepted: 0 },
  },
});

/** How many "virtual" offers at the group average a newcomer starts with. */
export const PRIOR_WEIGHT = 5;

export const smoothedAcceptance = (s: OfferStats, groupRate: number) =>
  (s.accepted + PRIOR_WEIGHT * groupRate) / (s.offers + PRIOR_WEIGHT);

export function smoothedSlotAcceptance(s: OfferStats, slot: Slot, groupRate: number) {
  const own = smoothedAcceptance(s, groupRate);
  const b = s.bySlot[slot];
  return (b.accepted + 3 * own) / (b.offers + 3);
}

/** Skill group used for the cold start prior. */
export const skillGroup = (skills: string[]) =>
  skills.includes("Dementia care") ? "Dementia care" : skills.includes("Hoyer lift") ? "Hoyer lift" : "General care";
