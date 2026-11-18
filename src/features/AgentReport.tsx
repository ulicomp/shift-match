import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Check, Sparkles } from "lucide-react";
import { getAgent, setAgentMode } from "@/lib/api";
import { Badge, InitialsAvatar, StatTile, time } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { selectShift, useEngineVersion } from "@/components/engineStore";

const clock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";

export default function AgentReport() {
  useEngineVersion();
  const navigate = useNavigate();
  const { on, run } = getAgent();

  if (!run)
    return (
      <section className="panel agent-empty">
        <span className="agent-orb large">
          <Sparkles />
        </span>
        <h2>No agent runs yet</h2>
        <p>
          Turn on Agent mode and it works through every cancelled visit for you: it ranks who can cover each
          one, picks how to text them, handles the replies, and brings you back here with what it did.
        </p>
        <Button onClick={() => setAgentMode(true)}>
          <Sparkles /> Turn on Agent mode
        </Button>
      </section>
    );

  const filled = run.visits.filter((v) => v.status === "filled");
  const needsYou = run.visits.filter((v) => v.status === "escalated");
  const offers = run.visits.reduce((n, v) => n + v.offers, 0);
  const maxOffers = Math.max(1, ...run.offersPerCaregiver.map((c) => c.offers));
  const open = (shiftId: string) => {
    selectShift(shiftId);
    void navigate({ to: "/" });
  };

  return (
    <div className="report">
      <section className="panel report-hero">
        <div className="report-title">
          <span className="agent-orb">
            <Sparkles />
          </span>
          <div>
            <h2>{run.status === "done" ? "Agent report" : "Agent is working…"}</h2>
            <p>
              Started {clock(run.startedAt)}
              {run.finishedAt ? ` · finished ${clock(run.finishedAt)}` : ""} · Agent mode is {on ? "on" : "off"}
            </p>
          </div>
        </div>
        <div className="stats-grid four">
          <StatTile value={`${filled.length} of ${run.visits.length}`} label="Visits covered" />
          <StatTile value={`${run.elapsedMinutes} min`} label="From start to last reply" />
          <StatTile value={offers} label="Texts sent" />
          <StatTile value={needsYou.length} label="Need you" />
        </div>
      </section>

      {needsYou.length > 0 && (
        <section className="panel needs-you">
          <h3>
            <AlertCircle /> Needs you
          </h3>
          {needsYou.map((v) => (
            <div className="needs-row" key={v.shiftId}>
              <InitialsAvatar name={v.clientName} />
              <div className="flex-1 min-w-0">
                <strong>{v.clientName}</strong>
                <p>
                  {v.title} · {time(v.start)} · {v.escalation}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => open(v.shiftId)}>
                Open in Dispatch <ArrowRight />
              </Button>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <h3 className="report-h">Every visit</h3>
        <table className="data-table report-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Visit</th>
              <th>How the agent sent it</th>
              <th>Outcome</th>
              <th>Minutes</th>
              <th>Texts</th>
            </tr>
          </thead>
          <tbody>
            {run.visits.map((v) => (
              <tr key={v.shiftId} className="row-click" onClick={() => open(v.shiftId)}>
                <td>
                  <span className="person">
                    <InitialsAvatar name={v.clientName} small />
                    {v.clientName}
                  </span>
                </td>
                <td className="muted-cell">
                  {v.title}
                  <br />
                  {time(v.start)} – {time(v.end)}
                </td>
                <td className="why-cell">
                  {v.strategy ? <Badge>{v.strategy === "top3" ? "Top 3 at once" : "One at a time"}</Badge> : <Badge>—</Badge>}
                  <p>{v.why || v.escalation}</p>
                </td>
                <td>
                  {v.status === "filled" ? (
                    <Badge tone="green">
                      <Check size={11} /> {v.filledBy}
                    </Badge>
                  ) : v.status === "escalated" ? (
                    <Badge tone="urgent">Needs you</Badge>
                  ) : v.status === "running" ? (
                    <Badge tone="green">
                      <span className="live-dot" /> Working
                    </Badge>
                  ) : (
                    <Badge>{v.status === "skipped" ? "Skipped" : "Queued"}</Badge>
                  )}
                </td>
                <td>{v.minutes ?? "—"}</td>
                <td>{v.offers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="report-grid">
        <section className="panel">
          <h3 className="report-h">What changed</h3>
          {run.changes.length === 0 ? (
            <p className="text-muted-foreground text-xs">{run.status === "done" ? "Nothing was booked." : "Appears when the run is done."}</p>
          ) : (
            run.changes.map((c) => (
              <div className="change-row" key={c.caregiverName}>
                <InitialsAvatar name={c.caregiverName} small />
                <div className="flex-1 min-w-0">
                  <strong>{c.caregiverName}</strong>
                  <p>
                    Now covers {c.visits.join(", ")} · {c.hoursBefore} → {c.hoursAfter} h of {c.maxWeeklyHours}
                  </p>
                  <div className="hours-bar">
                    <span className="before" style={{ width: `${(c.hoursBefore / c.maxWeeklyHours) * 100}%` }} />
                    <span
                      className="added"
                      style={{
                        left: `${(c.hoursBefore / c.maxWeeklyHours) * 100}%`,
                        width: `${((c.hoursAfter - c.hoursBefore) / c.maxWeeklyHours) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="plus">+{c.hoursAfter - c.hoursBefore} h</span>
              </div>
            ))
          )}
        </section>
        <section className="panel">
          <h3 className="report-h">Who got texted</h3>
          <p className="text-muted-foreground text-xs mb-3">
            Offers per caregiver this run. The fairness penalty keeps this spread out.
          </p>
          {run.offersPerCaregiver.map((c) => (
            <div className="spread-row" key={c.name}>
              <span>{c.name}</span>
              <div className="spread-bar">
                <span style={{ width: `${(c.offers / maxOffers) * 100}%` }} />
              </div>
              <strong>{c.offers}</strong>
            </div>
          ))}
        </section>
      </div>

      <section className="panel">
        <details className="filtered">
          <summary>Full agent log ({run.log.length})</summary>
          <ul className="agent-log">
            {run.log.map((l) => (
              <li key={l.id} className={`log-${l.kind}`}>
                <span className="feed-min">{l.minute}m</span>
                <span>
                  {l.clientName && <strong>{l.clientName} · </strong>}
                  {l.text}
                </span>
              </li>
            ))}
          </ul>
        </details>
        <p className="text-muted-foreground text-xs mt-3">
          <Link to="/" className="underline">
            Back to Dispatch
          </Link>
        </p>
      </section>
    </div>
  );
}
