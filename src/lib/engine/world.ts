/**
 * The agency's state in memory: people, bookings, open and filled shifts, every
 * past offer and the trained model. Built deterministically from the seed data and
 * a simulated six weeks of offer history, anchored to "now" so dates never go stale.
 */
import { AGENCY_OFFICE, CAREGIVERS, CLIENTS, type CaregiverSeed, type ClientSeed } from "../mock.ts";
import type { PastShift, Shift, Slot, Strategy } from "../types.ts";
import {
  emptyStats,
  skillGroup,
  smoothedAcceptance,
  smoothedSlotAcceptance,
  toVector,
  type FeatureInput,
  type OfferStats,
} from "./features.ts";
import { drivingMiles } from "./geo.ts";
import { learnFrom, train, type Example, type TrainedModel } from "./model.ts";
import { hashSeed, mulberry32, pick, shuffle, type Rng } from "./random.ts";
import { HOUR, isWeekend, overlaps, slotOf, slotsCovered, toLocalIso, visitTitle } from "./time.ts";
import { sampleOutcome, type OfferSituation } from "./truth.ts";

export interface Booking {
  caregiverId: string;
  clientName: string;
  start: number;
  end: number;
}

export interface CaregiverState {
  seed: CaregiverSeed;
  hoursThisWeek: number;
  stats: OfferStats;
  offerTimes: number[]; // timestamps of every offer received (for "last 7 days")
  clientIds: Set<string>;
}

export interface World {
  seed: number;
  now: number;
  clients: ClientSeed[];
  caregivers: CaregiverState[];
  bookings: Booking[];
  openShifts: Shift[];
  pastShifts: PastShift[];
  history: Example[];
  model: TrainedModel;
  shiftCounter: number;
}

export const findClient = (w: World, id: string) => w.clients.find((c) => c.id === id);
export const findCaregiver = (w: World, id: string) => w.caregivers.find((c) => c.seed.id === id);

export const offersLast7Days = (cg: CaregiverState, now: number) =>
  cg.offerTimes.filter((t) => t > now - 7 * 24 * HOUR && t <= now).length;

export function groupRates(caregivers: CaregiverState[]): Record<string, number> {
  const sums: Record<string, { offers: number; accepted: number }> = {};
  let offers = 0;
  let accepted = 0;
  for (const c of caregivers) {
    const g = skillGroup(c.seed.skills);
    const s = (sums[g] ??= { offers: 0, accepted: 0 });
    s.offers += c.stats.offers;
    s.accepted += c.stats.accepted;
    offers += c.stats.offers;
    accepted += c.stats.accepted;
  }
  const global = offers ? accepted / offers : 0.5;
  const out: Record<string, number> = { global };
  for (const [g, s] of Object.entries(sums)) out[g] = (s.accepted + 10 * global) / (s.offers + 10);
  return out;
}

export interface ShiftLike {
  clientId: string;
  start: string;
  end: string;
  durationHours: number;
  requiredSkills: string[];
  payer: Shift["payer"];
  noticeHours: number;
  cancelledBy: string | null;
}

/** Hard rules. Returns why someone can't take the visit, or null if they can. */
export function hardRuleFailure(w: World, cg: CaregiverState, shift: ShiftLike, ignoreBookings = false): string | null {
  const start = new Date(shift.start);
  const end = new Date(shift.end);
  if (shift.cancelledBy === cg.seed.id) return "Cancelled this visit";
  const needs = slotsCovered(start, end);
  if (!needs.every((n) => cg.seed.availability.some((a) => a.day === n.day && a.slot === n.slot)))
    return "Not available";
  if (!ignoreBookings) {
    const clash = w.bookings.find(
      (b) => b.caregiverId === cg.seed.id && overlaps(b.start, b.end, start.getTime(), end.getTime()),
    );
    if (clash) return `Booked: ${clash.clientName.split(" ")[0]}'s visit`;
  }
  const missing = shift.requiredSkills.find((s) => !cg.seed.skills.includes(s));
  if (missing) return `Missing skill: ${missing}`;
  if (!cg.seed.credentials.includes(shift.payer)) return `Missing credential: ${shift.payer}`;
  if (cg.hoursThisWeek + shift.durationHours > cg.seed.maxWeeklyHours)
    return `Would exceed ${cg.seed.maxWeeklyHours} h this week`;
  return null;
}

export function situationFor(w: World, cg: CaregiverState, shift: ShiftLike, at = w.now): OfferSituation & { slot: Slot } {
  const client = findClient(w, shift.clientId);
  const start = new Date(shift.start);
  return {
    miles: client ? drivingMiles(cg.seed, client) : 10,
    servedBefore: cg.clientIds.has(shift.clientId),
    utilization: (cg.hoursThisWeek + shift.durationHours) / cg.seed.maxWeeklyHours,
    noticeHours: Math.max(0, (start.getTime() - at) / HOUR),
    slot: slotOf(start),
    weekend: isWeekend(start),
    offersLast7Days: offersLast7Days(cg, at),
  };
}

