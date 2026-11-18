import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getPastShifts } from "@/lib/api";
import { InitialsAvatar, Badge, StatTile, shortDate } from "@/components/shared";
export const pastShiftsQuery = { queryKey: ["past-shifts"], queryFn: getPastShifts };
export default function Shifts() {
  const { data } = useSuspenseQuery(pastShiftsQuery);
  const [payer, setPayer] = useState("");
  const [strategy, setStrategy] = useState("");
  const rows = data.filter(
    (s) => (!payer || s.payer === payer) && (!strategy || s.strategy === strategy),
  );
  const avg = (key: "minutesToFill" | "offers") =>
    rows.length ? (rows.reduce((n, s) => n + s[key], 0) / rows.length).toFixed(1) : "—";
  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <h2 className="mr-auto">Filled shifts</h2>
        <select
          aria-label="Filled shifts payer"
          className="select-pill"
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
        >
          <option value="">Payer: All</option>
          <option>VA</option>
          <option>Medicaid</option>
        </select>
        <select
          aria-label="Filled shifts strategy"
          className="select-pill"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
        >
          <option value="">Strategy: All</option>
          <option value="sequential">One at a time</option>
          <option value="top3">Top 3 at once</option>
        </select>
      </div>
      <div className="stats-grid">
        <StatTile value={avg("minutesToFill")} label="Avg minutes to fill" />
        <StatTile value={avg("offers")} label="Avg offers per shift" />
        <StatTile value={rows.length} label="Shifts filled" />
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {[
              "Date",
              "Client",
              "Filled by",
              "Offers it took",
              "Minutes to fill",
              "Strategy used",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>{shortDate(s.date)}, 2026</td>
              <td>
                <div className="person">
                  <InitialsAvatar name={s.clientName} />
                  {s.clientName}
                  <Badge tone="neutral">{s.payer}</Badge>
                </div>
              </td>
              <td>
                <div className="person">
                  <InitialsAvatar name={s.filledBy} />
                  {s.filledBy}
                </div>
              </td>
              <td>{s.offers}</td>
              <td>
                <Badge
                  tone={s.minutesToFill < 15 ? "green" : s.minutesToFill > 45 ? "urgent" : "gray"}
                >
                  {s.minutesToFill} min
                </Badge>
              </td>
              <td>
                <Badge>{s.strategy === "top3" ? "Top 3 at once" : "One at a time"}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="no-results">No filled shifts match these filters.</div>}
    </section>
  );
}
