/**
 * The only module the UI talks to. Today it runs the matching engine in the browser
 * against an in-memory agency; swapping in a real backend means re-implementing
 * these functions with fetch calls and keeping the same signatures.
 */
import type {
  AgentLogEntry,
  AgentRun,
  AgentState,
  AgentVisit,
  Caregiver,
  Client,
  DispatchState,
  ModelInfo,
  NewCancellation,
  OfferEvent,
  PastShift,
  RankResult,
  Shift,
  SimulationResult,
  Strategy,
} from "./types.ts";
import { createDispatch, runToEnd, stepDispatch, type LiveDispatch } from "./engine/dispatch.ts";
import { FEATURES } from "./engine/features.ts";
import { rankShift } from "./engine/ranking.ts";
import { simulate } from "./engine/simulation.ts";
import { HOUR } from "./engine/time.ts";
import { createWorld, findCaregiver, findClient, makeShift, officeMiles, offersLast7Days, type World } from "./engine/world.ts";

const config: { latencyMs: number; minuteMs: number; clock: () => number } = {
  latencyMs: 180,
  minuteMs: 900,
  clock: () => Date.now(),
};

/** Tests set the delays to 0 and pin the clock so results don't depend on the time of day. */
export function configureEngine(next: Partial<typeof config>) {
  Object.assign(config, next);
}

let world: World | null = null;
const dispatches = new Map<string, LiveDispatch>();
const listeners = new Set<() => void>();
let version = 0;

const getWorld = () => (world ??= createWorld(config.clock()));
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};
const delay = (ms = config.latencyMs) =>
  ms ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

/** Start over with a fresh agency (new "now", same people). */
export function resetDemo(now?: number) {
  dispatches.clear();
  agent.on = false;
  agent.run = null;
  world = createWorld(now ?? config.clock());
  notify();
}

/** Subscribe to any engine change (offers moving, shifts filled, new cancellations). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getVersion = () => version;

export async function getShifts(): Promise<Shift[]> {
  await delay();
  return getWorld().openShifts
    .map((s) => ({ ...s }))
    .sort((a, b) => a.noticeHours - b.noticeHours);
}

export async function getPastShifts(): Promise<PastShift[]> {
  await delay();
  return getWorld().pastShifts.map((s) => ({ ...s }));
}

export async function getClients(): Promise<Client[]> {
  await delay(0);
  return getWorld().clients.map(({ id, name, neighborhood, payer, careNeeds }) => ({ id, name, neighborhood, payer, careNeeds: [...careNeeds] }));
}

export async function getCaregivers(): Promise<Caregiver[]> {
  await delay();
  const w = getWorld();
  return w.caregivers.map((c) => ({
    id: c.seed.id,
    name: c.seed.name,
    neighborhood: c.seed.neighborhood,
    skills: [...c.seed.skills],
    credentials: [...c.seed.credentials],
    homeMiles: officeMiles(c.seed),
    hoursThisWeek: c.hoursThisWeek,
    maxWeeklyHours: c.seed.maxWeeklyHours,
    acceptanceRate: c.stats.offers ? Math.round((c.stats.accepted / c.stats.offers) * 100) / 100 : 0,
    offersLast7Days: offersLast7Days(c, w.now),
    offersTotal: c.stats.offers,
    acceptedTotal: c.stats.accepted,
    isNew: c.seed.tenureWeeks < 3,
    clientIds: [...c.clientIds],
    availability: c.seed.availability.map((a) => ({ ...a })),
  }));
}

function shiftById(shiftId: string): Shift {
  const w = getWorld();
  const shift = w.openShifts.find((s) => s.id === shiftId) ?? dispatches.get(shiftId)?.shift;
  if (!shift) throw new Error("Shift not found");
  return shift;
}

export async function rankCandidates(shiftId: string): Promise<RankResult> {
  await delay();
  const d = dispatches.get(shiftId);
  return rankShift(getWorld(), shiftById(shiftId), d ? { weightScale: d.weightScale, statuses: d.statuses, frozenScores: d.frozenScores } : {});
}

/** Same as rankCandidates but synchronous, for live re-rendering while offers are out. */
export function rankNow(shiftId: string): RankResult | null {
  try {
    const d = dispatches.get(shiftId);
    return rankShift(getWorld(), shiftById(shiftId), d ? { weightScale: d.weightScale, statuses: d.statuses, frozenScores: d.frozenScores } : {});
  } catch {
    return null;
  }
}

export function getDispatch(shiftId: string): DispatchState | null {
  const d = dispatches.get(shiftId);
  return d ? { ...d.state, events: [...d.state.events] } : null;
}

/**
 * Starts sending offers and resolves with the full timeline once the shift is filled
 * (or nobody is left). Progress is published through subscribe() every simulated minute.
 */
