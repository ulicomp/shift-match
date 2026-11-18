import { ShieldCheck, TrendingUp, UserPlus, GitBranch, Check, X } from "lucide-react";
export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: ShieldCheck,
      title: "Hard rules come first",
      text: "Available for the visit, equipped with every required skill, and credentialed for the payer. Fail any one of these rules and the caregiver is filtered out.",
    },
    {
      number: "02",
      icon: TrendingUp,
      title: "A likelihood score, not a guess",
      text: "A model can learn from past yes/no answers: distance, client history, weekly hours, notice time, time of day, and acceptance rate. This prototype uses a deterministic mock score.",
    },
    {
      number: "03",
      icon: UserPlus,
      title: "A fair start for new caregivers",
      text: "New caregivers can start from their skill group’s average until they have enough of their own offer history. Everyone starts with a meaningful opportunity.",
    },
    {
      number: "04",
      icon: GitBranch,
      title: "Ranked fallback & fairness",
      text: "The next best caregiver is always ready. A small penalty for people asked too often helps share offers across the team without burning anyone out.",
    },
  ];
  return (
    <>
      <section className="panel">
        <h2>A better match for every shift</h2>
        <p className="text-muted-foreground mt-3 leading-7 max-w-3xl">
          When a caregiver cancels, the right replacement is more than the closest person. Shift
          Match checks the non-negotiables, ranks qualified caregivers, and keeps a clear trail from
          the first offer to a filled shift.
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
                  Available for this shift
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
        <div className="inner-tile mt-4 text-muted-foreground text-xs leading-7">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae metus eu lectus
          facilisis malesuada. Curabitur at neque sed sem consequat tincidunt. This is sample model
          documentation; all rankings and simulation results in this prototype are illustrative, not
          clinical or operational recommendations.
        </div>
      </section>
    </>
  );
}
