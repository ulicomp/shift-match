import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { getCaregivers, getClients, logCancellation, rankNow } from "@/lib/api";
import { SKILLS } from "@/lib/mock";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { selectShift } from "./engineStore";
import { Dropdown } from "./Dropdown";
import { DateTimePicker, toInputValue } from "./DateTimePicker";

const defaultStart = () => {
  const d = new Date(Date.now() + 3 * 3_600_000);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toInputValue(d);
};

export function LogCancellationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const caregivers = useQuery({ queryKey: ["caregivers"], queryFn: getCaregivers });
  const [clientId, setClientId] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [duration, setDuration] = useState(4);
  const [skills, setSkills] = useState<string[]>([]);
  const [cancelledBy, setCancelledBy] = useState("");
  const [saving, setSaving] = useState(false);
  const client = useMemo(() => clients.data?.find((c) => c.id === clientId), [clients.data, clientId]);

  useEffect(() => {
    if (open) {
      setStart(defaultStart());
      setCancelledBy("");
      const first = clients.data?.[0];
      if (!clientId && first) {
        setClientId(first.id);
        setSkills(first.careNeeds);
      }
    }
  }, [open, clients.data, clientId]);

  const chooseClient = (id: string) => {
    setClientId(id);
    setSkills(clients.data?.find((c) => c.id === id)?.careNeeds ?? []);
  };
  const toggleSkill = (s: string) => setSkills((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const regulars = (caregivers.data ?? []).filter((c) => c.clientIds.includes(clientId));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const shift = await logCancellation({
        clientId,
        start: `${start}:00`,
        durationHours: duration,
        requiredSkills: skills,
        cancelledBy: cancelledBy || null,
      });
      const n = rankNow(shift.id)?.candidates.length ?? 0;
      selectShift(shift.id);
      onOpenChange(false);
      await navigate({ to: "/" });
      toast.success(`${shift.clientName}'s visit is ranked · ${n} qualified caregiver${n === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log the cancellation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="log-dialog">
        <DialogTitle>Log a cancellation</DialogTitle>
        <DialogDescription>Shift Match ranks who can cover it the moment you save.</DialogDescription>
        <form className="log-form" onSubmit={submit}>
          <div className="field">
            <span>Client</span>
            <Dropdown
              label="Client"
              value={clientId}
              onChange={chooseClient}
              options={(clients.data ?? []).map((c) => ({
                value: c.id,
                label: c.name,
                hint: `${c.neighborhood} · ${c.payer} · ${c.careNeeds.join(", ")}`,
              }))}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <span>Visit starts</span>
              <DateTimePicker label="Visit starts" value={start} onChange={setStart} />
            </div>
            <div className="field">
              <span>Length</span>
              <Dropdown
                label="Visit length"
                value={duration}
                onChange={setDuration}
                menuWidth={150}
                options={[2, 3, 4, 5, 6, 8].map((h) => ({ value: h, label: `${h} hours` }))}
              />
            </div>
          </div>
          <fieldset className="field">
            <span>Required skills</span>
            <div className="skill-toggles">
              {SKILLS.map((s) => (
                <button type="button" key={s} className="skill-toggle" aria-pressed={skills.includes(s)} onClick={() => toggleSkill(s)}>
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <span>Who cancelled</span>
            <Dropdown
              label="Who cancelled"
              value={cancelledBy}
              onChange={setCancelledBy}
              options={[
                { value: "", label: "Not recorded" },
                ...regulars.map((c) => ({ value: c.id, label: c.name, hint: "Regular caregiver for this client" })),
                ...(caregivers.data ?? [])
                  .filter((c) => !regulars.includes(c))
                  .map((c) => ({ value: c.id, label: c.name, hint: c.neighborhood })),
              ]}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Payer: <strong className="text-foreground">{client?.payer ?? "—"}</strong> · caregivers need this credential.
          </p>
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !clientId || skills.length === 0}>
              {saving ? "Ranking…" : "Save and rank"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