export async function sendOffers(shiftId: string, strategy: Strategy): Promise<OfferEvent[]> {
  await delay();
  return startDispatch(shiftId, strategy, config.minuteMs);
}

function startDispatch(shiftId: string, strategy: Strategy, minuteMs: number, idleRatio = 1 / 3): Promise<OfferEvent[]> {
  const w = getWorld();
  const existing = dispatches.get(shiftId);
  if (existing?.state.status === "filled") return Promise.reject(new Error("This shift is already filled"));
  if (existing?.state.status === "running") return Promise.reject(new Error("Offers are already out for this shift"));
  const d = createDispatch(shiftById(shiftId), strategy);
  dispatches.set(shiftId, d);
  if (!minuteMs) {
    while (d.state.status === "running") onDispatchEvents(shiftId, stepDispatch(w, d), d.state.minute);
    notify();
    return Promise.resolve([...d.state.events]);
  }
  return new Promise((resolve) => {
    const tick = () => {
      const events = stepDispatch(w, d);
      onDispatchEvents(shiftId, events, d.state.minute);
      if (events.length) notify();
      if (d.state.status === "running") setTimeout(tick, events.length ? minuteMs : minuteMs * idleRatio);
      else {
        notify();
        resolve([...d.state.events]);
      }
    };
    tick();
  });
}

export async function logCancellation(input: NewCancellation): Promise<Shift> {
  await delay();
  const w = getWorld();
  const client = findClient(w, input.clientId);
  if (!client) throw new Error("Choose a client");
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) throw new Error("Choose a start date and time");
  w.now = Math.max(w.now, config.clock());
  if (start.getTime() <= w.now) throw new Error("The visit must start in the future");
  if (!(input.durationHours >= 1 && input.durationHours <= 12)) throw new Error("Visits are 1 to 12 hours");
  if (!input.requiredSkills.length) throw new Error("Pick at least one required skill");
  const by = input.cancelledBy ? findCaregiver(w, input.cancelledBy) : undefined;
  const shift = makeShift(w, client, start, input.durationHours, [...input.requiredSkills], by?.seed.id ?? null);
  if (by)
    w.bookings = w.bookings.filter(
      (b) => !(b.caregiverId === by.seed.id && b.start < start.getTime() + input.durationHours * HOUR && start.getTime() < b.end),
    );
  w.openShifts.push(shift);
  agentNoticeNewShift(shift);
  notify();
  return { ...shift };
}

export async function runSimulation(numShifts: number): Promise<SimulationResult[]> {
  if (!Number.isInteger(numShifts) || numShifts < 1 || numShifts > 10000)
    throw new Error("Choose between 1 and 10,000 shifts");
  await delay();
  return simulate(getWorld(), numShifts);
}

export async function getModelInfo(): Promise<ModelInfo> {
  await delay(0);
  const m = getWorld().model;
  return {
    trainingOffers: m.trainingOffers,
    holdoutOffers: m.holdoutOffers,
    holdoutAccuracy: Math.round(m.holdoutAccuracy * 1000) / 1000,
    holdoutAuc: Math.round(m.holdoutAuc * 1000) / 1000,
    baseAcceptRate: Math.round(m.baseAcceptRate * 1000) / 1000,
    onlineUpdates: m.onlineUpdates,
    features: FEATURES.map((f, i) => ({ ...f, weight: Math.round((m.weights[i] ?? 0) * 100) / 100 })),
  };
}

export interface TodayStats {
  open: number;
  urgent: number;
  offersOut: number;
  filledToday: number;
  avgMinutesToFill: number | null;
}

/** Live numbers for the top bar. Synchronous so it can re-render on every engine change. */
export function statsNow(): TodayStats {
  const w = getWorld();
  const filled = w.pastShifts.filter((p) => p.id.startsWith("shift-"));
  return {
    open: w.openShifts.length,
    urgent: w.openShifts.filter((s) => s.noticeHours < 12).length,
    offersOut: [...dispatches.values()].filter((d) => d.state.status === "running").length,
    filledToday: filled.length,
    avgMinutesToFill: filled.length
      ? Math.round(filled.reduce((n, p) => n + p.minutesToFill, 0) / filled.length)
      : null,
  };
}


/* ============================== Agent mode ==============================
 * The agent takes over the coordinator's loop: it works through every open visit,
 * most urgent first, up to three at a time. For each one it picks a strategy and says
 * why, runs the live dispatch, and escalates anything it can't cover. While it's on,
 * new cancellations are picked up automatically.
 */
