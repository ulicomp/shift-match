/**
 * The only module the UI talks to. Today it runs the matching engine in the browser
 * against an in-memory agency; swapping in a real backend means re-implementing
 * these functions with fetch calls and keeping the same signatures.
 */
import type {
  Caregiver,
  Client,
  DispatchState,
  ModelInfo,
  NewCancellation,
  OfferEvent,
  PastShift,
  RankResult,
  Shift,
  SimulationResult,
  Strategy,
} from "./types.ts";
import { createDispatch, runToEnd, stepDispatch, type LiveDispatch } from "./engine/dispatch.ts";
import { FEATURES } from "./engine/features.ts";
import { rankShift } from "./engine/ranking.ts";
import { simulate } from "./engine/simulation.ts";
import { HOUR } from "./engine/time.ts";
import { createWorld, findCaregiver, findClient, makeShift, officeMiles, offersLast7Days, type World } from "./engine/world.ts";

const config: { latencyMs: number; minuteMs: number; clock: () => number } = {
  latencyMs: 180,
  minuteMs: 900,
  clock: () => Date.now(),
};

/** Tests set the delays to 0 and pin the clock so results don't depend on the time of day. */
export function configureEngine(next: Partial<typeof config>) {
  Object.assign(config, next);
}

let world: World | null = null;
const dispatches = new Map<string, LiveDispatch>();
const listeners = new Set<() => void>();
let version = 0;

const getWorld = () => (world ??= createWorld(config.clock()));
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};
const delay = (ms = config.latencyMs) =>
  ms ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

/** Start over with a fresh agency (new "now", same people). */
export function resetDemo(now?: number) {
  dispatches.clear();
  world = createWorld(now ?? config.clock());
  notify();
}

/** Subscribe to any engine change (offers moving, shifts filled, new cancellations). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getVersion = () => version;

export async function getShifts(): Promise<Shift[]> {
  await delay();
  return getWorld().openShifts
    .map((s) => ({ ...s }))
    .sort((a, b) => a.noticeHours - b.noticeHours);
}

export async function getPastShifts(): Promise<PastShift[]> {
  await delay();
  return getWorld().pastShifts.map((s) => ({ ...s }));
}

export async function getClients(): Promise<Client[]> {
  await delay(0);
  return getWorld().clients.map(({ id, name, neighborhood, payer, careNeeds }) => ({ id, name, neighborhood, payer, careNeeds: [...careNeeds] }));
}

export async function getCaregivers(): Promise<Caregiver[]> {
  await delay();
  const w = getWorld();
  return w.caregivers.map((c) => ({
    id: c.seed.id,
    name: c.seed.name,
    neighborhood: c.seed.neighborhood,
    skills: [...c.seed.skills],
    credentials: [...c.seed.credentials],
    homeMiles: officeMiles(c.seed),
    hoursThisWeek: c.hoursThisWeek,
    maxWeeklyHours: c.seed.maxWeeklyHours,
    acceptanceRate: c.stats.offers ? Math.round((c.stats.accepted / c.stats.offers) * 100) / 100 : 0,
    offersLast7Days: offersLast7Days(c, w.now),
    offersTotal: c.stats.offers,
    acceptedTotal: c.stats.accepted,
    isNew: c.seed.tenureWeeks < 3,
    clientIds: [...c.clientIds],
    availability: c.seed.availability.map((a) => ({ ...a })),
  }));
}

function shiftById(shiftId: string): Shift {
  const w = getWorld();
  const shift = w.openShifts.find((s) => s.id === shiftId) ?? dispatches.get(shiftId)?.shift;
  if (!shift) throw new Error("Shift not found");
  return shift;
}

export async function rankCandidates(shiftId: string): Promise<RankResult> {
  await delay();
  const d = dispatches.get(shiftId);
  return rankShift(getWorld(), shiftById(shiftId), d ? { weightScale: d.weightScale, statuses: d.statuses, frozenScores: d.frozenScores } : {});
}

/** Same as rankCandidates but synchronous, for live re-rendering while offers are out. */
export function rankNow(shiftId: string): RankResult | null {
  try {
    const d = dispatches.get(shiftId);
    return rankShift(getWorld(), shiftById(shiftId), d ? { weightScale: d.weightScale, statuses: d.statuses, frozenScores: d.frozenScores } : {});
  } catch {
    return null;
  }
}

