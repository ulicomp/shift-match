import { useState } from "react";
import { Play, LoaderCircle, ChartNoAxesColumn } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { runSimulation } from "@/lib/api";
import type { SimulationResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared";
import { toast } from "sonner";
export default function Simulation() {
  const [count, setCount] = useState(500);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [strategy, setStrategy] = useState(0);
  const run = async () => {
    setBusy(true);
    try {
      setResults(await runSimulation(count));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  };
  const fairness = results[strategy]?.offersPerCaregiver ?? [];
  const average = fairness.reduce((n, c) => n + c.offers, 0) / Math.max(1, fairness.length);
  const colors = ["var(--primary)", "var(--coral)", "var(--chart-gray)"];
  return (
    <>
      <section className="panel">
        <h2>Strategy simulation</h2>
        <p className="text-muted-foreground text-xs mt-2 mb-6">
          Compare coverage speed and how offers are shared across the team.
        </p>
        <div className="sim-controls">
          <label>
            Shifts to simulate
            <input
              type="number"
              className="number-pill"
              aria-label="Shifts to simulate"
              min={1}
              max={10000}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <Button disabled={busy} onClick={run}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Play />}
            {busy ? "Running simulation…" : "Run simulation"}
          </Button>
          <span className="text-muted-foreground text-xs">November 2026 · local sample</span>
        </div>
      </section>
      <div className="simulation-results">
        {["Shift Match (one at a time)", "Shift Match (top 3)", "Random qualified pick"].map(
          (name, i) => (
            <section className="panel" key={name}>
              <h2 className="mb-5 text-sm">{name}</h2>
              {results[i] ? (
                <div className="stats-grid">
                  <StatTile
                    value={results[i].avgMinutesToFill}
                    label="Average minutes to fill"
                    best={
                      results[i].avgMinutesToFill ===
                      Math.min(...results.map((r) => r.avgMinutesToFill))
                    }
                  />
                  <StatTile
                    value={results[i].avgOffersPerShift}
                    label="Average offers per shift"
                    best={
                      results[i].avgOffersPerShift ===
                      Math.min(...results.map((r) => r.avgOffersPerShift))
                    }
                  />
                  <StatTile
                    value={`${results[i].fillRate}%`}
                    label="Fill rate"
                    best={results[i].fillRate === Math.max(...results.map((r) => r.fillRate))}
                  />
                </div>
              ) : (
                <Empty />
              )}
            </section>
          ),
        )}
      </div>
      <div className="chart-grid">
        <section className="panel">
          <h2 className="mb-6">Minutes to fill</h2>
          {results.length ? (
            <>
              <div className="chart-area">
                <ResponsiveContainer>
                  <BarChart
                    data={[
                      {
                        name: "Average fill time",
                        sequential: results[0]?.avgMinutesToFill ?? 0,
                        top3: results[1]?.avgMinutesToFill ?? 0,
                        random: results[2]?.avgMinutesToFill ?? 0,
                      },
                    ]}
                    barGap={16}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {["sequential", "top3", "random"].map((key, i) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        name={["One at a time", "Top 3", "Random"][i] ?? key}
                        fill={colors[i] ?? "var(--primary)"}
                        radius={[8, 8, 0, 0]}
                        maxBarSize={66}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="bg-primary" />
                  One at a time
                </span>
                <span>
                  <i className="bg-coral" />
                  Top 3
                </span>
                <span>
                  <i className="bg-chart-gray" />
                  Random
                </span>
              </div>
            </>
          ) : (
            <Empty />
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Fairness</h2>
            <div className="flex gap-1">
              {["One", "Top 3", "Random"].map((name, i) => (
                <Button
                  key={name}
                  size="sm"
                  variant={strategy === i ? "default" : "secondary"}
                  aria-pressed={strategy === i}
                  onClick={() => setStrategy(i)}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>
          {results.length ? (
            <>
              <div className="chart-area">
                <ResponsiveContainer>
                  <BarChart data={fairness}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tickFormatter={(n: string) => String(n).split(" ")[0] ?? ""}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval={3}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine
                      y={average}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 4"
                    />
                    <Bar
                      dataKey="offers"
                      name="Offers"
                      fill="var(--primary)"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Offers per caregiver · dashed line: average {average.toFixed(1)}
              </p>
            </>
          ) : (
            <Empty />
          )}
        </section>
      </div>
    </>
  );
}
function Empty() {
  return (
    <div className="inner-tile empty-tile">
      <ChartNoAxesColumn size={26} />
      <p>Run a simulation to compare strategies</p>
    </div>
  );
}
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((p, i) => (
        <p className="mt-2" key={i}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}
