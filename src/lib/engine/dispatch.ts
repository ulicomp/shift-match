/**
 * Live offer loop. Every simulated minute: collect answers that came back, learn from
 * them, re-rank what's left, and keep the right number of offers out (1 or 3).
 */
import type { CandidateStatus, DispatchState, OfferEvent, Shift, Strategy } from "../types.ts";
import { FEATURES, type FeatureInput } from "./features.ts";
import { hashSeed, mulberry32 } from "./random.ts";
import { rankShift } from "./ranking.ts";
import { HOUR, slotOf } from "./time.ts";
import { sampleOutcome, type DeclineReason, type Outcome } from "./truth.ts";
import { featuresFor, findCaregiver, hardRuleFailure, recordAnswer, type World } from "./world.ts";

interface Outstanding {
  caregiverId: string;
  dueAt: number;
  outcome: Outcome;
  input: FeatureInput;
}

export interface LiveDispatch {
  shift: Shift;
  state: DispatchState;
  statuses: Map<string, CandidateStatus>;
  frozenScores: Map<string, number>;
  outstanding: Outstanding[];
  weightScale: number[];
  timeoutMinutes: number;
}

const idx = (key: (typeof FEATURES)[number]["key"]) => FEATURES.findIndex((f) => f.key === key);

/** What a decline teaches us about this particular visit. */
const LESSONS: Partial<Record<DeclineReason | "no_reply", { feature: (typeof FEATURES)[number]["key"]; factor: number; note: string }>> = {
  "Too far": { feature: "distance", factor: 1.6, note: "Distance weighs more now" },
  "Time doesn't work": { feature: "slotPreference", factor: 1.6, note: "Time-of-day fit weighs more now" },
  "Close to overtime": { feature: "utilization", factor: 1.6, note: "Open hours weigh more now" },
  "Too short notice": { feature: "pastAcceptance", factor: 1.3, note: "Reliable responders weigh more now" },
  no_reply: { feature: "pastAcceptance", factor: 1.2, note: "Reliable responders weigh more now" },
};

const isFilled = (d: LiveDispatch) => d.state.status === "filled";
const name = (w: World, id: string) => findCaregiver(w, id)?.seed.name ?? id;

export function createDispatch(shift: Shift, strategy: Strategy): LiveDispatch {
  return {
    shift,
    state: { shiftId: shift.id, strategy, status: "running", minute: 0, events: [], filledBy: null },
    statuses: new Map(),
    frozenScores: new Map(),
    outstanding: [],
    weightScale: FEATURES.map(() => 1),
    timeoutMinutes: shift.noticeHours < 12 ? 8 : 15,
  };
}

const ranking = (w: World, d: LiveDispatch) =>
  rankShift(w, d.shift, { weightScale: d.weightScale, statuses: d.statuses, frozenScores: d.frozenScores });

function fill(w: World, d: LiveDispatch, caregiverId: string, minute: number, events: OfferEvent[]) {
  const cg = findCaregiver(w, caregiverId);
  if (!cg) return;
  d.statuses.set(caregiverId, "accepted");
  d.state.status = "filled";
  d.state.filledBy = cg.seed.name;
  events.push({ minute, caregiverName: cg.seed.name, action: "accepted", detail: `Filled in ${minute} min` });
  for (const o of d.outstanding) {
    w.pendingOffers.delete(o.caregiverId);
    d.statuses.set(o.caregiverId, "withdrawn");
    events.push({ minute, caregiverName: name(w, o.caregiverId), action: "withdrawn", detail: "Offer withdrawn · shift filled" });
  }
  d.outstanding = [];
  const start = new Date(d.shift.start).getTime();
  cg.hoursThisWeek += d.shift.durationHours;
  cg.clientIds.add(d.shift.clientId);
  w.bookings.push({ caregiverId, clientName: d.shift.clientName, start, end: start + d.shift.durationHours * HOUR });
  w.openShifts = w.openShifts.filter((s) => s.id !== d.shift.id);
  w.pastShifts.unshift({
    id: d.shift.id,
    date: d.shift.start,
    clientName: d.shift.clientName,
    payer: d.shift.payer,
    filledBy: cg.seed.name,
    offers: [...d.statuses.values()].length,
    minutesToFill: minute,
    strategy: d.state.strategy,
  });
}

