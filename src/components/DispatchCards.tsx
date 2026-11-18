import {
  ArrowUpRight,
  Clock,
  Send,
  UserRound,
  Users,
  Check,
  RefreshCw,
  History,
  MapPin,
  Filter,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Shift, Candidate, RankResult, OfferEvent } from "@/lib/types";
import { Button } from "./ui/button";
import {
  InitialsAvatar,
  Badge,
  StatBubble,
  ScoreBar,
  ReasonChip,
  CardFooter,
  IconButton,
  ArrowButton,
  shortDate,
  time,
} from "./shared";
export function ShiftCard({
  shift,
  selected,
  onSelect,
  count,
}: {
  shift: Shift;
  selected: boolean;
  onSelect: () => void;
  count?: number | undefined;
}) {
  return (
    <Button variant="shift" size="card" aria-pressed={selected} onClick={onSelect}>
      <div className="shift-top">
        <InitialsAvatar name={shift.clientName} />
        <span className="client-name">
          {shift.clientName.split(" ")[0]}
          <br />
          {shift.clientName.split(" ").slice(1).join(" ")}
        </span>
        <span className="arrow-circle">
          <ArrowUpRight />
        </span>
      </div>
      <h3>
        {shift.requiredSkills.includes("Dementia care")
          ? "Morning personal care"
          : shift.requiredSkills.includes("Spanish speaking")
            ? "Afternoon home visit"
            : "Medication & meal support"}
      </h3>
      <p className="date">
        {new Date(shift.start).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
        <br />
        {time(shift.start)} – {time(shift.end)}
      </p>
      <div className="tags">
        {shift.requiredSkills.map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
      </div>
      <div className="shift-bottom">
        {selected ? (
          <>
            <StatBubble value={`${shift.noticeHours} h`} label="notice" />
            <StatBubble value={count ?? "—"} label="qualified" />
            <Badge tone="neutral">Ranking ready</Badge>
          </>
        ) : (
          <>
            <Badge tone="neutral">{shift.payer}</Badge>
            <Badge tone={shift.noticeHours < 12 ? "urgent" : "gray"}>
              notice: {shift.noticeHours} hours
            </Badge>
          </>
        )}
      </div>
    </Button>
  );
}
export function CandidateRow({ candidate }: { candidate: Candidate }) {
  return (
    <div className={`candidate ${candidate.rank === 1 ? "best" : ""}`}>
      <div className="candidate-top">
        <span className="rank-num">#{candidate.rank}</span>
        <InitialsAvatar name={candidate.name} />
        <div className="candidate-name">
          <h3>{candidate.name}</h3>
          {candidate.servedClientBefore && <Badge tone="neutral">Served this client before</Badge>}
        </div>
        <span className="score">{candidate.score.toFixed(2)}</span>
      </div>
      <ScoreBar value={candidate.score} />
      <p className="candidate-meta">
        {candidate.distanceMiles} mi <span className="mx-2">·</span> {candidate.hoursThisWeek} /{" "}
        {candidate.maxWeeklyHours} h this week
      </p>
      <div className="reason-chips">
        {candidate.reasons.map((r) => (
          <ReasonChip key={r} reason={r} />
        ))}
      </div>
    </div>
  );
}
export function RankedCandidates({
  shift,
  rank,
  rerank,
  busy,
}: {
  shift: Shift;
  rank: RankResult;
  rerank: () => void;
  busy: boolean;
}) {
  const jump = () =>
    document
      .getElementById("candidate-list")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return (
    <section className="panel ranked-panel">
      <div className="rank-header">
        <Badge>
          {shift.payer} · {shift.requiredSkills.at(-1)}
        </Badge>
        <span>{shortDate(shift.start)}, 2026</span>
        <ArrowButton label="View ranked candidates" onClick={jump} />
      </div>
      <div className="client-hero">
        <div className="hero-avatar">
          <InitialsAvatar name={shift.clientName} large />
          <span className="payer-dot">{shift.payer[0]}</span>
        </div>
        <h2>{shift.clientName}</h2>
        <p>Cancelled shift · 4 h window</p>
      </div>
      <div className="hero-actions">
        <Button variant="secondary" size="sm" disabled={busy} onClick={rerank}>
          <RefreshCw className={busy ? "animate-spin" : ""} />
          Re-rank
        </Button>
        <IconButton label="Distance" onClick={jump}>
          <MapPin />
        </IconButton>
        <IconButton label="Weekly hours" onClick={jump}>
          <Clock />
        </IconButton>
        <IconButton label="Past visits" onClick={jump}>
          <History />
        </IconButton>
        <IconButton
          label="Filtered out"
          onClick={() => {
            const el = document.getElementById("filtered");
            if (el instanceof HTMLDetailsElement) {
              el.open = true;
              el.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }}
        >
          <Filter />
        </IconButton>
      </div>
      <div className="rank-heading">
        <h2>Ranked candidates</h2>
        <span>{rank.candidates.length} qualified · best match first</span>
      </div>
      <div className="candidate-list" id="candidate-list">
        {rank.candidates.slice(0, 5).map((c) => (
          <CandidateRow key={c.caregiverId} candidate={c} />
        ))}
      </div>
      {rank.candidates.length > 5 && (
        <details className="filtered">
          <summary>View {rank.candidates.length - 5} more candidates</summary>
          <div className="candidate-list">
            {rank.candidates.slice(5).map((c) => (
              <CandidateRow key={c.caregiverId} candidate={c} />
            ))}
          </div>
        </details>
      )}
      <details className="filtered" id="filtered">
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
export function StrategyPicker({
  strategy,
  onChange,
  disabled,
}: {
  strategy: "sequential" | "top3";
  onChange: (value: "sequential" | "top3") => void;
  disabled: boolean;
}) {
  return (
    <div className="strategy-options">
      <Button
        variant="tile"
        size="card"
        disabled={disabled}
        aria-pressed={strategy === "sequential"}
        onClick={() => onChange("sequential")}
      >
        <UserRound />
        <strong>One at a time</strong>
        <p>
          Next best gets it
          <br />
          if they decline
        </p>
      </Button>
      <Button
        variant="tile"
        size="card"
        disabled={disabled}
        aria-pressed={strategy === "top3"}
        onClick={() => onChange("top3")}
      >
        <Users />
        <strong>Top 3 at once</strong>
        <p>
          First to accept
          <br />
          wins
        </p>
      </Button>
    </div>
  );
}
export function OfferWidgets({
  shift,
  rank,
  strategy,
  onStrategy,
  onSend,
  events,
  sending,
  complete,
}: {
  shift: Shift;
  rank: RankResult;
  strategy: "sequential" | "top3";
  onStrategy: (s: "sequential" | "top3") => void;
  onSend: () => void;
  events: OfferEvent[];
  sending: boolean;
  complete: boolean;
}) {
  const accepted = events.find((e) => e.action === "accepted");
  return (
    <aside className="widget-column">
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">
            <Send />
            Send offers
          </h2>
          <ArrowButton label="Send ranked offers" onClick={onSend} />
        </div>
        <StrategyPicker strategy={strategy} onChange={onStrategy} disabled={sending || complete} />
        <Button
          className="w-full"
          onClick={onSend}
          disabled={sending || complete || rank.candidates.length === 0}
        >
          {complete ? <Check /> : <Send />}
          {complete ? "Shift filled" : sending ? "Sending offers…" : "Send offers"}
        </Button>
        <CardFooter>Strategy affects speed and fairness</CardFooter>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">
            <Clock />
            Offer timeline
          </h2>
          <span className="text-muted-foreground text-[10px]">Today, Nov 18</span>
        </div>
        <div className="timeline" aria-live="polite">
          {events.length === 0 ? (
            <div className="inner-tile empty-tile">
              <Send size={22} />
              <p>No offers sent yet</p>
            </div>
          ) : (
            events.map((e, i) => (
              <div className="timeline-item" key={`${i}-${e.action}`}>
                <span className="minute">min {e.minute}</span>
                <InitialsAvatar name={e.caregiverName} small />
                <p>{e.action === "sent" ? `Offer sent to ${e.caregiverName}` : e.caregiverName}</p>
                {e.action !== "sent" && (
                  <Badge tone={e.action === "accepted" ? "green" : "gray"}>
                    {e.action === "no_response"
                      ? "No response"
                      : e.action === "accepted"
                        ? "Accepted"
                        : "Declined"}
                  </Badge>
                )}
              </div>
            ))
          )}
          {accepted && (
            <div className="filled-tile">
              <span className="big-number">
                {accepted.minute} <span className="text-2xl">min</span>
              </span>
              <p>
                Filled by <strong>{accepted.caregiverName}</strong>
              </p>
              <div className="striped mt-4" />
            </div>
          )}
        </div>
        <CardFooter>Every offer, one clear trail</CardFooter>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">
            <CalendarCheckIcon />
            Shift summary
          </h2>
          <Badge tone={complete ? "green" : shift.noticeHours < 12 ? "urgent" : "neutral"}>
            {complete ? "Filled" : shift.noticeHours < 12 ? "Urgent" : "Open"}
          </Badge>
        </div>
        {[
          ["Qualified caregivers", rank.candidates.length],
          ["Filtered out", rank.filteredOut.length],
          ["Best score", rank.candidates[0]?.score.toFixed(2) ?? "—"],
          ["Payer", shift.payer],
        ].map(([label, value]) => (
          <div className="summary-row" key={label}>
            <span className="summary-toggle" />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <CardFooter>
          <Link to="/shifts">View all shifts</Link>
        </CardFooter>
      </section>
    </aside>
  );
}
function CalendarCheckIcon() {
  return <Check />;
}
