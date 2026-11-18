/**
 * Turn a shift into a ranked list: hard rules → model likelihood → fairness penalty → reasons.
 */
import type { Candidate, CandidateStatus, FilteredOut, RankResult, Shift } from "../types.ts";
import { FEATURES, toVector, type FeatureInput } from "./features.ts";
import { contributions, predict } from "./model.ts";
import { featuresFor, groupRates, hardRuleFailure, offersLast7Days, type World } from "./world.ts";

/** Per-shift weight multipliers learned from decline reasons during a live dispatch. */
export type WeightScale = number[];

export const FAIRNESS = { perExtraOffer: 0.015, cap: 0.08 };

/** Reason chip for someone the fairness penalty moved down the list. */
export const fairnessReason = (offersThisWeek: number) => `↓ Asked ${offersThisWeek}× this week · fairness`;

export function fairnessPenalty(offers: number, teamMedian: number) {
  return Math.min(FAIRNESS.cap, FAIRNESS.perExtraOffer * Math.max(0, offers - teamMedian));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

const SLOT_WORD = { morning: "mornings", afternoon: "afternoons", evening: "evenings" } as const;

function explain(input: FeatureInput, relative: number[], extra: { slot: keyof typeof SLOT_WORD; hours: number; max: number }): string[] {
  const phrases: Record<string, () => string> = {
    distance: () => `Lives ${input.miles} mi away`,
    servedBefore: () => "Knows this client",
    utilization: () => `Has hours open (${extra.hours}/${extra.max} h)`,
    recentOffers: () => (input.offersLast7Days ? "Only 1 offer this week" : "Rested · no offers this week"),
    pastAcceptance: () => `Accepts ${Math.round(input.pastAcceptance * 100)}% of offers`,
    slotPreference: () => `Usually takes ${SLOT_WORD[extra.slot]}`,
  };
  // Only say things that are true in plain terms, not just "relatively better".
  const makesSense: Record<string, boolean> = {
    distance: input.miles <= 10,
    servedBefore: input.servedBefore,
    utilization: input.utilization <= 0.75,
    recentOffers: input.offersLast7Days <= 1,
    pastAcceptance: input.pastAcceptance >= 0.55,
    slotPreference: input.slotAcceptance - input.pastAcceptance >= 0.04,
  };
  return FEATURES.map((f, i) => ({ key: f.key, push: relative[i] ?? 0 }))
    .filter((c) => c.push > 0.05 && phrases[c.key] && makesSense[c.key])
    .sort((a, b) => b.push - a.push)
    .slice(0, 2)
    .map((c) => phrases[c.key]?.() ?? "");
}

export interface RankOptions {
  weightScale?: WeightScale;
  statuses?: Map<string, CandidateStatus>;
  /** Score each person had when their offer went out; shown instead of a recomputed one. */
  frozenScores?: Map<string, number>;
}

export function rankShift(w: World, shift: Shift, opts: RankOptions = {}): RankResult {
  const rates = groupRates(w.caregivers);
  const filteredOut: FilteredOut[] = [];
  const pool: { cg: World["caregivers"][number]; input: FeatureInput; x: number[] }[] = [];
  for (const cg of w.caregivers) {
    const status = opts.statuses?.get(cg.seed.id);
    // Someone we already offered stays in the list even if the offer itself booked them.
    const reason = status ? null : hardRuleFailure(w, cg, shift);
    if (reason) {
      filteredOut.push({ caregiverId: cg.seed.id, name: cg.seed.name, reason });
      continue;
    }
    const { input } = featuresFor(w, cg, shift, rates);
    pool.push({ cg, input, x: toVector(input) });
  }
  const teamMedian = median(w.caregivers.map((c) => offersLast7Days(c, w.now)));
  const contribs = pool.map((p) => contributions(w.model, p.x, opts.weightScale));
  const avg = FEATURES.map((_, i) => contribs.reduce((s, c) => s + (c[i] ?? 0), 0) / Math.max(1, contribs.length));
  const slot = new Date(shift.start).getHours() < 12 ? "morning" : new Date(shift.start).getHours() < 17 ? "afternoon" : "evening";

  const offersById = new Map(pool.map((p) => [p.cg.seed.id, p.input.offersLast7Days]));
  const candidates: Candidate[] = pool.map((p, idx) => {
    const score = opts.frozenScores?.get(p.cg.seed.id) ?? predict(w.model, p.x, opts.weightScale);
    const penalty = fairnessPenalty(p.input.offersLast7Days, teamMedian);
    const relative = (contribs[idx] ?? []).map((v, i) => v - (avg[i] ?? 0));
    const reasons = explain(p.input, relative, { slot, hours: p.cg.hoursThisWeek, max: p.cg.seed.maxWeeklyHours });
    if (!reasons.length) reasons.push(`Accepts ${Math.round(p.input.pastAcceptance * 100)}% of offers`);
    const isNew = p.cg.seed.tenureWeeks < 3;
    if (p.cg.stats.offers < 4) reasons.push(isNew ? "New · starts at team average" : "Little history · team average");
    if (p.input.utilization >= 0.9) reasons.push("Near overtime");
    if (penalty > 0) reasons.push(`Asked ${p.input.offersLast7Days}× this week`);
    if (p.input.miles > 18) reasons.push(`Long drive (${p.input.miles} mi)`);
    return {
      caregiverId: p.cg.seed.id,
      name: p.cg.seed.name,
      score: Math.round(score * 100) / 100,
      rankScore: score - penalty,
      fairnessPenalty: Math.round(penalty * 100) / 100,
      fairnessMoved: false,
      rank: 0,
      distanceMiles: p.input.miles,
      hoursThisWeek: p.cg.hoursThisWeek,
      maxWeeklyHours: p.cg.seed.maxWeeklyHours,
      servedClientBefore: p.input.servedBefore,
      isNew,
      status: opts.statuses?.get(p.cg.seed.id) ?? "ready",
      reasons: reasons.slice(0, 3),
    };
  });

  const order: Record<CandidateStatus, number> = { accepted: 0, offered: 1, ready: 2, declined: 3, no_response: 3, withdrawn: 3 };
  candidates.sort((a, b) => order[a.status] - order[b.status] || b.rankScore - a.rankScore || a.distanceMiles - b.distanceMiles);

  // Flag people the fairness penalty moved down: compare the final order of those still
  // waiting for a text with the order they'd have by raw likelihood alone.
  const ready = candidates.filter((c) => c.status === "ready");
  const byLikelihood = [...ready].sort((a, b) => b.score - a.score || a.distanceMiles - b.distanceMiles);
  ready.forEach((c, finalIndex) => {
    if (c.fairnessPenalty <= 0 || finalIndex <= byLikelihood.indexOf(c)) return;
    c.fairnessMoved = true;
    const offers = offersById.get(c.caregiverId) ?? 0;
    // The fairness chip replaces the plain "Asked N×" warning and always comes first.
    c.reasons = [fairnessReason(offers), ...c.reasons.filter((r) => !r.startsWith("Asked "))].slice(0, 3);
  });
  let n = 0;
  for (const c of candidates) c.rank = order[c.status] <= 2 ? ++n : 0;
  filteredOut.sort((a, b) => a.reason.localeCompare(b.reason) || a.name.localeCompare(b.name));
  return { shiftId: shift.id, candidates, filteredOut };
}