const AGENT_CONCURRENCY = 3;
const agent: AgentState & { hoursBefore: Map<string, number>; startedMs: number; logId: number; done: (() => void)[] } = {
  on: false,
  run: null,
  hoursBefore: new Map(),
  startedMs: 0,
  logId: 0,
  done: [],
};
const agentMinuteMs = () => Math.round(config.minuteMs * 1.4);
const AGENT_IDLE_RATIO = 0.6;
/** Simulated minute each visit was launched at, so the agent's clock follows the dispatches. */
const launchedAt = new Map<string, number>();

const hoursLabel = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`);

function agentMinute(): number {
  const run = agent.run;
  if (!run) return 0;
  return Math.max(
    0,
    ...run.visits.map((v) => (launchedAt.get(v.shiftId) ?? 0) + (v.minutes ?? getDispatch(v.shiftId)?.minute ?? 0)),
  );
}

function agentLog(kind: AgentLogEntry["kind"], text: string, visit?: AgentVisit) {
  const run = agent.run;
  if (!run) return;
  run.log.push({ id: ++agent.logId, minute: agentMinute(), shiftId: visit?.shiftId ?? null, clientName: visit?.clientName ?? null, kind, text });
  if (run.log.length > 400) run.log.splice(0, run.log.length - 400);
}

function chooseStrategy(noticeHours: number, qualified: number): { strategy: Strategy; why: string } {
  if (qualified <= 1) return { strategy: "sequential", why: "Only one person qualifies, so a single text." };
  if (noticeHours < 12)
    return { strategy: "top3", why: `${hoursLabel(noticeHours)} notice: texting the top 3 at once is faster than waiting on one at a time.` };
  return { strategy: "sequential", why: `${hoursLabel(noticeHours)} notice: one at a time is fast enough and doesn't bother people who won't be needed.` };
}

function visitFor(shift: Shift): AgentVisit {
  return {
    shiftId: shift.id,
    clientName: shift.clientName,
    title: shift.title,
    start: shift.start,
    end: shift.end,
    noticeHours: shift.noticeHours,
    qualified: 0,
    strategy: null,
    why: "",
    status: "queued",
    filledBy: null,
    minutes: null,
    offers: 0,
    declines: 0,
    escalation: null,
  };
}

/** Mirror dispatch events into the agent's log, in plain words. */
function onDispatchEvents(shiftId: string, events: OfferEvent[], _minute: number) {
  const v = agent.run?.visits.find((x) => x.shiftId === shiftId && x.status === "running");
  if (!v) return;
  const first = (n: string) => n.split(" ")[0] ?? n;
  for (const e of events) {
    if (e.action === "sent") {
      v.offers++;
      agentLog("sent", `Texted ${e.caregiverName} (${e.detail ?? ""})`, v);
    } else if (e.action === "declined") {
      v.declines++;
      agentLog("declined", `${first(e.caregiverName)} declined ${e.detail ?? ""}`, v);
    } else if (e.action === "no_response") {
      v.declines++;
      agentLog("no_response", `${first(e.caregiverName)} didn't reply, moving on`, v);
    } else if (e.action === "reranked") agentLog("reranked", `Re-ranked: ${e.detail ?? ""}`, v);
    else if (e.action === "accepted") agentLog("accepted", `${e.caregiverName} accepted · ${e.detail ?? ""}`, v);
  }
}

/** Returns true if offers went out (false = escalated straight away). */
function launch(v: AgentVisit): boolean {
  const ranking = rankNow(v.shiftId);
  v.qualified = ranking?.candidates.filter((c) => c.status === "ready").length ?? 0;
  if (!ranking || v.qualified === 0) {
    v.status = "escalated";
    v.escalation = ranking?.filteredOut.length
      ? `Nobody passes the rules (${ranking.filteredOut.length} filtered out). Needs a coordinator.`
      : "Nobody available. Needs a coordinator.";
    agentLog("escalated", `Can't cover ${v.clientName}: ${v.escalation}`, v);
    return false;
  }
  const plan = chooseStrategy(v.noticeHours, v.qualified);
  v.strategy = plan.strategy;
  v.why = plan.why;
  v.status = "running";
  launchedAt.set(v.shiftId, agentMinute());
  agentLog("plan", `${v.qualified} qualified. ${plan.why}`, v);
  startDispatch(v.shiftId, plan.strategy, agentMinuteMs(), AGENT_IDLE_RATIO)
    .then(() => {
      const st = getDispatch(v.shiftId);
      v.minutes = st?.minute ?? null;
      if (st?.status === "filled") {
        v.status = "filled";
        v.filledBy = st.filledBy;
      } else {
        v.status = "escalated";
        v.escalation = `Asked all ${v.offers} qualified caregivers and nobody accepted. Call the on-call supervisor.`;
        agentLog("escalated", `${v.clientName} needs you: ${v.escalation}`, v);
      }
    })
    .catch((e: unknown) => {
      v.status = "escalated";
      v.escalation = e instanceof Error ? e.message : "Dispatch failed";
      agentLog("escalated", `${v.clientName}: ${v.escalation}`, v);
    })
    .finally(() => {
      pump();
      notify();
    });
  return true;
}

