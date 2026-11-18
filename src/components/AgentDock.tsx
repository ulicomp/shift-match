import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Power, Square, X } from "lucide-react";
import { getAgent, setAgentMode } from "@/lib/api";
import type { AgentLogEntry } from "@/lib/types";
import { setDockOpen, useDockOpen, useEngineVersion } from "./engineStore";
import { AgentOrb } from "./AgentOrb";

const KIND_TONE: Partial<Record<AgentLogEntry["kind"], string>> = {
  accepted: "good",
  escalated: "warn",
  reranked: "brand",
  plan: "brand",
  done: "good",
};

/**
 * Floating live view of the agent: progress, what it's doing right now, and the way to the report.
 * Opened from the Agent mode pill; while Agent mode is off it shows the agent asleep.
 */
export function AgentDock() {
  useEngineVersion();
  const open = useDockOpen();
  const navigate = useNavigate();
  const { on, run } = getAgent();
  const lastStatus = useRef<string | null>(null);

  // When a run finishes, take the coordinator to the report and tuck the panel away.
  useEffect(() => {
    const was = lastStatus.current;
    lastStatus.current = run ? `${run.id}:${run.status}` : null;
    if (run?.status === "done" && was && was.startsWith(`${run.id}:`) && !was.endsWith(":done")) {
      const t = setTimeout(() => {
        void navigate({ to: "/agent" });
        setDockOpen(false);
      }, 1400);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status]);

  if (!open) return null;

  const busy = run?.status === "running" || run?.status === "stopping";
  const asleep = !on && !busy;
  const done = !asleep && run?.status === "done";
  const close = (
    <button type="button" className="agent-dock-icon" aria-label="Close" onClick={() => setDockOpen(false)}>
      <X />
    </button>
  );

  const total = run?.visits.length ?? 0;
  const filled = run?.visits.filter((v) => v.status === "filled").length ?? 0;
  const working = run?.visits.filter((v) => v.status === "running").length ?? 0;
  const escalated = run?.visits.filter((v) => v.status === "escalated").length ?? 0;

  let title: string;
  let detail: string;
  if (asleep) {
    title = "Agent is asleep";
    detail =
      run?.status === "done"
        ? `Last run covered ${filled} of ${total} in ${run.elapsedMinutes} min. Wake it to cover what's open.`
        : "Wake it up and it covers every open visit, most urgent first.";
  } else if (!run) {
    title = "Agent is watching";
    detail = "Nothing open right now. It picks up new cancellations as they come in.";
  } else {
    title = done ? "Agent finished" : run.status === "stopping" ? "Agent finishing up" : "Agent is working";
    detail =
      `${filled} of ${total} covered` +
      (working ? ` · ${working} in progress` : "") +
      (escalated ? ` · ${escalated} need${escalated === 1 ? "s" : ""} you` : "") +
      ` · ${run.elapsedMinutes} min`;
  }

  return (
    <aside
      className={`agent-dock ${done ? "done" : ""} ${asleep ? "asleep" : ""}`}
      aria-live="polite"
      aria-label="Agent activity"
    >
      <div className="agent-dock-head">
        <AgentOrb size={38} active={busy && run?.status === "running"} asleep={asleep} wakeOnMount />
        <div className="flex-1 min-w-0">
          <strong>{title}</strong>
          <p>{detail}</p>
        </div>
        {asleep ? (
          <button type="button" className="agent-dock-btn primary" onClick={() => setAgentMode(true)}>
            <Power /> Wake up
          </button>
        ) : done ? (
          <button type="button" className="agent-dock-btn primary" onClick={() => void navigate({ to: "/agent" })}>
            View report <ArrowRight />
          </button>
        ) : (
          run?.status === "running" && (
            <button type="button" className="agent-dock-btn" onClick={() => setAgentMode(false)}>
              <Square /> Stop
            </button>
          )
        )}
        {close}
      </div>
      {!asleep && run && (
        <>
          <div className="agent-progress" aria-hidden="true">
            {run.visits.map((v) => (
              <span key={v.shiftId} className={`seg ${v.status}`} />
            ))}
          </div>
          <ul className="agent-feed">
            {run.log.slice(-4).map((l) => (
              <li key={l.id} className={KIND_TONE[l.kind] ?? ""}>
                <span className="feed-min">{l.minute}m</span>
                <span className="feed-text">
                  {l.clientName && <strong>{l.clientName.split(" ")[0]} · </strong>}
                  {l.text}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
