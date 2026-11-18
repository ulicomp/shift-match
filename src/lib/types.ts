export type Payer = "VA" | "Medicaid";
export type Slot = "morning" | "afternoon" | "evening";
export type Strategy = "sequential" | "top3";

export interface Client {
  id: string;
  name: string;
  neighborhood: string;
  payer: Payer;
  careNeeds: string[];
}

export interface Caregiver {
  id: string;
  name: string;
  neighborhood: string;
  skills: string[];
  credentials: Payer[];
  homeMiles: number; // driving miles from the agency office
  hoursThisWeek: number;
  maxWeeklyHours: number;
  acceptanceRate: number; // raw share of offers accepted (last 6 weeks)
  offersLast7Days: number;
  offersTotal: number;
  acceptedTotal: number;
  isNew: boolean;
  clientIds: string[];
  availability: { day: number; slot: Slot }[];
}

export interface Shift {
  id: string;
  clientId: string;
  clientName: string;
  neighborhood: string;
  title: string;
  start: string;
  end: string;
  durationHours: number;
  requiredSkills: string[];
  payer: Payer;
  noticeHours: number;
  cancelledBy: string | null;
  cancelledByName: string | null;
}

export type CandidateStatus = "ready" | "offered" | "declined" | "no_response" | "accepted" | "withdrawn";

export interface Candidate {
  caregiverId: string;
  name: string;
  score: number; // model's predicted probability of accepting (0–1)
  rankScore: number; // score minus fairness penalty — what the list is sorted by
  fairnessPenalty: number;
  rank: number; // 0 when no longer in line (declined / no response)
  distanceMiles: number;
  hoursThisWeek: number;
  maxWeeklyHours: number;
  servedClientBefore: boolean;
  isNew: boolean;
  status: CandidateStatus;
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

export type OfferAction = "sent" | "declined" | "accepted" | "no_response" | "withdrawn" | "reranked";

export interface OfferEvent {
  minute: number;
  caregiverName: string;
  action: OfferAction;
  detail?: string;
}

export type DispatchStatus = "running" | "filled" | "unfilled";

export interface DispatchState {
  shiftId: string;
  strategy: Strategy;
  status: DispatchStatus;
  minute: number;
  events: OfferEvent[];
  filledBy: string | null;
}

export interface PastShift {
  id: string;
  date: string;
  clientName: string;
  payer: Payer;
  filledBy: string;
  offers: number;
  minutesToFill: number;
  strategy: Strategy;
}

export interface SimulationResult {
  strategy: string;
  avgMinutesToFill: number;
  avgOffersPerShift: number;
  fillRate: number;
  offersPerCaregiver: { name: string; offers: number }[];
}

export interface NewCancellation {
  clientId: string;
  start: string; // ISO local date-time
  durationHours: number;
  requiredSkills: string[];
  cancelledBy: string | null;
}

export interface ModelFeatureInfo {
  key: string;
  label: string;
  weight: number;
  description: string;
}

export interface ModelInfo {
  trainingOffers: number;
  holdoutOffers: number;
  holdoutAccuracy: number;
  holdoutAuc: number;
  baseAcceptRate: number;
  onlineUpdates: number;
  features: ModelFeatureInfo[];
}
