import { useCallback, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { FloatingPanel } from "./FloatingPanel";

const pad = (n: number) => String(n).padStart(2, "0");
/** "YYYY-MM-DDTHH:mm" in local time, the format the rest of the app uses. */
export const toInputValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parse = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const TIMES = Array.from({ length: 31 }, (_, i) => ({ h: 6 + Math.floor(i / 2), m: i % 2 ? 30 : 0 })); // 6:00–21:00

const timeLabel = (h: number, m: number) =>
  new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function DateTimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const close = useCallback(() => setOpen(false), []);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const days = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1));
  }, [month]);

  const set = (day: Date, h = selected.getHours(), m = selected.getMinutes()) => {
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    // Picking today with a time that already passed moves to the next free half hour.
    if (next <= now) {
      const soon = new Date(now.getTime() + 30 * 60_000);
      soon.setMinutes(soon.getMinutes() < 30 ? 30 : 60, 0, 0);
      if (sameDay(soon, day)) return onChange(toInputValue(soon));
    }
    onChange(toInputValue(next));
  };
  const quick = (hours: number) => {
    const d = new Date(now.getTime() + hours * 3_600_000);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    onChange(toInputValue(d));
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  const tomorrowAt8 = () => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 8, 0);
    onChange(toInputValue(d));
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`dropdown-trigger ${open ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
          setOpen((o) => !o);
        }}
      >
        <span className="dropdown-value">
          <CalendarDays className="dropdown-icon" />
          {selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ·{" "}
          {timeLabel(selected.getHours(), selected.getMinutes())}
        </span>
        <ChevronDown className="dropdown-chevron" />
      </button>
      <FloatingPanel anchor={trigger} open={open} onClose={close} minWidth={318} className="date-panel">
        <div className="quick-picks">
          <button type="button" onClick={() => quick(2)}>In 2 hours</button>
          <button type="button" onClick={() => quick(4)}>In 4 hours</button>
          <button type="button" onClick={tomorrowAt8}>Tomorrow 8 AM</button>
        </div>
        <div className="calendar-head">
          <button
            type="button"
            className="cal-nav"
            aria-label="Previous month"
            disabled={month <= new Date(today.getFullYear(), today.getMonth(), 1)}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft />
          </button>
          <strong>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
          <button
            type="button"
            className="cal-nav"
            aria-label="Next month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight />
          </button>
        </div>
        <div className="calendar-grid" role="grid" aria-label="Choose a day">
          {WEEKDAYS.map((d) => (
            <span key={d} className="cal-weekday">
              {d}
            </span>
          ))}
          {days.map((d) => {
            const outside = d.getMonth() !== month.getMonth();
            const past = d < today;
            return (
              <button
                type="button"
                key={d.toISOString()}
                className={`cal-day ${outside ? "outside" : ""} ${sameDay(d, today) ? "today" : ""}`}
                aria-pressed={sameDay(d, selected)}
                aria-label={d.toDateString()}
                disabled={past}
                onClick={() => set(d)}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="time-head">Start time</div>
        <div className="time-grid">
          {TIMES.map(({ h, m }) => {
            const t = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), h, m);
            const isSel = selected.getHours() === h && selected.getMinutes() === m;
            return (
              <button
                type="button"
                key={`${h}:${m}`}
                className="time-chip"
                aria-pressed={isSel}
                disabled={t <= now}
                ref={isSel ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                onClick={() => set(selected, h, m)}
              >
                {timeLabel(h, m)}
              </button>
            );
          })}
        </div>
        <div className="date-footer">
          <button type="button" className="date-done" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </FloatingPanel>
    </>
  );
}
