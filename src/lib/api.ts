import { caregivers, shifts, pastShifts } from "./mock";
import type {
  Shift,
  Caregiver,
  PastShift,
  RankResult,
  OfferEvent,
  SimulationResult,
} from "./types";
const delay = (ms = 240) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const filled: PastShift[] = [];
export async function getShifts(): Promise<Shift[]> {
  await delay();
  return shifts.filter((s) => !filled.some((p) => p.id === s.id)).map((s) => ({ ...s }));
}
export async function getPastShifts(): Promise<PastShift[]> {
  await delay();
  return [...filled, ...pastShifts].sort((a, b) => b.date.localeCompare(a.date));
}
export async function getCaregivers(): Promise<Caregiver[]> {
  await delay();
  return caregivers.map((c) => ({ ...c }));
}
function rank(shiftId: string): RankResult {
  const shift = shifts.find((s) => s.id === shiftId);
  if (!shift) throw new Error("Shift not found");
  const result: RankResult = { shiftId, candidates: [], filteredOut: [] };
  const start = new Date(shift.start);
  const day = (start.getDay() + 6) % 7;
  const slot = start.getHours() < 12 ? "morning" : start.getHours() < 17 ? "afternoon" : "evening";
  for (const c of caregivers) {
    const missing = shift.requiredSkills.find((s) => !c.skills.includes(s));
    const reason = !c.availability.some((a) => a.day === day && a.slot === slot)
      ? "Not available"
      : missing
        ? `Missing skill: ${missing}`
        : !c.credentials.includes(shift.payer)
          ? `Missing credential: ${shift.payer}`
          : null;
    if (reason) {
      result.filteredOut.push({ caregiverId: c.id, name: c.name, reason });
      continue;
    }
    const served = c.clientIds.includes(shift.clientId);
    const score = Math.max(
      0.1,
      Math.min(
        0.97,
        0.62 +
          c.acceptanceRate * 0.25 +
          (served ? 0.11 : 0) -
          c.homeMiles * 0.012 -
          c.offersLast7Days * 0.008 -
          (c.hoursThisWeek >= 36 ? 0.04 : 0),
      ),
    );
    result.candidates.push({
      caregiverId: c.id,
      name: c.name,
      score: +score.toFixed(2),
      rank: 0,
      distanceMiles: c.homeMiles,
      hoursThisWeek: c.hoursThisWeek,
      maxWeeklyHours: c.maxWeeklyHours,
      servedClientBefore: served,
      reasons: [
        `Lives ${c.homeMiles} mi away`,
        `Accepts ${Math.round(c.acceptanceRate * 100)}% of offers`,
        ...(c.hoursThisWeek >= 36 ? ["Near overtime"] : []),
      ],
    });
  }
  result.candidates
    .sort((a, b) => b.score - a.score || a.distanceMiles - b.distanceMiles)
    .forEach((c, i) => (c.rank = i + 1));
  return result;
}
export async function rankCandidates(shiftId: string): Promise<RankResult> {
  await delay(320);
  return rank(shiftId);
}
export async function sendOffers(
  shiftId: string,
  strategy: "sequential" | "top3",
): Promise<OfferEvent[]> {
  await delay(350);
  if (filled.some((s) => s.id === shiftId)) throw new Error("This shift is already filled");
  const candidates = rank(shiftId).candidates;
  const first = candidates[0];
  if (!first) return [];
  const second = candidates[1] ?? first;
  const events: OfferEvent[] =
    strategy === "top3"
      ? candidates.slice(0, 3).map((c) => ({ minute: 0, caregiverName: c.name, action: "sent" }))
      : [
          { minute: 0, caregiverName: first.name, action: "sent" },
          { minute: 3, caregiverName: first.name, action: "declined" },
          { minute: 3, caregiverName: second.name, action: "sent" },
        ];
  events.push({
    minute: strategy === "top3" ? 4 : 12,
    caregiverName: second.name,
    action: "accepted",
  });
  const shift = shifts.find((s) => s.id === shiftId);
  if (shift)
    filled.push({
      id: shiftId,
      date: shift.start,
      clientName: shift.clientName,
      payer: shift.payer,
      filledBy: second.name,
      offers: events.filter((e) => e.action === "sent").length,
      minutesToFill: strategy === "top3" ? 4 : 12,
      strategy,
    });
  return events;
}
export async function runSimulation(numShifts: number): Promise<SimulationResult[]> {
  if (!Number.isInteger(numShifts) || numShifts < 1 || numShifts > 10000)
    throw new Error("Choose between 1 and 10,000 shifts");
  await delay(400);
  // Deterministic synthetic trials: higher-likelihood caregivers tend to accept earlier.
  const strategies = [
    "Shift Match (one at a time)",
    "Shift Match (top 3)",
    "Random qualified pick",
  ];
  return strategies.map((strategy, si) => {
    const counts = caregivers.map((c) => ({ name: c.name, offers: 0 }));
    let minutes = 0,
      offers = 0,
      success = 0;
    for (let t = 0; t < numShifts; t++) {
      const shift = shifts[t % shifts.length];
      if (!shift) continue;
      const cs = rank(shift.id).candidates;
      const ordered =
        si === 2
          ? [...cs].sort(
              (a, b) =>
                ((Number(a.caregiverId.slice(3)) * 17 + t * 13) % 29) -
                ((Number(b.caregiverId.slice(3)) * 17 + t * 13) % 29),
            )
          : cs;
      let accepted = false;
      let trialOffers = 0;
      let trialMinutes = 0;
      for (let k = 0; k < ordered.length; k += si === 1 ? 3 : 1) {
        const batch = ordered.slice(k, k + (si === 1 ? 3 : 1));
        trialMinutes += si === 1 ? 4 : 6;
        for (const c of batch) {
          trialOffers++;
          const item = counts.find((x) => x.name === c.name);
          if (item) item.offers++;
          const roll = ((t * 37 + k * 19 + Number(c.caregiverId.slice(3)) * 11) % 101) / 100;
          if (roll < c.score) accepted = true;
        }
        if (accepted) break;
      }
      offers += trialOffers;
      if (accepted) {
        success++;
        minutes += trialMinutes;
      }
    }
    return {
      strategy,
      avgMinutesToFill: +(minutes / Math.max(1, success)).toFixed(1),
      avgOffersPerShift: +(offers / numShifts).toFixed(2),
      fillRate: +((success / numShifts) * 100).toFixed(1),
      offersPerCaregiver: counts,
    };
  });
}
