import { useEffect, useMemo, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getDispatch, getShifts, rankNow, sendOffers } from "@/lib/api";
import type { Shift, Strategy } from "@/lib/types";
import { ColHead, OfferWidgets, RankedCandidates, ShiftCard } from "@/components/DispatchCards";
import { Badge } from "@/components/shared";
import { selectShift, useEngineVersion, useRequestedShift } from "@/components/engineStore";

export const shiftsQuery = { queryKey: ["open-shifts"], queryFn: getShifts };

export default function Dispatch() {
  const version = useEngineVersion();
  const { data: open } = useSuspenseQuery(shiftsQuery);
  const requested = useRequestedShift();
  const [selected, setSelected] = useState(requested ?? open[0]?.id ?? "");
  const [strategy, setStrategy] = useState<Strategy>("sequential");

  // Keep shifts we've seen so a filled shift stays on screen with its result.
  const seen = useRef(new Map<string, Shift>());
  open.forEach((s) => seen.current.set(s.id, s));

  useEffect(() => {
    if (requested) {
      setSelected(requested);
      selectShift(null);
    }
  }, [requested]);

  const list = useMemo(() => {
    const openIds = new Set(open.map((s) => s.id));
    const done = [...seen.current.values()].filter((s) => !openIds.has(s.id) && getDispatch(s.id)?.status === "filled");
    const ordered = [...open].sort((a, b) => a.noticeHours - b.noticeHours);
    return [...ordered, ...done];
    // version: re-evaluate when the engine changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, version]);

  const shift = list.find((s) => s.id === selected) ?? list[0];

  // When the selection changes, bring its card into view and start the ranking from the top.
  useEffect(() => {
    requestAnimationFrame(() => {
      document.querySelector('.shift-card[aria-pressed="true"]')?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const panel = document.querySelector(".ranked-panel");
      panel?.scrollTo?.({ top: 0, behavior: "smooth" });
      document.querySelector(".widget-column")?.scrollTo?.({ top: 0, behavior: "smooth" });
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [shift?.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rank = useMemo(() => (shift ? rankNow(shift.id) : null), [shift?.id, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dispatch = useMemo(() => (shift ? getDispatch(shift.id) : null), [shift?.id, version]);

  const send = () => {
    if (!shift) return;
    const id = shift.id;
    sendOffers(id, strategy)
      .then(() => {
        const result = getDispatch(id);
        if (result?.status === "filled")
          toast.success(`${result.filledBy} accepted ${shift.clientName}'s visit · filled in ${result.minute} min`);
        else toast.error(`Nobody accepted ${shift.clientName}'s visit. Escalate to the on-call supervisor.`);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't send offers"));
  };

  if (!shift || !rank)
    return (
      <section className="panel no-results">
        <h2>All shifts are covered</h2>
        <p className="text-muted-foreground text-sm mt-2">Use “Log cancellation” when a caregiver calls out.</p>
      </section>
    );

  const running = dispatch?.status === "running";
  const inLine = rank.candidates.filter((c) => c.rank > 0).length;

  return (
    <div className="dispatch-grid">
      <section className="dispatch-col">
        <ColHead
          step={1}
          title="Cancelled visits"
          extra={<Badge tone="neutral">{open.length}</Badge>}
          hint="Clients whose caregiver cancelled"
        />
        <div className="shift-list" data-elastic>
          {list.map((s) => (
            <ShiftCard
              shift={s}
              key={s.id}
              selected={shift.id === s.id}
              onSelect={() => setSelected(s.id)}
              dispatch={s.id === shift.id ? dispatch : getDispatch(s.id)}
            />
          ))}
        </div>
      </section>
      <section className="dispatch-col">
        <ColHead
          step={2}
          title="Who can cover it"
          extra={
            running ? (
              <span className="live-pill on">
                <RefreshCw className="animate-spin" />
                Re-ranking live
              </span>
            ) : undefined
          }
          hint={`${inLine} can take it · % is the chance they say yes`}
        />
        <RankedCandidates shift={shift} rank={rank} />
      </section>
      <section className="dispatch-col">
        <ColHead step={3} title="Send offers" hint="Pick how to text them, then send" />
        <OfferWidgets
          rank={rank}
          strategy={dispatch?.status === "running" ? dispatch.strategy : strategy}
          onStrategy={setStrategy}
          onSend={send}
          dispatch={dispatch}
        />
      </section>
    </div>
  );
}
