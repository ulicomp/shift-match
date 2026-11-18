/**
 * Seed data for the prototype: a Miami home care agency with 8 clients and 25 caregivers.
 * Coordinates are real neighborhood centers so distances are believable driving miles.
 * Everything else (offer history, open shifts, filled shifts) is generated from this in
 * engine/world.ts so the numbers on every screen agree with each other.
 */
import type { Payer, Slot } from "./types.ts";

export const SKILLS = [
  "Personal care",
  "Dementia care",
  "Hoyer lift",
  "Medication reminders",
  "Spanish speaking",
  "Creole speaking",
  "Meal prep",
] as const;

export const AGENCY_OFFICE = { name: "Agency office · Coral Way", lat: 25.7505, lng: -80.2589 };

export interface ClientSeed {
  id: string;
  name: string;
  neighborhood: string;
  lat: number;
  lng: number;
  payer: Payer;
  careNeeds: string[];
  /** Typical visit hours used when generating cancellations for this client. */
  visitStarts: number[];
  visitHours: number;
}

export const CLIENTS: ClientSeed[] = [
  { id: "client-0", name: "Carmen Alvarez", neighborhood: "Little Havana", lat: 25.7743, lng: -80.2196, payer: "VA", careNeeds: ["Dementia care", "Spanish speaking"], visitStarts: [8, 13], visitHours: 4 },
  { id: "client-1", name: "George Thompson", neighborhood: "Coral Gables", lat: 25.7215, lng: -80.2684, payer: "Medicaid", careNeeds: ["Personal care", "Hoyer lift"], visitStarts: [9, 14], visitHours: 3 },
  { id: "client-2", name: "Rosa Delgado", neighborhood: "Hialeah", lat: 25.8576, lng: -80.2781, payer: "Medicaid", careNeeds: ["Personal care", "Spanish speaking"], visitStarts: [8, 12, 17], visitHours: 4 },
  { id: "client-3", name: "Joseph Baptiste", neighborhood: "North Miami", lat: 25.8901, lng: -80.1867, payer: "VA", careNeeds: ["Medication reminders", "Creole speaking"], visitStarts: [9, 17], visitHours: 3 },
  { id: "client-4", name: "Elena Martinez", neighborhood: "Kendall", lat: 25.6793, lng: -80.3173, payer: "Medicaid", careNeeds: ["Dementia care", "Spanish speaking"], visitStarts: [8, 13], visitHours: 5 },
  { id: "client-5", name: "William Davis", neighborhood: "Pinecrest", lat: 25.6671, lng: -80.3081, payer: "VA", careNeeds: ["Personal care", "Hoyer lift"], visitStarts: [8, 14], visitHours: 4 },
  { id: "client-6", name: "Lucille Jean", neighborhood: "Little Haiti", lat: 25.8297, lng: -80.1953, payer: "Medicaid", careNeeds: ["Personal care", "Creole speaking"], visitStarts: [10, 17], visitHours: 4 },
  { id: "client-7", name: "Roberto Silva", neighborhood: "Doral", lat: 25.8195, lng: -80.3553, payer: "VA", careNeeds: ["Medication reminders", "Spanish speaking"], visitStarts: [9, 13, 18], visitHours: 3 },
];

type Pattern = "weekday-days" | "all-days" | "mornings" | "evenings" | "weekends" | "flex" | "mwf" | "tth";

const PATTERNS: Record<Pattern, (day: number, slot: Slot) => boolean> = {
  "weekday-days": (d, s) => d < 5 && (s !== "evening" || d === 1 || d === 3),
  "all-days": (d, s) => s !== "evening" || d <= 3,
  mornings: (_d, s) => s === "morning",
  evenings: (_d, s) => s !== "morning",
  weekends: (d) => d >= 4,
  flex: (d, s) => d < 5 || (d === 5 && s !== "evening"),
  mwf: (d) => d === 0 || d === 2 || d === 4,
  tth: (d) => d === 1 || d === 3 || d === 5,
};