export function getDispatch(shiftId: string): DispatchState | null {
  const d = dispatches.get(shiftId);
  return d ? { ...d.state, events: [...d.state.events] } : null;
}

/**
 * Starts sending offers and resolves with the full timeline once the shift is filled
 * (or nobody is left). Progress is published through subscribe() every simulated minute.
 */
export async function sendOffers(shiftId: string, strategy: Strategy): Promise<OfferEvent[]> {
  await delay();
  const w = getWorld();
  const existing = dispatches.get(shiftId);
  if (existing?.state.status === "filled") throw new Error("This shift is already filled");
  if (existing?.state.status === "running") throw new Error("Offers are already out for this shift");
  const d = createDispatch(shiftById(shiftId), strategy);
  dispatches.set(shiftId, d);
  if (!config.minuteMs) {
    runToEnd(w, d);
    notify();
    return [...d.state.events];
  }
  return new Promise((resolve) => {
    const tick = () => {
      const events = stepDispatch(w, d);
      if (events.length) notify();
      if (d.state.status === "running") setTimeout(tick, events.length ? config.minuteMs : config.minuteMs / 3);
      else {
        notify();
        resolve([...d.state.events]);
      }
    };
    tick();
  });
}

export async function logCancellation(input: NewCancellation): Promise<Shift> {
  await delay();
  const w = getWorld();
  const client = findClient(w, input.clientId);
  if (!client) throw new Error("Choose a client");
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) throw new Error("Choose a start date and time");
  w.now = Math.max(w.now, config.clock());
  if (start.getTime() <= w.now) throw new Error("The visit must start in the future");
  if (!(input.durationHours >= 1 && input.durationHours <= 12)) throw new Error("Visits are 1 to 12 hours");
  if (!input.requiredSkills.length) throw new Error("Pick at least one required skill");
  const by = input.cancelledBy ? findCaregiver(w, input.cancelledBy) : undefined;
  const shift = makeShift(w, client, start, input.durationHours, [...input.requiredSkills], by?.seed.id ?? null);
  if (by)
    w.bookings = w.bookings.filter(
      (b) => !(b.caregiverId === by.seed.id && b.start < start.getTime() + input.durationHours * HOUR && start.getTime() < b.end),
    );
  w.openShifts.push(shift);
  notify();
  return { ...shift };
}

export async function runSimulation(numShifts: number): Promise<SimulationResult[]> {
  if (!Number.isInteger(numShifts) || numShifts < 1 || numShifts > 10000)
    throw new Error("Choose between 1 and 10,000 shifts");
  await delay();
  return simulate(getWorld(), numShifts);
}

export async function getModelInfo(): Promise<ModelInfo> {
  await delay(0);
  const m = getWorld().model;
  return {
    trainingOffers: m.trainingOffers,
    holdoutOffers: m.holdoutOffers,
    holdoutAccuracy: Math.round(m.holdoutAccuracy * 1000) / 1000,
    holdoutAuc: Math.round(m.holdoutAuc * 1000) / 1000,
    baseAcceptRate: Math.round(m.baseAcceptRate * 1000) / 1000,
    onlineUpdates: m.onlineUpdates,
    features: FEATURES.map((f, i) => ({ ...f, weight: Math.round((m.weights[i] ?? 0) * 100) / 100 })),
  };
}

export interface TodayStats {
  open: number;
  urgent: number;
  offersOut: number;
  filledToday: number;
  avgMinutesToFill: number | null;
}

/** Live numbers for the top bar. Synchronous so it can re-render on every engine change. */
export function statsNow(): TodayStats {
  const w = getWorld();
  const filled = w.pastShifts.filter((p) => p.id.startsWith("shift-"));
  return {
    open: w.openShifts.length,
    urgent: w.openShifts.filter((s) => s.noticeHours < 12).length,
    offersOut: [...dispatches.values()].filter((d) => d.state.status === "running").length,
    filledToday: filled.length,
    avgMinutesToFill: filled.length
      ? Math.round(filled.reduce((n, p) => n + p.minutesToFill, 0) / filled.length)
      : null,
  };
}
