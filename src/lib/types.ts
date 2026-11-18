export type Payer = "VA" | "Medicaid";
export interface Caregiver {
  id: string;
  name: string;
  skills: string[];
  credentials: Payer[];
  homeMiles: number;
  hoursThisWeek: number;
  maxWeeklyHours: number;
  acceptanceRate: number;
  offersLast7Days: number;
  clientIds: string[];
  availability: { day: number; slot: "morning" | "afternoon" | "evening" }[];
}
export interface Shift {
  id: string;
  clientId: string;
  clientName: string;
  start: string;
  end: string;
  requiredSkills: string[];
  payer: Payer;
  noticeHours: number;
}
export interface Candidate {
  caregiverId: string;
  name: string;
  score: number;
  rank: number;
  distanceMiles: number;
  hoursThisWeek: number;
  maxWeeklyHours: number;
  servedClientBefore: boolean;
  reasons: string[];
}
export interface FilteredOut {
  caregiverId: string;
  name: string;
  reason: string;
}
export interface RankResult {
  shiftId: string;
  candidates: Candidate[];
  filteredOut: FilteredOut[];
}
export interface OfferEvent {
  minute: number;
  caregiverName: string;
  action: "sent" | "declined" | "accepted" | "no_response";
}
export interface PastShift {
  id: string;
  date: string;
  clientName: string;
  payer: Payer;
  filledBy: string;
  offers: number;
  minutesToFill: number;
  strategy: "sequential" | "top3";
}
export interface SimulationResult {
  strategy: string;
  avgMinutesToFill: number;
  avgOffersPerShift: number;
  fillRate: number;
  offersPerCaregiver: { name: string; offers: number }[];
}
