import type { Slot } from "../types.ts";

export const HOUR = 3_600_000;
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SLOT_BOUNDS: Record<Slot, [number, number]> = {
  morning: [7, 12],
  afternoon: [12, 17],
  evening: [17, 22],
};
export const SLOTS: Slot[] = ["morning", "afternoon", "evening"];

/** Monday = 0 … Sunday = 6 */
export const dayIndex = (d: Date) => (d.getDay() + 6) % 7;

export const slotOf = (d: Date): Slot =>
  d.getHours() < 12 ? "morning" : d.getHours() < 17 ? "afternoon" : "evening";

/** Every (day, slot) a visit touches. A 11:00–15:00 visit needs morning AND afternoon. */
export function slotsCovered(start: Date, end: Date): { day: number; slot: Slot }[] {
  const out: { day: number; slot: Slot }[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += HOUR / 2) {
    const d = new Date(t);
    const h = d.getHours() + d.getMinutes() / 60;
    const slot = SLOTS.find((s) => h >= SLOT_BOUNDS[s][0] && h < SLOT_BOUNDS[s][1]) ?? slotOf(d);
    const day = dayIndex(d);
    if (!out.some((o) => o.day === day && o.slot === slot)) out.push({ day, slot });
  }
  return out;
}

export const isWeekend = (d: Date) => dayIndex(d) >= 5;

export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

/** Local ISO string without timezone (what the UI and inputs use). */
export function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

export function visitTitle(start: Date, needs: string[]): string {
  const part = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" }[slotOf(start)];
  const kind = needs.includes("Dementia care")
    ? "dementia care"
    : needs.includes("Hoyer lift")
      ? "transfer & personal care"
      : needs.includes("Medication reminders")
        ? "medication & meal support"
        : "personal care";
  return `${part} ${kind}`;
}