function pump() {
  const run = agent.run;
  if (!run || run.status === "done") return;
  let active = run.visits.filter((v) => v.status === "running").length;
  if (agent.on) {
    for (const v of run.visits) {
      if (active >= AGENT_CONCURRENCY) break;
      if (v.status !== "queued") continue;
      if (launch(v)) active++;
      // Live: take on one visit per beat so the coordinator can follow each decision.
      if (agentMinuteMs() && run.visits.some((x) => x.status === "queued") && active < AGENT_CONCURRENCY) {
        setTimeout(() => {
          pump();
          notify();
        }, agentMinuteMs() * 1.5);
        break;
      }
    }
  } else {
    for (const v of run.visits) if (v.status === "queued") v.status = "skipped";
  }
  if (!run.visits.some((v) => v.status === "running" || v.status === "queued")) finishRun();
}

function finishRun() {
  const run = agent.run;
  if (!run) return;
  const w = getWorld();
  run.status = "done";
  run.finishedAt = new Date().toISOString();
  run.elapsedMinutes = agentMinute();
  run.changes = w.caregivers
    .filter((c) => c.hoursThisWeek !== (agent.hoursBefore.get(c.seed.id) ?? c.hoursThisWeek))
    .map((c) => ({
      caregiverName: c.seed.name,
      hoursBefore: agent.hoursBefore.get(c.seed.id) ?? c.hoursThisWeek,
      hoursAfter: c.hoursThisWeek,
      maxWeeklyHours: c.seed.maxWeeklyHours,
      visits: run.visits.filter((v) => v.filledBy === c.seed.name).map((v) => v.clientName),
    }));
  const counts = new Map<string, number>();
  for (const v of run.visits) for (const e of getDispatch(v.shiftId)?.events ?? []) if (e.action === "sent") counts.set(e.caregiverName, (counts.get(e.caregiverName) ?? 0) + 1);
  run.offersPerCaregiver = [...counts.entries()].map(([name, offers]) => ({ name, offers })).sort((a, b) => b.offers - a.offers);
  const filled = run.visits.filter((v) => v.status === "filled").length;
  agentLog("done", `Done: covered ${filled} of ${run.visits.length} visits in ${run.elapsedMinutes} min.`);
  agent.done.splice(0).forEach((f) => f());
}

function startRun(shifts: Shift[]) {
  const w = getWorld();
  agent.hoursBefore = new Map(w.caregivers.map((c) => [c.seed.id, c.hoursThisWeek]));
  agent.startedMs = Date.now();
  launchedAt.clear();
  agent.run = {
    id: (agent.run?.id ?? 0) + 1,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    elapsedMinutes: 0,
    visits: [...shifts].sort((a, b) => a.noticeHours - b.noticeHours).map(visitFor),
    log: [],
    changes: [],
    offersPerCaregiver: [],
  };
  agentLog("info", `Agent on: ${shifts.length} open visit${shifts.length === 1 ? "" : "s"}, most urgent first, up to ${AGENT_CONCURRENCY} at a time.`);
  pump();
}

function agentNoticeNewShift(shift: Shift) {
  if (!agent.on) return;
  if (agent.run && agent.run.status !== "done") {
    agent.run.visits.push(visitFor(shift));
    agentLog("info", `New cancellation picked up: ${shift.clientName}.`);
    pump();
  } else startRun([shift]);
}

/** Turn Agent mode on (works through every open visit) or off (finishes what's in flight, starts nothing new). */
export function setAgentMode(on: boolean) {
  agent.on = on;
  const w = getWorld();
  if (on) {
    const busy = new Set([...dispatches.values()].filter((d) => d.state.status === "running").map((d) => d.shift.id));
    const todo = w.openShifts.filter((s) => !busy.has(s.id) && dispatches.get(s.id)?.state.status !== "unfilled");
    if (agent.run?.status === "running" || agent.run?.status === "stopping") {
      agent.run.status = "running";
      pump();
    } else startRun(todo);
  } else if (agent.run && agent.run.status === "running") {
    agent.run.status = "stopping";
    agentLog("info", "Agent off: finishing offers already out, starting nothing new.");
    pump();
  }
  notify();
}

/** Resolves when the current agent run is done (used by tests). */
export function agentFinished(): Promise<void> {
  if (!agent.run || agent.run.status === "done") return Promise.resolve();
  return new Promise((resolve) => agent.done.push(resolve));
}

export function getAgent(): AgentState {
  const run = agent.run;
  if (run && run.status !== "done") run.elapsedMinutes = agentMinute();
  return {
    on: agent.on,
    run: run ? structuredClone(run) : null,
  };
}