/** Advance one simulated minute. Returns the new events. */
export function stepDispatch(w: World, d: LiveDispatch): OfferEvent[] {
  if (d.state.status !== "running") return [];
  const minute = d.state.minute;
  const events: OfferEvent[] = [];
  const before = ranking(w, d).candidates.filter((c) => c.status === "ready").map((c) => c.caregiverId);
  let learned: string | null = null;

  const due = d.outstanding.filter((o) => o.dueAt <= minute).sort((a, b) => a.dueAt - b.dueAt);
  d.outstanding = d.outstanding.filter((o) => o.dueAt > minute);
  const slot = slotOf(new Date(d.shift.start));
  for (const o of due) {
    const cg = findCaregiver(w, o.caregiverId);
    if (!cg) continue;
    // Late answers after the shift is filled don't count.
    if (isFilled(d)) continue;
    w.pendingOffers.delete(o.caregiverId);
    if (o.outcome.kind === "accept") {
      // They may have taken another visit since we texted them.
      const nowBlocked = hardRuleFailure(w, cg, d.shift);
      if (nowBlocked) {
        d.statuses.set(o.caregiverId, "declined");
        events.push({ minute, caregiverName: cg.seed.name, action: "declined", detail: "Said yes, but just took another visit" });
        continue;
      }
      recordAnswer(w, cg, o.input, slot, true, true);
      fill(w, d, o.caregiverId, minute, events);
      continue;
    }
    recordAnswer(w, cg, o.input, slot, false, true);
    const key = o.outcome.kind === "decline" ? o.outcome.reason : "no_reply";
    d.statuses.set(o.caregiverId, o.outcome.kind === "decline" ? "declined" : "no_response");
    events.push({
      minute,
      caregiverName: cg.seed.name,
      action: o.outcome.kind === "decline" ? "declined" : "no_response",
      detail: o.outcome.kind === "decline" ? `“${o.outcome.reason}”` : `No reply in ${d.timeoutMinutes} min`,
    });
    const lesson = LESSONS[key];
    if (lesson) {
      const i = idx(lesson.feature);
      d.weightScale[i] = Math.min(2.5, (d.weightScale[i] ?? 1) * lesson.factor);
      learned = lesson.note;
    }
  }

  if (d.state.status === "running") {
    const after = ranking(w, d).candidates.filter((c) => c.status === "ready");
    if (due.length) {
      const ids = after.map((c) => c.caregiverId);
      const prior = before.filter((id) => ids.includes(id));
      const mover = after
        .map((c, i) => ({ c, gain: prior.indexOf(c.caregiverId) - i }))
        .filter((m) => m.gain > 0)
        .sort((a, b) => b.gain - a.gain)[0];
      if (mover && after.indexOf(mover.c) < 5)
        events.push({
          minute,
          caregiverName: mover.c.name,
          action: "reranked",
          detail: `${learned ? `${learned} · ` : ""}${mover.c.name.split(" ")[0]} moves up to #${
            d.outstanding.length + after.indexOf(mover.c) + 1
          }`,
        });
    }
    const target = d.state.strategy === "top3" ? 3 : 1;
    for (const next of after) {
      if (d.outstanding.length >= target) break;
      if (w.pendingOffers.has(next.caregiverId)) continue; // already has an offer out for another visit
      const cg = findCaregiver(w, next.caregiverId);
      if (!cg) continue;
      const { input, situation } = featuresFor(w, cg, d.shift);
      const rng = mulberry32(hashSeed(w.seed, d.shift.id, cg.seed.id, d.state.strategy));
      const outcome = sampleOutcome(cg.seed.temperament, situation, rng);
      d.outstanding.push({
        caregiverId: cg.seed.id,
        input,
        outcome,
        dueAt: minute + (outcome.kind === "none" ? d.timeoutMinutes : outcome.afterMinutes),
      });
      cg.offerTimes.push(w.now);
      w.pendingOffers.set(cg.seed.id, d.shift.id);
      d.statuses.set(cg.seed.id, "offered");
      d.frozenScores.set(cg.seed.id, next.score);
      events.push({ minute, caregiverName: cg.seed.name, action: "sent", detail: `#${next.rank} · ${Math.round(next.score * 100)}% likely` });
    }
    const waitingElsewhere = after.some((c) => w.pendingOffers.has(c.caregiverId));
    if (d.outstanding.length === 0 && !waitingElsewhere) d.state.status = "unfilled";
  }
  d.state.events.push(...events);
  if (d.state.status === "running") d.state.minute++;
  return events;
}

/** Run to the end in one go (tests, simulation-style checks). */
export function runToEnd(w: World, d: LiveDispatch, maxMinutes = 600): DispatchState {
  while (d.state.status === "running" && d.state.minute < maxMinutes) stepDispatch(w, d);
  return d.state;
}
