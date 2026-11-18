import type { Caregiver, Shift, PastShift, Payer } from "./types";
const names = [
  "Ana Morales",
  "Luis Herrera",
  "Sophie Jean-Baptiste",
  "Maria Rodriguez",
  "James Wilson",
  "Carmen Diaz",
  "Jean Pierre",
  "Isabella Torres",
  "Robert Miller",
  "Elena Gonzalez",
  "Nadine Joseph",
  "Carlos Perez",
  "Emily Thompson",
  "Rosa Martinez",
  "Marie Laurent",
  "David Anderson",
  "Lucia Fernandez",
  "Michel Francois",
  "Patricia Clark",
  "Miguel Santos",
  "Claudette Louis",
  "Sarah Johnson",
  "Diego Ramirez",
  "Gabriela Cruz",
  "Thomas Brown",
];
const skills = [
  "Personal care",
  "Dementia care",
  "Hoyer lift",
  "Medication reminders",
  "Spanish speaking",
  "Creole speaking",
  "Meal prep",
];
export const clients = [
  "Carmen Alvarez",
  "George Thompson",
  "Rosa Delgado",
  "Joseph Baptiste",
  "Elena Martinez",
  "William Davis",
  "Lucille Jean",
  "Roberto Silva",
];
export const caregivers: Caregiver[] = names.map((name, i) => ({
  id: `cg-${i}`,
  name,
  skills:
    i < 9
      ? [
          "Personal care",
          "Dementia care",
          "Medication reminders",
          i % 2 ? "Spanish speaking" : "Creole speaking",
          "Meal prep",
        ]
      : skills.filter((_, j) => (i + j) % 3 !== 0),
  credentials: i < 9 || i % 3 === 0 ? ["VA", "Medicaid"] : ([i % 2 ? "Medicaid" : "VA"] as Payer[]),
  homeMiles: +(2.1 + i * 0.65).toFixed(1),
  hoursThisWeek: i === 0 ? 28 : i === 1 ? 24 : 18 + ((i * 3) % 22),
  maxWeeklyHours: 40,
  acceptanceRate: i === 0 ? 0.82 : i === 1 ? 0.88 : +(0.58 + ((i * 7) % 35) / 100).toFixed(2),
  offersLast7Days: 2 + (i % 9),
  clientIds: i < 3 ? ["client-0", `client-${i + 1}`] : [`client-${i % 8}`],
  availability: Array.from({ length: 7 }, (_, day) =>
    ["morning", "afternoon", "evening"]
      .filter((_, slot) => i < 9 || (i + day + slot) % 4 !== 0)
      .map((slot) => ({ day, slot: slot as "morning" | "afternoon" | "evening" })),
  ).flat(),
}));
export const shifts: Shift[] = Array.from({ length: 6 }, (_, i) => ({
  id: `shift-${i}`,
  clientId: `client-${i}`,
  clientName: clients[i] ?? "Carmen Alvarez",
  start: `2026-11-${18 + i}T${i % 2 ? "14" : "09"}:00:00`,
  end: `2026-11-${18 + i}T${i % 2 ? "18" : "13"}:00:00`,
  requiredSkills:
    i === 0
      ? ["Personal care", "Dementia care"]
      : i % 2
        ? ["Personal care", "Spanish speaking"]
        : ["Medication reminders", "Meal prep"],
  payer: i % 2 ? "Medicaid" : "VA",
  noticeHours: [6, 10, 18, 24, 36, 48][i] ?? 48,
}));
export const pastShifts: PastShift[] = Array.from({ length: 40 }, (_, i) => ({
  id: `past-${i}`,
  date: `2026-11-${String(17 - Math.floor(i / 3)).padStart(2, "0")}T${String(8 + (i % 10)).padStart(2, "0")}:00:00`,
  clientName: clients[i % 8] ?? "Carmen Alvarez",
  payer: i % 2 ? "Medicaid" : "VA",
  filledBy: names[(i * 3) % 25] ?? "Ana Morales",
  offers: 1 + (i % 4),
  minutesToFill: 5 + ((i * 7) % 56),
  strategy: i % 2 ? "top3" : "sequential",
}));