const SKILL_CODES: Record<string, string> = {
  P: "Personal care",
  D: "Dementia care",
  H: "Hoyer lift",
  M: "Medication reminders",
  S: "Spanish speaking",
  C: "Creole speaking",
  F: "Meal prep",
};

/**
 * Hidden "true behavior" of each person. The model never sees these numbers;
 * it has to learn them from yes/no answers. willingness is a logit offset.
 */
export interface Temperament {
  willingness: number;
  prefers: Slot;
  distanceTolerance: number; // 1 = average, >1 happier to drive
  responsiveness: number; // chance they answer an offer at all
}

export interface CaregiverSeed {
  id: string;
  name: string;
  neighborhood: string;
  lat: number;
  lng: number;
  skills: string[];
  credentials: Payer[];
  availability: { day: number; slot: Slot }[];
  maxWeeklyHours: number;
  hoursThisWeek: number;
  /** Weeks with the agency. Under 3 weeks = "new", little or no offer history. */
  tenureWeeks: number;
  regularClients: string[];
  temperament: Temperament;
}

// name | neighborhood | lat | lng | skills | credentials | pattern | max h | hours this week | tenure wks | regular clients | willingness | prefers | distance tol | responsiveness
type Row = [string, string, number, number, string, string, Pattern, number, number, number, string, number, Slot, number, number];

