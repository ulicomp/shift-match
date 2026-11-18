import { useQuery } from "@tanstack/react-query";
import { Check, GitBranch, ShieldCheck, TrendingUp, UserPlus, X } from "lucide-react";
import { getModelInfo } from "@/lib/api";
import { StatTile } from "@/components/shared";

const steps = [
  {
    number: "01",
    icon: ShieldCheck,
    title: "Hard rules come first",
    text: "Available for every hour of the visit, not already booked, has every required skill, holds the payer credential (VA or Medicaid) and won't go over their weekly max. Fail one and they're filtered out, with the reason shown.",
  },
  {
    number: "02",
    icon: TrendingUp,
    title: "A learned chance of “yes”",
    text: "A logistic regression trained on six weeks of past offers predicts who will accept: distance, history with the client, weekly hours, notice time, weekend, recent offers, their yes rate and time-of-day preference. Every answer during a live dispatch nudges the model again.",
  },
  {
    number: "03",
    icon: UserPlus,
    title: "A fair start for new caregivers",
    text: "With little history, a caregiver's yes rate starts at their skill group's average (dementia, Hoyer lift or general care) and moves toward their own as answers come in, so new people still get offers.",
  },
  {
    number: "04",
    icon: GitBranch,
    title: "Live re-ranking and fairness",
    text: "Offers go out one at a time or three at once. A decline comes back with a reason: “too far” makes distance count more for this visit, “time doesn't work” boosts time-of-day fit, and the list re-ranks before the next text. People asked more than the team's median this week get a small penalty so nobody burns out.",
  },
];

export default function HowItWorks() {
  const model = useQuery({ queryKey: ["model-info"], queryFn: getModelInfo });
  const m = model.data;
  const maxWeight = Math.max(0.01, ...(m?.features.map((f) => Math.abs(f.weight)) ?? [1]));
  return (
    <>
      <section className="panel">
        <h2>The right replacement in minutes, not phone calls</h2>
        <p className="text-muted-foreground mt-3 leading-7 max-w-3xl">
          When a caregiver cancels, the coordinator usually calls whoever lives closest, then the next
          person, then the next. Shift Match does that ranking with data: it removes anyone who can't
          legally or practically take the visit, predicts who will actually say yes, sends offers in
          that order, and learns from every answer. Turn on Agent mode and it does all of that for every open
          visit at once, then hands you a report with only the visits that still need a person.
        </p>
      </section>
      <div className="explanation-grid">
        {steps.map((s) => (
          <section className="panel" key={s.number}>
            <div className="flex justify-between items-center">
              <span className="step-number">{s.number}</span>
              <span className="logo bg-muted">
                <s.icon size={22} />
              </span>
            </div>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
            {s.number === "01" && (
              <div className="inner-tile mt-5">
                <div className="rule-row">
                  Available and not booked
                  <Check size={15} />
                </div>
                <div className="rule-row">
                  Required care skills
                  <Check size={15} />
                </div>
                <div className="rule-row">
                  Missing payer credential
                  <X size={15} className="text-destructive" />
                </div>
              </div>
            )}
            {s.number === "04" && <div className="striped mt-6" />}
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Model details</h2>
        <p className="text-muted-foreground text-xs mt-2">
          Live numbers from the model running in this page. Weights are on standardized inputs, so they
          compare directly: bigger bar = bigger effect on the chance of yes.
        </p>
        {m && (
          <>
            <div className="stats-grid mt-5">
              <StatTile value={m.trainingOffers + m.holdoutOffers} label="Past offers learned from" />
              <StatTile value={`${Math.round(m.holdoutAccuracy * 100)}%`} label="Accuracy on held-out offers" />
              <StatTile value={m.holdoutAuc.toFixed(2)} label="AUC (0.5 = coin flip)" />
            </div>
            <div className="inner-tile mt-4 weights">
              {m.features.map((f) => (
                <div className="weight-row" key={f.key}>
                  <div>
                    <strong>{f.label}</strong>
                    <p>{f.description}</p>
                  </div>
                  <div className="weight-bar" aria-label={`${f.label} weight ${f.weight}`}>
                    <span
                      className={f.weight < 0 ? "neg" : "pos"}
                      style={{ width: `${(Math.abs(f.weight) / maxWeight) * 50}%` }}
                    />
                  </div>
                  <span className="weight-value">
                    {f.weight > 0 ? "+" : ""}
                    {f.weight.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs mt-4">
              {Math.round(m.baseAcceptRate * 100)}% of past offers were accepted · {m.onlineUpdates} live
              update{m.onlineUpdates === 1 ? "" : "s"} since this page loaded · the people's real reactions are
              simulated, the model only sees their yes, no or no reply. This is a prototype: all people,
              visits and replies are simulated and no real texts are sent.
            </p>
          </>
        )}
      </section>
    </>
  );
}
