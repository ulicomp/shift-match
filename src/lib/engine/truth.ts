/**
 * "Ground truth" for the demo: how a real person would react to an offer.
 * This stands in for the humans on the other end of the text message. The ranking
 * model never reads it; it only sees the yes / no / no-reply that comes back.
 */
import type { Temperament } from "../mock.ts";
import type { Slot } from "../types.ts";
import type { Rng } from "./random.ts";

export interface OfferSituation {
  miles: number;
  servedBefore: boolean;
  utilization: number; // weekly hours after this visit ÷ max hours
  noticeHours: number;
  slot: Slot;
  weekend: boolean;
  offersLast7Days: number;
}

export type Outcome =
  | { kind: "accept"; afterMinutes: number }
  | { kind: "decline"; afterMinutes: number; reason: DeclineReason }
  | { kind: "none" };

export type DeclineReason = "Too far" | "Time doesn't work" | "Too short notice" | "Close to overtime" | "Has other plans";

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function terms(t: Temperament, s: OfferSituation) {
  return {
    distance: (-0.12 * s.miles) / t.distanceTolerance,
    slot: s.slot === t.prefers ? 0.6 : s.slot === "evening" ? -0.6 : -0.2,
    notice: s.noticeHours < 3 ? -0.55 : s.noticeHours < 8 ? -0.3 : s.noticeHours < 24 ? -0.1 : 0.1,
    overtime: -2.6 * Math.max(0, s.utilization - 0.55),
    fatigue: -0.06 * s.offersLast7Days,
  };
}

export function trueAcceptProbability(t: Temperament, s: OfferSituation): number {
  const x = terms(t, s);
  const logit =
    0.35 + t.willingness + x.distance + x.slot + x.notice + x.overtime + x.fatigue + (s.servedBefore ? 0.9 : 0) - (s.weekend ? 0.25 : 0);
  return sigmoid(logit);
}

export function sampleOutcome(t: Temperament, s: OfferSituation, rng: Rng): Outcome {
  const answers = rng() < t.responsiveness;
  const yes = rng() < trueAcceptProbability(t, s);
  const timing = rng();
  if (!answers) return { kind: "none" };
  if (yes) return { kind: "accept", afterMinutes: 1 + Math.floor(timing * 6) };
  const x = terms(t, s);
  const worst = (
    [
      ["Too far", x.distance + 0.6],
      ["Time doesn't work", x.slot],
      ["Too short notice", x.notice],
      ["Close to overtime", x.overtime],
    ] as [DeclineReason, number][]
  ).sort((a, b) => a[1] - b[1])[0];
  const reason: DeclineReason = worst && worst[1] < -0.35 ? worst[0] : "Has other plans";
  return { kind: "decline", afterMinutes: 1 + Math.floor(timing * 9), reason };
}
