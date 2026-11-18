import { statsNow } from "@/lib/api";
import { useEngineVersion } from "./engineStore";

/** Live numbers for today, always visible in the top bar. */
export function TopStats() {
  useEngineVersion();
  const s = statsNow();
  type Item = { label: string; value: string | number; tone: "urgent" | "live" | null };
  const items: Item[] = [
    { label: "Open visits", value: s.open, tone: null },
    { label: "Urgent", value: s.urgent, tone: s.urgent ? "urgent" : null },
    { label: "Filled today", value: s.filledToday, tone: null },
  ];
  return (
    <div className="top-stats" aria-label="Today at a glance">
      {items.map((i) => (
        <div className="top-stat" key={i.label}>
          <strong>
            {i.tone && <span className={`dot ${i.tone}`} />}
            {i.value}
          </strong>
          <span>{i.label}</span>
        </div>
      ))}
    </div>
  );
}
