import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search, ChevronDown, Check } from "lucide-react";
import { getCaregivers, getShifts, getPastShifts } from "@/lib/api";
import type { Caregiver } from "@/lib/types";
import { InitialsAvatar, Badge, ScoreBar, StatBubble } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
export const caregiversQuery = { queryKey: ["caregivers"], queryFn: getCaregivers };
export default function Caregivers() {
  const { data } = useSuspenseQuery(caregiversQuery);
  const { data: shifts } = useSuspenseQuery({ queryKey: ["open-shifts"], queryFn: getShifts });
  const { data: past } = useSuspenseQuery({ queryKey: ["past-shifts"], queryFn: getPastShifts });
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");
  const [payer, setPayer] = useState("");
  const [sort, setSort] = useState("name");
  const [descending, setDescending] = useState(false);
  const [person, setPerson] = useState<Caregiver | null>(null);
  const rows = data
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) &&
        (!skill || c.skills.includes(skill)) &&
        (!payer || c.credentials.some((p) => p === payer)),
    )
    .sort((a, b) => {
      const v =
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "hours"
            ? a.hoursThisWeek - b.hoursThisWeek
            : sort === "acceptance"
              ? a.acceptanceRate - b.acceptanceRate
              : a.offersLast7Days - b.offersLast7Days;
      return descending ? -v : v;
    });
  const toggle = (key: string) => {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(false);
    }
  };
  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <h2 className="mr-auto">
          Caregiver directory{" "}
          <span className="text-muted-foreground text-xs ml-2">{rows.length} caregivers</span>
        </h2>
        <div className="search-pill">
          <Search size={16} />
          <input
            aria-label="Search caregiver directory"
            placeholder="Search caregivers"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select-pill"
          aria-label="Skill filter"
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
        >
          <option value="">Skill: All</option>
          {[...new Set(data.flatMap((c) => c.skills))].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="select-pill"
          aria-label="Payer filter"
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
        >
          <option value="">Payer: All</option>
          <option>VA</option>
          <option>Medicaid</option>
        </select>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {(
              [
                ["name", "Name"],
                ["skills", "Skills"],
                ["credentials", "Credentials"],
                ["hours", "Hours this week"],
                ["acceptance", "Acceptance rate"],
                ["offers", "Offers · last 7 days"],
              ] as const
            ).map(([key, label]) => (
              <th key={key}>
                {["skills", "credentials"].includes(key) ? (
                  label
                ) : (
                  <Button variant="ghost" className="sort-button" onClick={() => toggle(key)}>
                    {label}
                    <ChevronDown className={sort === key && descending ? "rotate-180" : ""} />
                  </Button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.id}
              className="row-click"
              onClick={() => setPerson(c)}
              tabIndex={0}
              aria-label={`View ${c.name}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") setPerson(c);
              }}
            >
              <td>
                <span className="person">
                  <InitialsAvatar name={c.name} />
                  {c.name}
                </span>
              </td>
              <td>
                <div className="flex gap-1">
                  {c.skills.slice(0, 3).map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                  {c.skills.length > 3 && <Badge>+{c.skills.length - 3}</Badge>}
                </div>
              </td>
              <td>
                <div className="flex gap-1">
                  {c.credentials.map((p) => (
                    <Badge key={p} tone="neutral">
                      {p}
                    </Badge>
                  ))}
                </div>
              </td>
              <td>
                {c.hoursThisWeek} / {c.maxWeeklyHours}
                <ScoreBar value={c.hoursThisWeek / c.maxWeeklyHours} />
              </td>
              <td>{Math.round(c.acceptanceRate * 100)}%</td>
              <td>{c.offersLast7Days}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="no-results">No caregivers match these filters.</div>}
      <Sheet
        open={!!person}
        onOpenChange={(open) => {
          if (!open) setPerson(null);
        }}
      >
        <SheetContent>
          {person && (
            <>
              <div className="sheet-hero">
                <InitialsAvatar name={person.name} large />
                <SheetTitle className="mt-3">{person.name}</SheetTitle>
                <SheetDescription>Caregiver · Miami Home Care</SheetDescription>
              </div>
              <div className="sheet-stats">
                <StatBubble
                  value={`${Math.round(person.acceptanceRate * 100)}%`}
                  label="acceptance"
                />
                <StatBubble value={person.hoursThisWeek} label="hours" />
                <StatBubble value={person.offersLast7Days} label="offers · 7d" />
              </div>
              <div className="sheet-section">
                <h3>Weekly availability</h3>
                <div className="inner-tile availability">
                  <span />
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                  {(["morning", "afternoon", "evening"] as const).map((slot) => (
                    <AvailabilityRow key={slot} caregiver={person} slot={slot} />
                  ))}
                </div>
              </div>
              <div className="sheet-section">
                <h3>Clients served</h3>
                <div className="space-y-3">
                  {person.clientIds.map((id) => {
                    const name =
                      shifts.find((s) => s.clientId === id)?.clientName ??
                      [...new Set(past.map((s) => s.clientName))][
                        Number(id.replace("client-", ""))
                      ];
                    return name ? (
                      <div className="flex gap-3 items-center text-xs" key={id}>
                        <InitialsAvatar name={name} />
                        {name}
                      </div>
                    ) : (
                      <div className="flex gap-3 items-center text-xs" key={id}>
                        <InitialsAvatar name="Past client" />
                        Past client
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="sheet-section">
                <h3>
                  Offer history{" "}
                  <span className="text-muted-foreground font-normal text-xs">· sample week</span>
                </h3>
                <div className="inner-tile">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="big-number">
                        {Math.round(person.offersLast7Days * person.acceptanceRate)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Accepted</p>
                    </div>
                    <div>
                      <p className="big-number">
                        {person.offersLast7Days -
                          Math.round(person.offersLast7Days * person.acceptanceRate)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Declined</p>
                    </div>
                  </div>
                  <div className="striped" />
                </div>
              </div>
              <div className="tags">
                {person.skills.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
function AvailabilityRow({
  caregiver,
  slot,
}: {
  caregiver: Caregiver;
  slot: "morning" | "afternoon" | "evening";
}) {
  return (
    <>
      <span className="text-left capitalize">{slot}</span>
      {Array.from({ length: 7 }, (_, day) => {
        const available = caregiver.availability.some((a) => a.day === day && a.slot === slot);
        return (
          <div
            key={day}
            className={`availability-cell ${available ? "available" : ""}`}
            aria-label={`${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][day]} ${slot}: ${available ? "available" : "unavailable"}`}
          >
            {available && <Check size={12} className="text-primary-foreground m-auto mt-1" />}
          </div>
        );
      })}
    </>
  );
}
