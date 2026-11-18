import { describe, it, expect } from "vitest";
import {
  getCaregivers,
  getShifts,
  rankCandidates,
  sendOffers,
  getPastShifts,
  runSimulation,
} from "@/lib/api";
describe("Shift Match eligibility", () => {
  it("every ranked caregiver has all required skills", async () => {
    const cs = await getCaregivers();
    for (const s of await getShifts()) {
      const r = await rankCandidates(s.id);
      for (const c of r.candidates) {
        const cg = cs.find((x) => x.id === c.caregiverId);
        expect(s.requiredSkills.every((skill) => cg?.skills.includes(skill))).toBe(true);
      }
    }
  });
  it("every ranked caregiver has the payer credential", async () => {
    const cs = await getCaregivers();
    for (const s of await getShifts()) {
      for (const c of (await rankCandidates(s.id)).candidates)
        expect(cs.find((x) => x.id === c.caregiverId)?.credentials).toContain(s.payer);
    }
  });
  it("every ranked caregiver is available for the shift", async () => {
    const cs = await getCaregivers();
    for (const s of await getShifts()) {
      const d = new Date(s.start);
      const day = (d.getDay() + 6) % 7;
      const slot = d.getHours() < 12 ? "morning" : d.getHours() < 17 ? "afternoon" : "evening";
      for (const c of (await rankCandidates(s.id)).candidates)
        expect(
          cs
            .find((x) => x.id === c.caregiverId)
            ?.availability.some((a) => a.day === day && a.slot === slot),
        ).toBe(true);
    }
  });
  it("filtered reasons match an actual failed hard rule", async () => {
    const cs = await getCaregivers();
    for (const s of await getShifts()) {
      const d = new Date(s.start);
      const day = (d.getDay() + 6) % 7;
      const slot = d.getHours() < 12 ? "morning" : d.getHours() < 17 ? "afternoon" : "evening";
      for (const f of (await rankCandidates(s.id)).filteredOut) {
        const cg = cs.find((c) => c.id === f.caregiverId);
        expect(cg).toBeDefined();
        if (f.reason === "Not available")
          expect(cg?.availability.some((a) => a.day === day && a.slot === slot)).toBe(false);
        else if (f.reason.startsWith("Missing skill: "))
          expect(cg?.skills).not.toContain(f.reason.slice(15));
        else expect(cg?.credentials).not.toContain(s.payer);
      }
    }
  });
  it("one at a time sends a fallback only after decline, using ranked caregivers", async () => {
    const rank = await rankCandidates("shift-0");
    const events = await sendOffers("shift-0", "sequential");
    expect(events.map((e) => e.action)).toEqual(["sent", "declined", "sent", "accepted"]);
    expect(events.every((e) => rank.candidates.some((c) => c.name === e.caregiverName))).toBe(true);
    expect((await getPastShifts()).find((s) => s.id === "shift-0")?.minutesToFill).toBe(12);
  });
  it("top 3 sends exactly three offers and records the accepting caregiver", async () => {
    const rank = await rankCandidates("shift-1");
    const events = await sendOffers("shift-1", "top3");
    expect(events.filter((e) => e.action === "sent").map((e) => e.caregiverName)).toEqual(
      rank.candidates.slice(0, 3).map((c) => c.name),
    );
    expect(events.at(-1)?.action).toBe("accepted");
    expect((await getPastShifts()).find((s) => s.id === "shift-1")?.offers).toBe(3);
  });
  it("simulates the requested 500 shifts with bounded rates and positive offer counts", async () => {
    const result = await runSimulation(500);
    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r.fillRate).toBeGreaterThan(0);
      expect(r.fillRate).toBeLessThanOrEqual(100);
      expect(r.offersPerCaregiver.reduce((n, c) => n + c.offers, 0) / 500).toBeCloseTo(
        r.avgOffersPerShift,
        2,
      );
    }
  });
});