export function featuresFor(w: World, cg: CaregiverState, shift: ShiftLike, rates = groupRates(w.caregivers), at = w.now): { input: FeatureInput; situation: OfferSituation; groupRate: number } {
  const situation = situationFor(w, cg, shift, at);
  const groupRate = rates[skillGroup(cg.seed.skills)] ?? rates["global"] ?? 0.5;
  return {
    situation,
    groupRate,
    input: {
      miles: situation.miles,
      servedBefore: situation.servedBefore,
      utilization: situation.utilization,
      noticeHours: situation.noticeHours,
      weekend: situation.weekend,
      offersLast7Days: situation.offersLast7Days,
      pastAcceptance: smoothedAcceptance(cg.stats, groupRate),
      slotAcceptance: smoothedSlotAcceptance(cg.stats, situation.slot, groupRate),
    },
  };
}

/** Store one answer: counters, history row, and (if live) a small model update. */
export function recordAnswer(w: World, cg: CaregiverState, input: FeatureInput, slot: Slot, accepted: boolean, live: boolean) {
  const example: Example = { x: toVector(input), y: accepted ? 1 : 0 };
  w.history.push(example);
  cg.stats.offers++;
  cg.stats.bySlot[slot].offers++;
  if (accepted) {
    cg.stats.accepted++;
    cg.stats.bySlot[slot].accepted++;
  }
  if (live) learnFrom(w.model, example);
}

/** Round up to the hour; if that lands overnight, use the client's first visit the next morning. */
function visitStartAfter(now: number, client: ClientSeed, hoursAhead: number): Date {
  const d = new Date(now + hoursAhead * HOUR);
  if (d.getMinutes() > 0) d.setHours(d.getHours() + 1, 0, 0, 0);
  else d.setMinutes(0, 0, 0);
  if (d.getHours() < 7 || d.getHours() + client.visitHours > 22) {
    if (d.getHours() >= 7) d.setDate(d.getDate() + 1);
    d.setHours(client.visitStarts[0] ?? 8, 0, 0, 0);
  }
  return d;
}

export function makeShift(w: World, client: ClientSeed, start: Date, durationHours: number, requiredSkills: string[], cancelledBy: string | null): Shift {
  const end = new Date(start.getTime() + durationHours * HOUR);
  return {
    id: `shift-${++w.shiftCounter}`,
    clientId: client.id,
    clientName: client.name,
    neighborhood: client.neighborhood,
    title: visitTitle(start, requiredSkills),
    start: toLocalIso(start),
    end: toLocalIso(end),
    durationHours,
    requiredSkills,
    payer: client.payer,
    noticeHours: Math.round(((start.getTime() - w.now) / HOUR) * 10) / 10,
    cancelledBy,
    cancelledByName: w.caregivers.find((c) => c.seed.id === cancelledBy)?.seed.name ?? null,
  };
}

const HISTORY_DAYS = 42;
const CANCELLATIONS_PER_DAY = 8;

/** Replays six weeks of cancellations the old way (closest first) to produce real-looking history. */
function generateHistory(w: World, rng: Rng) {
  const events: { at: number; client: ClientSeed; start: Date; notice: number }[] = [];
  for (let day = HISTORY_DAYS; day >= 1; day--) {
    for (let k = 0; k < CANCELLATIONS_PER_DAY; k++) {
      const client = pick(rng, w.clients);
      const base = new Date(w.now - day * 24 * HOUR);
      base.setHours(pick(rng, client.visitStarts), 0, 0, 0);
      const r = rng();
      const notice = r < 0.3 ? 1 + rng() * 4 : r < 0.75 ? 5 + rng() * 19 : 24 + rng() * 48;
      events.push({ at: base.getTime() - notice * HOUR, client, start: base, notice });
    }
  }
  events.sort((a, b) => a.at - b.at);
  for (const e of events) {
    const end = new Date(e.start.getTime() + e.client.visitHours * HOUR);
    const regulars = w.caregivers.filter((c) => c.seed.regularClients.includes(e.client.id));
    const cancelledBy = regulars.length ? pick(rng, regulars).seed.id : null;
    const shift: ShiftLike = {
      clientId: e.client.id,
      start: toLocalIso(e.start),
      end: toLocalIso(end),
      durationHours: e.client.visitHours,
      requiredSkills: e.client.careNeeds,
      payer: e.client.payer,
      noticeHours: e.notice,
      cancelledBy,
    };
    const joinedBy = (c: CaregiverState) => w.now - c.seed.tenureWeeks * 7 * 24 * HOUR;
    const eligible = w.caregivers.filter((c) => {
      if (joinedBy(c) > e.at) return false;
      const saved = c.hoursThisWeek;
      c.hoursThisWeek = 8 + Math.floor(rng() * 24); // weekly hours vary across past weeks
      const ok = hardRuleFailure(w, c, shift, true) === null;
      c.hoursThisWeek = ok ? c.hoursThisWeek : saved;
      return ok;
    });
    const rates = groupRates(w.caregivers);
    const strategy: Strategy = rng() < 0.6 ? "sequential" : "top3";
    // Old way: dispatcher calls whoever lives closest, with a bit of human noise.
    const order = eligible
      .map((c) => ({ c, f: featuresFor(w, c, shift, rates, e.at) }))
      .sort((a, b) => a.f.input.miles + rng() * 4 - (b.f.input.miles + rng() * 4))
      .slice(0, 8);
    let minutes = 0;
    let offers = 0;
    let filledBy: CaregiverState | null = null;
    const batch = strategy === "top3" ? 3 : 1;
    for (let i = 0; i < order.length && !filledBy; i += batch) {
      const group = order.slice(i, i + batch);
      let firstYes: { c: CaregiverState; after: number } | null = null;
      let slowest = 0;
      for (const { c, f } of group) {
        offers++;
        c.offerTimes.push(e.at + minutes * 60_000);
        const outcome = sampleOutcome(c.seed.temperament, f.situation, rng);
        const accepted = outcome.kind === "accept";
        recordAnswer(w, c, f.input, slotOf(e.start), accepted, false);
        const after = outcome.kind === "none" ? 15 : outcome.afterMinutes;
        slowest = Math.max(slowest, after);
        if (accepted && (!firstYes || after < firstYes.after)) firstYes = { c, after };
      }
      if (firstYes) {
        minutes += firstYes.after;
        filledBy = firstYes.c;
      } else minutes += slowest;
    }
    if (filledBy) {
      filledBy.clientIds.add(e.client.id);
      w.pastShifts.push({
        id: `past-${w.pastShifts.length}`,
        date: toLocalIso(e.start),
        clientName: e.client.name,
        payer: e.client.payer,
        filledBy: filledBy.seed.name,
        offers,
        minutesToFill: minutes,
        strategy,
      });
    }
  }
  w.pastShifts.sort((a, b) => b.date.localeCompare(a.date));
  w.pastShifts = w.pastShifts.slice(0, 60);
}

