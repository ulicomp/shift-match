/**
 * Monte Carlo comparison. The same N cancellations and the same simulated people are
 * replayed under each strategy, so differences come from the strategy alone.
 */
import type { SimulationResult } from "../types.ts";
import { smoothedAcceptance, smoothedSlotAcceptance, toVector, skillGroup, type OfferStats } from "./features.ts";
import { drivingMiles } from "./geo.ts";
import { predict } from "./model.ts";
import { fairnessPenalty } from "./ranking.ts";
import { hashSeed, mulberry32, pick, shuffle } from "./random.ts";
import { HOUR, isWeekend, slotOf, slotsCovered } from "./time.ts";
import { sampleOutcome, type Outcome } from "./truth.ts";
import { groupRates, type World } from "./world.ts";

export const STRATEGY_NAMES = ["Shift Match (one at a time)", "Shift Match (top 3)", "Random qualified pick"] as const;

const SHIFTS_PER_DAY = 8;
const WINDOW = 7 * SHIFTS_PER_DAY; // one week of cancellations

interface SimCancellation {
  clientIndex: number;
  start: Date;
  noticeHours: number;
}

function makeCancellations(w: World, n: number): SimCancellation[] {
  const rng = mulberry32(hashSeed(w.seed, "simulation", n));
  return Array.from({ length: n }, (_, i) => {
    const clientIndex = Math.floor(rng() * w.clients.length);
    const client = w.clients[clientIndex];
    const start = new Date(w.now + Math.floor(i / SHIFTS_PER_DAY) * 24 * HOUR);
    start.setHours(client ? pick(rng, client.visitStarts) : 9, 0, 0, 0);
    const r = rng();
    const noticeHours = r < 0.3 ? 1 + rng() * 4 : r < 0.75 ? 5 + rng() * 19 : 24 + rng() * 48;
    return { clientIndex, start, noticeHours };
  });
}

export function simulate(w: World, n: number): SimulationResult[] {
  const shifts = makeCancellations(w, n);
  const rates = groupRates(w.caregivers);
  return STRATEGY_NAMES.map((strategy, si) => {
    // Fresh copy of everyone's week for each strategy.
    const people = w.caregivers.map((c) => ({
      c,
      baseHours: Math.round(c.seed.hoursThisWeek * 0.6),
      hours: Math.round(c.seed.hoursThisWeek * 0.6),
      stats: structuredClone(c.stats) as OfferStats,
      recent: [] as number[], // shift index of each offer received
      offers: 0,
    }));
    let filled = 0;
    let minutesTotal = 0;
    let offersTotal = 0;
    const order = mulberry32(hashSeed(w.seed, "random-order", n));
    shifts.forEach((s, i) => {
      if (i % WINDOW === 0) people.forEach((p) => (p.hours = p.baseHours));
      const client = w.clients[s.clientIndex];
      if (!client) return;
      const end = new Date(s.start.getTime() + client.visitHours * HOUR);
      const needs = slotsCovered(s.start, end);
      const slot = slotOf(s.start);
      const eligible = people.filter(
        (p) =>
          needs.every((nd) => p.c.seed.availability.some((a) => a.day === nd.day && a.slot === nd.slot)) &&
          client.careNeeds.every((k) => p.c.seed.skills.includes(k)) &&
          p.c.seed.credentials.includes(client.payer) &&
          p.hours + client.visitHours <= p.c.seed.maxWeeklyHours,
      );
      const recentCount = (p: (typeof people)[number]) => p.recent.filter((t) => t > i - WINDOW).length;
      const teamMedian = [...people.map(recentCount)].sort((a, b) => a - b)[Math.floor(people.length / 2)] ?? 0;
      const scored = eligible.map((p) => {
        const groupRate = rates[skillGroup(p.c.seed.skills)] ?? 0.5;
        const miles = drivingMiles(p.c.seed, client);
        const situation = {
          miles,
          servedBefore: p.c.clientIds.has(client.id),
          utilization: (p.hours + client.visitHours) / p.c.seed.maxWeeklyHours,
          noticeHours: s.noticeHours,
          slot,
          weekend: isWeekend(s.start),
          offersLast7Days: recentCount(p),
        };
        const x = toVector({
          ...situation,
          pastAcceptance: smoothedAcceptance(p.stats, groupRate),
          slotAcceptance: smoothedSlotAcceptance(p.stats, slot, groupRate),
        });
        const score = predict(w.model, x) - fairnessPenalty(situation.offersLast7Days, teamMedian);
        const outcome: Outcome = sampleOutcome(p.c.seed.temperament, situation, mulberry32(hashSeed(w.seed, "sim", i, p.c.seed.id)));
        return { p, score, outcome };
      });
      const queue = si === 2 ? shuffle(order, scored) : [...scored].sort((a, b) => b.score - a.score);
      const concurrency = si === 1 ? 3 : 1;
      const timeout = s.noticeHours < 12 ? 8 : 15;
      const budget = Math.min(120, s.noticeHours * 60 * 0.5); // must be covered well before the visit
      // Event-driven: keep `concurrency` offers out, first yes wins.
      let clock = 0;
      let next = 0;
      const out: { done: number; yes: boolean; who: (typeof scored)[number] }[] = [];
      let winner: (typeof scored)[number] | null = null;
      const send = () => {
        while (out.length < concurrency && next < queue.length) {
          const q = queue[next++];
          if (!q) break;
          q.p.offers++;
          q.p.recent.push(i);
          offersTotal++;
          out.push({ done: clock + (q.outcome.kind === "none" ? timeout : q.outcome.afterMinutes), yes: q.outcome.kind === "accept", who: q });
        }
      };
      send();
      while (out.length && !winner) {
        out.sort((a, b) => a.done - b.done);
        const first = out.shift();
        if (!first) break;
        clock = first.done;
        if (clock > budget) break;
        first.who.p.stats.offers++;
        if (first.yes) {
          winner = first.who;
          first.who.p.stats.accepted++;
        } else send();
      }
      if (winner) {
        filled++;
        minutesTotal += clock;
        winner.p.hours += client.visitHours;
      }
    });
    return {
      strategy,
      avgMinutesToFill: Math.round((minutesTotal / Math.max(1, filled)) * 10) / 10,
      avgOffersPerShift: Math.round((offersTotal / Math.max(1, n)) * 100) / 100,
      fillRate: Math.round((filled / Math.max(1, n)) * 1000) / 10,
      offersPerCaregiver: people.map((p) => ({ name: p.c.seed.name, offers: p.offers })),
    };
  });
}
