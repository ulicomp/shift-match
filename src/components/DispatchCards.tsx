import type { ReactNode } from "react";
import { Check, RotateCcw, Send, Users, UserX } from "lucide-react";
import type { Candidate, DispatchState, OfferEvent, RankResult, Shift, Strategy } from "@/lib/types";
import { Button } from "./ui/button";
import { Badge, InitialsAvatar, ReasonChip, ScoreBar, isWarningReason, isFairnessReason, noticeLabel, time } from "./shared";

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};
const when = (s: Shift) => `${dayLabel(s.start)} ${time(s.start)} – ${time(s.end)}`;
const firstName = (name: string | null | undefined) => {
  if (!name) return "";
  const [f, l] = name.split(" ");
  return l ? `${f} ${l[0]}.` : (f ?? "");
};

export function ColHead({
  step,
  title,
  hint,
  extra,
  action,
}: {
  step: number;
  title: string;
  hint: ReactNode;
  extra?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="col-head">
      <span className="step-dot">{step}</span>
      <div className="step-text">
        <h2>
          {title}
          {extra}
        </h2>
        <p>{hint}</p>
      </div>
      {action}
    </header>
  );
}

export function ShiftCard({
  shift,
  selected,
  onSelect,
  dispatch,
}: {
  shift: Shift;
  selected: boolean;
  onSelect: () => void;
  dispatch: DispatchState | null;
}) {
  const status = dispatch?.status;
  return (
    <Button variant="shift" size="card" aria-pressed={selected} onClick={onSelect}>
      <div className="shift-top">
        <InitialsAvatar name={shift.clientName} />
        <span className="client-name">{shift.clientName}</span>
      </div>
      <h3>{shift.title}</h3>
      <p className="date">
        {when(shift)} · {shift.neighborhood}
      </p>
      <div className="shift-bottom">
        {status === "filled" ? (
          <Badge tone="green">
            <Check size={11} /> Filled by {firstName(dispatch?.filledBy)}
          </Badge>
        ) : status === "running" ? (
          <Badge tone="green">
            <span className="live-dot" /> Offers out
          </Badge>
        ) : status === "unfilled" ? (
          <Badge tone="urgent">Nobody accepted</Badge>
        ) : (
          <Badge tone={shift.noticeHours < 12 ? "urgent" : "gray"}>{noticeLabel(shift.noticeHours)} notice</Badge>
        )}
        {shift.cancelledByName && (
          <span className="cancelled-by">
            <UserX /> {firstName(shift.cancelledByName)} cancelled
          </span>
        )}
      </div>
    </Button>
  );
}

const STATUS_BADGE: Record<Candidate["status"], { label: string; tone: "gray" | "green" } | null> = {
  ready: null,
  offered: { label: "Offer out", tone: "green" },
  declined: { label: "Declined", tone: "gray" },
  no_response: { label: "No reply", tone: "gray" },
  accepted: { label: "Accepted", tone: "green" },
  withdrawn: { label: "Withdrawn", tone: "gray" },
};

/** Two chips at most: the best reason, plus a warning if there is one. */
function pickReasons(reasons: string[]) {
  // The fairness chip explains why a lower % sits above this person, so it always shows.
  const fairness = reasons.find(isFairnessReason);
  if (fairness) return [reasons.find((r) => r !== fairness && !isWarningReason(r)) ?? null, fairness].filter((r): r is string => !!r);
  const flags = reasons.filter((r) => isWarningReason(r) || r.startsWith("New") || r.startsWith("Little history"));
  const good = reasons.filter((r) => !flags.includes(r));
  return [...good.slice(0, flags.length ? 1 : 2), ...flags.slice(0, 1)];
}

