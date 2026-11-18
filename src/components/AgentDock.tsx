import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Square, X } from "lucide-react";
import { getAgent, setAgentMode } from "@/lib/api";
import type { AgentLogEntry } from "@/lib/types";
import { useEngineVersion } from "./engineStore";

const KIND_TONE: Partial<Record<AgentLogEntry["kind"], string>> = {
  accepted: "good",
  escalated: "warn",
  reranked: "brand",
  plan: "brand",
  done: "good",
};

/** Floating live view of the agent: progress, what it's doing right now, and the way to the report. */
export function AgentDock() {
  useEngineVersion();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { run } = getAgent();
  const [dismissed, setDismissed] = useState<number | null>(null);
  const lastStatus = useRef<string | null>(null);

  // When a run finishes, take the coordinator to the report.
  useEffect(() => {
    const was = lastStatus.current;
    lastStatus.current = run ? `${run.id}:${run.status}` : null;
    if (run?.status === "done" && was && was.startsWith(`${run.id}:`) && !was.endsWith(":done")) {
      const t = setTimeout(() => void navigate({ to: "/agent" }), 1400);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status]);

  if (!run || dismissed === run.id || (run.status === "done" && path === "/agent")) return null;
  const total = run.visits.length;
  const filled = run.visits.filter((v) => v.status === "filled").length;
  const working = run.visits.filter((v) => v.status === "running").length;
  const escalated = run.visits.filter((v) => v.status === "escalated").length;
  const done = run.status === "done";
  const feed = run.log.slice(-4);

  return (
    <aside className={`agent-dock ${done ? "done" : ""}`} aria-live="polite" aria-label="Agent activity">
      <div className="agent-dock-head">
        <span className="agent-orb">
          <Sparkles />
        </span>
        <div className="flex-1 min-w-0">
          <strong>{done ? "Agent finished" : run.status === "stopping" ? "Agent finishing up" : "Agent is working"}</strong>
          <p>
            {filled} of {total} covered
            {working ? ` · ${working} in progress` : ""}
            {escalated ? ` · ${escalated} need${escalated === 1 ? "s" : ""} you` : ""} · {run.elapsedMinutes} min
          </p>
        </div>
        {done ? (
          <>
            <button type="button" className="agent-dock-btn primary" onClick={() => void navigate({ to: "/agent" })}>
              View report <ArrowRight />
            </button>
            <button type="button" className="agent-dock-icon" aria-label="Dismiss" onClick={() => setDismissed(run.id)}>
              <X />
            </button>
          </>
        ) : (
          run.status === "running" && (
            <button type="button" className="agent-dock-btn" onClick={() => setAgentMode(false)}>
              <Square /> Stop
            </button>
          )
        )}
      </div>
      <div className="agent-progress" aria-hidden="true">
        {run.visits.map((v) => (
          <span key={v.shiftId} className={`seg ${v.status}`} />
        ))}
      </div>
      <ul className="agent-feed">
        {feed.map((l) => (
          <li key={l.id} className={KIND_TONE[l.kind] ?? ""}>
            <span className="feed-min">{l.minute}m</span>
            <span className="feed-text">
              {l.clientName && <strong>{l.clientName.split(" ")[0]} · </strong>}
              {l.text}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