const ROWS: Row[] = [
  ["Ana Morales", "Westchester", 25.7548, -80.327, "PDMSF", "VA,Medicaid", "all-days", 40, 28, 140, "0,4", 1.2, "morning", 1.2, 0.97],
  ["Luis Herrera", "Flagami", 25.7621, -80.3165, "PDSM", "VA,Medicaid", "flex", 40, 24, 96, "0,7", 1.0, "afternoon", 1.1, 0.95],
  ["Sophie Jean-Baptiste", "Little Haiti", 25.8297, -80.1953, "PMCF", "VA,Medicaid", "weekday-days", 40, 32, 60, "6", 0.6, "morning", 0.9, 0.92],
  ["Maria Rodriguez", "Hialeah", 25.8576, -80.2781, "PSFDM", "Medicaid", "all-days", 40, 30, 210, "2", 0.9, "morning", 1.0, 0.95],
  ["James Wilson", "Coral Gables", 25.7215, -80.2684, "PHM", "VA,Medicaid", "weekday-days", 40, 36, 80, "1,5", 0.4, "afternoon", 0.8, 0.9],
  ["Carmen Diaz", "Kendall", 25.6793, -80.3173, "PDSM", "VA,Medicaid", "mornings", 30, 18, 52, "4", 0.7, "morning", 1.0, 0.93],
  ["Jean Pierre", "North Miami", 25.8901, -80.1867, "PHCM", "VA,Medicaid", "evenings", 40, 22, 120, "3", 0.8, "evening", 1.3, 0.9],
  ["Isabella Torres", "Sweetwater", 25.7631, -80.3731, "PSFM", "Medicaid", "weekends", 32, 12, 30, "7", 0.3, "afternoon", 0.9, 0.85],
  ["Robert Miller", "Pinecrest", 25.6671, -80.3081, "PHD", "VA", "weekday-days", 40, 20, 160, "5", 0.5, "morning", 0.7, 0.9],
  ["Elena Gonzalez", "Doral", 25.8195, -80.3553, "PDSMF", "VA,Medicaid", "flex", 40, 33, 75, "7,2", 0.6, "afternoon", 1.1, 0.93],
  ["Nadine Joseph", "Miami Gardens", 25.942, -80.2456, "PCFM", "VA,Medicaid", "all-days", 40, 26, 44, "6,3", 0.5, "morning", 1.4, 0.88],
  ["Carlos Perez", "Allapattah", 25.815, -80.2238, "PHSM", "Medicaid", "evenings", 40, 29, 66, "1", -0.2, "evening", 1.0, 0.8],
  ["Emily Thompson", "South Miami", 25.7079, -80.2939, "PDMF", "VA,Medicaid", "mwf", 24, 16, 38, "5", 0.2, "morning", 0.8, 0.9],
  ["Rosa Martinez", "Little Havana", 25.7743, -80.2196, "PSFM", "VA,Medicaid", "all-days", 40, 38, 300, "0,2", 1.1, "morning", 0.9, 0.96],
  ["Marie Laurent", "North Miami Beach", 25.9331, -80.1625, "PCD", "VA,Medicaid", "tth", 32, 14, 90, "3,6", 0.4, "afternoon", 1.0, 0.9],
  ["David Anderson", "Cutler Bay", 25.5808, -80.3468, "PHM", "VA", "all-days", 40, 19, 58, "5", 0.3, "afternoon", 1.5, 0.87],
  ["Lucia Fernandez", "Kendall West", 25.667, -80.419, "PDSFM", "VA,Medicaid", "weekday-days", 40, 27, 110, "4", 0.7, "morning", 0.8, 0.92],
  ["Michel Francois", "Liberty City", 25.8326, -80.2412, "PCHM", "Medicaid", "flex", 40, 31, 48, "6", -0.1, "evening", 1.1, 0.82],
  ["Patricia Clark", "Palmetto Bay", 25.6218, -80.3248, "PMFD", "VA", "mornings", 30, 22, 130, "5", 0.5, "morning", 0.9, 0.93],
  ["Miguel Santos", "Fontainebleau", 25.7737, -80.3473, "PSHM", "Medicaid", "all-days", 40, 35, 70, "7,1", 0.2, "afternoon", 1.0, 0.86],
  ["Claudette Louis", "Little Haiti", 25.8297, -80.1953, "PCMF", "VA,Medicaid", "weekday-days", 40, 21, 85, "6,3", 0.9, "morning", 1.0, 0.94],
  ["Sarah Johnson", "Brickell", 25.7617, -80.1918, "PDMS", "VA,Medicaid", "evenings", 40, 17, 64, "0", 0.0, "evening", 0.9, 0.84],
  ["Diego Ramirez", "Homestead", 25.4687, -80.4776, "PSHD", "VA,Medicaid", "all-days", 40, 24, 100, "4", 0.8, "morning", 1.6, 0.9],
  ["Gabriela Cruz", "Miami Lakes", 25.9087, -80.3087, "PDSM", "VA,Medicaid", "flex", 40, 8, 2, "", 0.9, "morning", 1.1, 0.95],
  ["Thomas Brown", "Overtown", 25.7867, -80.2014, "PMFH", "Medicaid", "weekday-days", 40, 6, 1, "", 0.3, "afternoon", 1.0, 0.9],
];

export const CAREGIVERS: CaregiverSeed[] = ROWS.map((r, i) => {
  const [name, neighborhood, lat, lng, skills, creds, pattern, max, hours, tenure, regular, willingness, prefers, tol, resp] = r;
  const availability: { day: number; slot: Slot }[] = [];
  for (let day = 0; day < 7; day++)
    for (const slot of ["morning", "afternoon", "evening"] as Slot[])
      if (PATTERNS[pattern](day, slot)) availability.push({ day, slot });
  return {
    id: `cg-${i}`,
    name,
    neighborhood,
    lat,
    lng,
    skills: [...skills].map((c) => SKILL_CODES[c] ?? c),
    credentials: creds.split(",") as Payer[],
    availability,
    maxWeeklyHours: max,
    hoursThisWeek: hours,
    tenureWeeks: tenure,
    regularClients: regular ? regular.split(",").map((n) => `client-${n}`) : [],
    temperament: { willingness, prefers, distanceTolerance: tol, responsiveness: resp },
  };
});
