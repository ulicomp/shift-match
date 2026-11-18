import { useState } from "react";
import { Play, LoaderCircle, ChartNoAxesColumn, Minus, Plus } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LabelList,
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
  const colors = ["var(--brand)", "var(--primary)", "var(--chart-gray)"];
  // One row per strategy, so each bar is hovered on its own.
  const fillTimes = ["One at a time", "Top 3", "Random"].map((name, i) => ({
    name,
    minutes: results[i]?.avgMinutesToFill ?? 0,
    fill: colors[i] ?? "var(--primary)",
    // light bars get dark text, dark bars get white text
    ink: i === 2 ? "var(--foreground)" : "#fff",
  }));
  return (
    <>
      <section className="panel">
        <h2>Strategy simulation</h2>
        <p className="text-muted-foreground text-xs mt-2 mb-6">
          Replays the same random cancellations against the same simulated caregivers under each
          strategy. A shift counts as filled only if someone says yes within half the notice time
          (max 2 hours).
        </p>
        <div className="sim-controls">
          <label>
            Shifts to simulate
            <span className="stepper">
              <button type="button" aria-label="100 fewer shifts" onClick={() => setCount((c) => Math.max(100, c - 100))}>
                <Minus />
              </button>
              <input
                type="number"
                aria-label="Shifts to simulate"
                min={1}
                max={10000}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
              <button type="button" aria-label="100 more shifts" onClick={() => setCount((c) => Math.min(10000, c + 100))}>
                <Plus />
              </button>
            </span>
          </label>
          <Button disabled={busy} onClick={run}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Play />}
            {busy ? "Running simulation…" : "Run simulation"}
          </Button>
          <span className="text-muted-foreground text-xs">Runs in your browser · same seed every time</span>
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
                  <BarChart data={fillTimes} barCategoryGap="22%">
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
                    <Tooltip content={<ChartTooltip unit="min" />} cursor={barCursor} />
                    <Bar
                      dataKey="minutes"
                      name="Average fill time"
                      radius={[10, 10, 0, 0]}
                      maxBarSize={88}
                      activeBar={{ fillOpacity: 0.88 }}
                    >
                      {fillTimes.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                      <LabelList
                        dataKey="minutes"
                        content={<BarValue data={fillTimes} />}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="bg-brand" />
                  One at a time
                </span>
                <span>
                  <i className="bg-primary" />
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
                      angle={-35}
                      textAnchor="end"
                      height={44}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={barCursor} />
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
const barCursor = { fill: "rgb(23 25 29 / 0.035)", radius: 12 };
function BarValue({
  data,
  x,
  y,
  width,
  height,
  value,
  index,
}: {
  data: { ink: string }[];
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
  index?: number;
}) {
  const [bx, by, bw, bh] = [x, y, width, height].map(Number) as [number, number, number, number];
  if (!bw || value === undefined) return null;
  const inside = bh >= 34;
  return (
    <text
      x={bx + bw / 2}
      y={inside ? by + 22 : by - 8}
      textAnchor="middle"
      className="bar-value"
      fill={inside ? (data[index ?? 0]?.ink ?? "#fff") : "var(--foreground)"}
    >
      {value}
      <tspan className="bar-unit"> min</tspan>
    </text>
  );
}
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((p, i) => (
        <p className="mt-2" key={i}>
          {p.name}: {p.value}
          {unit ? ` ${unit}` : ""}
        </p>
      ))}
    </div>
  );
}