export function CandidateRow({ candidate, best }: { candidate: Candidate; best: boolean }) {
  const badge = STATUS_BADGE[candidate.status];
  const done = candidate.rank === 0;
  return (
    <div className={`candidate ${best ? "best" : ""} ${done ? "done" : ""} status-${candidate.status}`}>
      <div className="candidate-top">
        <span className="rank-num">{done ? "–" : candidate.rank}</span>
        <InitialsAvatar name={candidate.name} />
        <div className="candidate-name">
          <h3>
            {candidate.name}
            {badge && (
              <Badge tone={badge.tone}>
                {candidate.status === "offered" && <span className="live-dot" />}
                {badge.label}
              </Badge>
            )}
          </h3>
          <p className="candidate-meta">
            {candidate.distanceMiles} mi · {candidate.hoursThisWeek}/{candidate.maxWeeklyHours} h this week
          </p>
        </div>
        <span className="score" title="Predicted chance they accept">
          {Math.round(candidate.score * 100)}
          <small>%</small>
        </span>
      </div>
      <ScoreBar value={candidate.score} />
      {!done && (
        <div className="reason-chips">
          {pickReasons(candidate.reasons).map((r) => (
            <ReasonChip key={r} reason={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export function RankedCandidates({ shift, rank }: { shift: Shift; rank: RankResult }) {
  const inLine = rank.candidates.filter((c) => c.rank > 0);
  const asked = rank.candidates.filter((c) => c.rank === 0);
  return (
    <section className="panel ranked-panel" data-elastic>
      <div className="client-row">
        <div className="hero-avatar">
          <InitialsAvatar name={shift.clientName} />
          <span className="payer-dot" title={`${shift.payer} payer`}>
            {shift.payer[0]}
          </span>
        </div>
        <div className="client-row-text">
          <h2>{shift.clientName}</h2>
          <p>
            Needs {shift.requiredSkills.join(" + ")} · {when(shift)} · {shift.neighborhood}
          </p>
        </div>
      </div>
      {rank.candidates.length === 0 && (
        <div className="inner-tile empty-tile">
          <Users size={22} />
          <p>Nobody passes the rules for this visit. Open “Filtered out” below to see why.</p>
        </div>
      )}
      <div className="candidate-list" id="candidate-list">
        {inLine.slice(0, 5).map((c, i) => (
          <CandidateRow key={c.caregiverId} candidate={c} best={i === 0} />
        ))}
      </div>
      {inLine.length > 5 && (
        <details className="filtered">
          <summary>
            {inLine.length - 5} more candidate{inLine.length - 5 === 1 ? "" : "s"}
          </summary>
          <div className="candidate-list">
            {inLine.slice(5).map((c) => (
              <CandidateRow key={c.caregiverId} candidate={c} best={false} />
            ))}
          </div>
        </details>
      )}
      {asked.length > 0 && (
        <details className="filtered" open>
          <summary>Already asked ({asked.length})</summary>
          <div className="candidate-list">
            {asked.map((c) => (
              <CandidateRow key={c.caregiverId} candidate={c} best={false} />
            ))}
          </div>
        </details>
      )}
      <details className="filtered">
        <summary>Filtered out ({rank.filteredOut.length})</summary>
        {rank.filteredOut.map((c) => (
          <div className="filtered-item" key={c.caregiverId}>
            <InitialsAvatar name={c.name} small />
            <span>{c.name}</span>
            <Badge>{c.reason}</Badge>
          </div>
        ))}
      </details>
    </section>
  );
}

const STRATEGIES: { value: Strategy; label: string; explain: string }[] = [
  { value: "sequential", label: "One at a time", explain: "Texts the best match first. If they say no, the next one gets it." },
  { value: "top3", label: "Top 3 at once", explain: "Texts the top 3 together. First yes wins, the next in line backfills." },
];

const ACTION_BADGE: Partial<Record<OfferEvent["action"], { label: string; tone: "gray" | "green" }>> = {
  declined: { label: "Declined", tone: "gray" },
  no_response: { label: "No reply", tone: "gray" },
  accepted: { label: "Accepted", tone: "green" },
  withdrawn: { label: "Withdrawn", tone: "gray" },
};

function TimelineItem({ e }: { e: OfferEvent }) {
  const badge = ACTION_BADGE[e.action];
  return (
    <div className={`timeline-item action-${e.action}`}>
      <span className="minute">{e.minute}m</span>
      {e.action === "reranked" ? (
        <span className="rerank-icon">
          <RotateCcw size={12} />
        </span>
      ) : (
        <InitialsAvatar name={e.caregiverName} small />
      )}
      <p>
        {e.action === "sent" ? `Texted ${e.caregiverName}` : e.action === "reranked" ? "List re-ranked" : e.caregiverName}
        {e.detail && <small>{e.detail}</small>}
      </p>
      {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
    </div>
  );
}

export function OfferWidgets({
  rank,
  strategy,
  onStrategy,
  onSend,
  dispatch,
}: {
  rank: RankResult;
  strategy: Strategy;
  onStrategy: (s: Strategy) => void;
  onSend: () => void;
  dispatch: DispatchState | null;
}) {
  const status = dispatch?.status;
  const running = status === "running";
  const filled = status === "filled";
  const events = dispatch?.events ?? [];
  const offers = events.filter((e) => e.action === "sent").length;
  const canSend = !running && !filled && rank.candidates.some((c) => c.status === "ready");
  const chosen = STRATEGIES.find((s) => s.value === strategy) ?? STRATEGIES[0];
  return (
    <aside className="widget-column" data-elastic>
      <section className="panel send-panel">
        <div className="segmented" role="radiogroup" aria-label="How to send offers">
          <span
            className="segmented-thumb"
            aria-hidden="true"
            style={{ transform: `translateX(${strategy === "top3" ? "100%" : "0"})` }}
          />
          {STRATEGIES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={strategy === s.value}
              disabled={running || filled}
              onClick={() => onStrategy(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="strategy-explain">{chosen?.explain}</p>
        <Button className="w-full" onClick={onSend} disabled={!canSend}>
          {filled ? <Check /> : <Send />}
          {filled
            ? "Shift filled"
            : running
              ? `Offers out · ${dispatch?.minute ?? 0} min`
              : status === "unfilled"
                ? "Everyone qualified was asked"
                : rank.candidates.length === 0
                  ? "No one qualifies"
                  : "Send offers"}
        </Button>
      </section>
      <section className="panel replies-panel">
        <div className="replies-head">
          <h3>Replies</h3>
          {running && (
            <span className="live-label">
              <span className="live-dot" /> Live
            </span>
          )}
        </div>
        <div className="timeline" aria-live="polite">
          {events.length === 0 ? (
            <p className="replies-empty">Replies show up here as caregivers answer.</p>
          ) : (
            events.map((e, i) => <TimelineItem key={`${i}-${e.action}-${e.caregiverName}`} e={e} />)
          )}
          {filled && dispatch && (
            <div className="filled-tile" ref={(el) => el?.scrollIntoView({ behavior: "smooth", block: "nearest" })}>
              <span className="big-number">
                {dispatch.minute} <span className="text-2xl">min</span>
              </span>
              <p>
                Filled by <strong>{dispatch.filledBy}</strong> · {offers} offer{offers === 1 ? "" : "s"}
              </p>
            </div>
          )}
          {status === "unfilled" && (
            <div className="inner-tile unfilled-tile">
              <strong>Nobody accepted</strong>
              <p>Everyone qualified was asked. Escalate to the on-call supervisor or relax a requirement.</p>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