/** Existing visits on the schedule for the next few days (so "Booked" is a real rule). */
function generateBookings(w: World, rng: Rng) {
  for (const cg of w.caregivers)
    for (const clientId of cg.seed.regularClients) {
      const client = findClient(w, clientId);
      if (!client) continue;
      for (let day = 0; day < 4; day++) {
        const start = new Date(w.now + day * 24 * HOUR);
        start.setHours(client.visitStarts[0] ?? 9, 0, 0, 0);
        const end = start.getTime() + client.visitHours * HOUR;
        const free = !w.bookings.some((b) => b.caregiverId === cg.seed.id && overlaps(b.start, b.end, start.getTime(), end));
        if (free && rng() < 0.22) w.bookings.push({ caregiverId: cg.seed.id, clientName: client.name, start: start.getTime(), end });
      }
    }
}

const OPEN_SHIFT_PLAN: { clientId: string; hoursAhead: number; cancelledBy: string }[] = [
  { clientId: "client-0", hoursAhead: 2, cancelledBy: "Sarah Johnson" },
  { clientId: "client-2", hoursAhead: 4, cancelledBy: "Elena Gonzalez" },
  { clientId: "client-5", hoursAhead: 9, cancelledBy: "James Wilson" },
  { clientId: "client-3", hoursAhead: 20, cancelledBy: "Marie Laurent" },
  { clientId: "client-6", hoursAhead: 30, cancelledBy: "Michel Francois" },
  { clientId: "client-7", hoursAhead: 44, cancelledBy: "Miguel Santos" },
];

export function createWorld(now = Date.now(), seed = 20261118): World {
  const rng = mulberry32(seed);
  const w: World = {
    seed,
    now,
    clients: CLIENTS.map((c) => ({ ...c })),
    caregivers: CAREGIVERS.map((s) => ({
      seed: s,
      hoursThisWeek: s.hoursThisWeek,
      stats: emptyStats(),
      offerTimes: [],
      clientIds: new Set(s.regularClients),
    })),
    bookings: [],
    openShifts: [],
    pastShifts: [],
    history: [],
    model: undefined as unknown as TrainedModel,
    shiftCounter: 0,
  };
  const seasonalHours = w.caregivers.map((c) => c.hoursThisWeek);
  generateHistory(w, rng);
  w.caregivers.forEach((c, i) => (c.hoursThisWeek = seasonalHours[i] ?? c.hoursThisWeek));
  w.model = train(w.history);
  generateBookings(w, mulberry32(hashSeed(seed, "bookings")));
  for (const plan of OPEN_SHIFT_PLAN) {
    const client = findClient(w, plan.clientId);
    if (!client) continue;
    const start = visitStartAfter(now, client, plan.hoursAhead);
    const by = w.caregivers.find((c) => c.seed.name === plan.cancelledBy)?.seed.id ?? null;
    w.bookings = w.bookings.filter(
      (b) => !(b.caregiverId === by && overlaps(b.start, b.end, start.getTime(), start.getTime() + client.visitHours * HOUR)),
    );
    w.openShifts.push(makeShift(w, client, start, client.visitHours, [...client.careNeeds], by));
  }
  return w;
}

export const officeMiles = (cg: CaregiverSeed) => drivingMiles(cg, AGENCY_OFFICE);
export { shuffle };
