import { beforeEach, describe, expect, it } from "vitest";
import {
  configureEngine,
  getCaregivers,
  getClients,
  getDispatch,
  getModelInfo,
  getPastShifts,
  getShifts,
  logCancellation,
  rankCandidates,
  resetDemo,
  runSimulation,
  sendOffers,
} from "@/lib/api";
import { slotsCovered } from "@/lib/engine/time";
import { toLocalIso } from "@/lib/engine/time";

const NOW = new Date(2026, 10, 18, 9, 0).getTime(); // Wed Nov 18 2026, 9:00 local

beforeEach(() => {
  configureEngine({ latencyMs: 0, minuteMs: 0, clock: () => NOW });
  resetDemo(NOW);
});

describe("hard rules", () => {
  it("only ranks caregivers who are available, skilled and credentialed", async () => {
    const people = await getCaregivers();
    for (const s of await getShifts()) {
      const needs = slotsCovered(new Date(s.start), new Date(s.end));
      for (const c of (await rankCandidates(s.id)).candidates) {
        const cg = people.find((p) => p.id === c.caregiverId);
        expect(cg).toBeDefined();
        expect(s.requiredSkills.every((k) => cg?.skills.includes(k))).toBe(true);
        expect(cg?.credentials).toContain(s.payer);
        expect(needs.every((n) => cg?.availability.some((a) => a.day === n.day && a.slot === n.slot))).toBe(true);
        expect(c.hoursThisWeek + s.durationHours).toBeLessThanOrEqual(c.maxWeeklyHours);
        expect(c.caregiverId).not.toBe(s.cancelledBy);
      }
    }
  });

  it("every filtered-out reason is actually true", async () => {
    const people = await getCaregivers();
    for (const s of await getShifts()) {
      const needs = slotsCovered(new Date(s.start), new Date(s.end));
      const r = await rankCandidates(s.id);
      expect(r.candidates.length + r.filteredOut.length).toBe(people.length);
      for (const f of r.filteredOut) {
        const cg = people.find((p) => p.id === f.caregiverId);
        if (f.reason === "Not available")
          expect(needs.every((n) => cg?.availability.some((a) => a.day === n.day && a.slot === n.slot))).toBe(false);
        else if (f.reason.startsWith("Missing skill: ")) expect(cg?.skills).not.toContain(f.reason.slice(15));
        else if (f.reason.startsWith("Missing credential: ")) expect(cg?.credentials).not.toContain(s.payer);
        else if (f.reason === "Cancelled this visit") expect(s.cancelledBy).toBe(f.caregiverId);
        else expect(f.reason).toMatch(/^(Booked: .+|Would exceed \d+ h this week)$/);
      }
    }
  });
});

describe("ranking", () => {
  it("is sorted by score minus fairness penalty with readable reasons", async () => {
    for (const s of await getShifts()) {
      const { candidates } = await rankCandidates(s.id);
      candidates.forEach((c, i) => {
        expect(c.rank).toBe(i + 1);
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(1);
        expect(c.reasons.length).toBeGreaterThan(0);
        const next = candidates[i + 1];
        if (next) expect(c.rankScore).toBeGreaterThanOrEqual(next.rankScore);
      });
    }
  });

  it("learned sensible directions from past answers", async () => {
    const info = await getModelInfo();
    const w = Object.fromEntries(info.features.map((f) => [f.key, f.weight]));
    expect(info.trainingOffers).toBeGreaterThan(300);
    expect(info.holdoutAuc).toBeGreaterThan(0.6);
    expect(w["distance"]).toBeLessThan(0);
    expect(w["servedBefore"]).toBeGreaterThan(0);
    expect(w["pastAcceptance"]).toBeGreaterThan(0);
    expect(w["utilization"]).toBeLessThan(0);
  });
});

describe("live offers", () => {
  it("one at a time never has two offers out and ends with one acceptance", async () => {
    const [shift] = await getShifts();
    if (!shift) throw new Error("no open shifts");
    const events = await sendOffers(shift.id, "sequential");
    let out = 0;
    for (const e of events) {
      if (e.action === "sent") out++;
      if (e.action === "declined" || e.action === "no_response" || e.action === "accepted") out--;
      expect(out).toBeLessThanOrEqual(1);
    }
    const state = getDispatch(shift.id);
    if (state?.status === "filled") {
      expect(events.filter((e) => e.action === "accepted")).toHaveLength(1);
      expect((await getShifts()).some((s) => s.id === shift.id)).toBe(false);
      const past = (await getPastShifts())[0];
      expect(past?.id).toBe(shift.id);
      expect(past?.filledBy).toBe(state.filledBy);
    }
  });

  it("top 3 keeps up to three offers out and withdraws the rest when filled", async () => {
    const shifts = await getShifts();
    for (const s of shifts) {
      const events = await sendOffers(s.id, "top3");
      expect(events.filter((e) => e.minute === 0 && e.action === "sent").length).toBeLessThanOrEqual(3);
      const accepted = events.findIndex((e) => e.action === "accepted");
      if (accepted >= 0) expect(events.slice(accepted + 1).every((e) => e.action === "withdrawn")).toBe(true);
    }
  });

  it("filling a shift books the caregiver and adds their hours", async () => {
    const [shift] = await getShifts();
    if (!shift) throw new Error("no open shifts");
    const before = await getCaregivers();
    await sendOffers(shift.id, "top3");
    const state = getDispatch(shift.id);
    if (state?.status !== "filled") return;
    const after = await getCaregivers();
    const who = (list: typeof before) => list.find((c) => c.name === state.filledBy);
    expect((who(after)?.hoursThisWeek ?? 0) - (who(before)?.hoursThisWeek ?? 0)).toBe(shift.durationHours);
    expect(who(after)?.clientIds).toContain(shift.clientId);
  });
});

describe("log cancellation", () => {
  it("adds a shift that is ranked right away", async () => {
    const [client] = await getClients();
    if (!client) throw new Error("no clients");
    const start = new Date(NOW + 6 * 3_600_000);
    const shift = await logCancellation({
      clientId: client.id,
      start: toLocalIso(start),
      durationHours: 4,
      requiredSkills: client.careNeeds,
      cancelledBy: null,
    });
    expect(shift.noticeHours).toBeGreaterThan(0);
    expect((await getShifts()).some((s) => s.id === shift.id)).toBe(true);
    const r = await rankCandidates(shift.id);
    expect(r.candidates.length + r.filteredOut.length).toBe((await getCaregivers()).length);
  });

  it("rejects visits in the past", async () => {
    const [client] = await getClients();
    await expect(
      logCancellation({ clientId: client?.id ?? "", start: toLocalIso(new Date(NOW - 3_600_000)), durationHours: 4, requiredSkills: ["Personal care"], cancelledBy: null }),
    ).rejects.toThrow();
  });
});

describe("simulation", () => {
  it("compares three strategies on the same shifts", async () => {
    const result = await runSimulation(500);
    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r.fillRate).toBeGreaterThan(0);
      expect(r.fillRate).toBeLessThanOrEqual(100);
      const offers = r.offersPerCaregiver.reduce((n, c) => n + c.offers, 0);
      expect(offers / 500).toBeCloseTo(r.avgOffersPerShift, 1);
    }
    const [sequential, , random] = result;
    expect(sequential?.avgOffersPerShift).toBeLessThan(random?.avgOffersPerShift ?? 0);
  });
});
