import { useState, useEffect, useRef } from "react";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { getShifts, rankCandidates, sendOffers } from "@/lib/api";
import type { OfferEvent } from "@/lib/types";
import { ShiftCard, RankedCandidates, OfferWidgets } from "@/components/DispatchCards";
import { PageSkeleton, Badge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
export const shiftsQuery = { queryKey: ["open-shifts"], queryFn: getShifts };
export default function Dispatch() {
  const { data: shifts } = useSuspenseQuery(shiftsQuery);
  const [selected, setSelected] = useState(shifts[0]?.id ?? "");
  const [strategy, setStrategy] = useState<"sequential" | "top3">("sequential");
  const [events, setEvents] = useState<OfferEvent[]>([]);
  const [sending, setSending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [reverse, setReverse] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const shift = shifts.find((s) => s.id === selected);
  const ranking = useQuery({
    queryKey: ["rank", selected],
    queryFn: () => rankCandidates(selected),
    enabled: !!shift,
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const select = (id: string) => {
    if (sending) return;
    setSelected(id);
    setEvents([]);
    setComplete(false);
  };
  const send = async () => {
    if (sending || complete) return;
    setSending(true);
    try {
      const result = await sendOffers(selected, strategy);
      let i = 0;
      const next = () => {
        const event = result[i];
        if (event) {
          setEvents((prev) => [...prev, event]);
          i++;
          timer.current = setTimeout(next, 600);
        } else {
          setSending(false);
          setComplete(result.some((e) => e.action === "accepted"));
          queryClient.invalidateQueries({ queryKey: ["past-shifts"] });
          toast("Shift covered — the offer timeline is complete.");
        }
      };
      next();
    } catch {
      setSending(false);
      toast.error("This shift has already been filled.");
    }
  };
  if (!shift)
    return (
      <section className="panel no-results">
        <h2>All shifts are covered</h2>
      </section>
    );
  const ordered = [...shifts].sort((a, b) =>
    reverse ? b.noticeHours - a.noticeHours : a.noticeHours - b.noticeHours,
  );
  return (
    <div className="dispatch-grid">
      <section className="open-column">
        <header className="column-head">
          <h2>Open shifts</h2>
          <Badge tone="neutral">{shifts.length}</Badge>
          <Button
            className="sort"
            variant="secondary"
            size="sm"
            onClick={() => setReverse(!reverse)}
          >
            {reverse ? "By notice" : "By urgency"}
            <ChevronDown />
          </Button>
        </header>
        <div className="shift-list">
          {ordered.map((s) => (
            <ShiftCard
              shift={s}
              key={s.id}
              selected={selected === s.id}
              onSelect={() => select(s.id)}
              count={ranking.data?.candidates.length}
            />
          ))}
        </div>
      </section>
      {ranking.data ? (
        <>
          <RankedCandidates
            shift={shift}
            rank={ranking.data}
            rerank={() => ranking.refetch()}
            busy={ranking.isFetching}
          />
          <OfferWidgets
            shift={shift}
            rank={ranking.data}
            strategy={strategy}
            onStrategy={setStrategy}
            onSend={send}
            events={events}
            sending={sending}
            complete={complete}
          />
        </>
      ) : (
        <div className="col-span-2">
          <PageSkeleton />
        </div>
      )}
    </div>
  );
}
