import type { ReactNode } from "react";
import { ArrowUpRight, MapPin, TrendingUp, AlertCircle, Sparkles, HeartHandshake, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
export function InitialsAvatar({
  name,
  large = false,
  small = false,
}: {
  name: string;
  large?: boolean;
  small?: boolean;
}) {
  const colors = ["bg-peach", "bg-mint", "bg-sky", "bg-lavender", "bg-sand"];
  const hash = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  return (
    <span
      className={`avatar ${large ? "large" : small ? "small" : ""} ${colors[hash % 5]}`}
      aria-label={name}
    >
      {name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}
export function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: (() => void) | undefined;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="circle" size="icon" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export function ArrowButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: (() => void) | undefined;
}) {
  return (
    <IconButton label={label} onClick={onClick}>
      <ArrowUpRight />
    </IconButton>
  );
}
export function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "neutral" | "urgent" | "green";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function StatBubble({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat-bubble">
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}
export function ScoreBar({ value }: { value: number }) {
  return (
    <div
      className="score-bar"
      role="meter"
      aria-label="Likelihood score"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={1}
    >
      <span style={{ width: `${value * 100}%` }} />
    </div>
  );
}
const WARNINGS = /^(Near overtime|Asked \d+×|Long drive)/;
export const isWarningReason = (reason: string) => WARNINGS.test(reason);
export function ReasonChip({ reason }: { reason: string }) {
  const warning = WARNINGS.test(reason);
  const Icon = warning
    ? AlertCircle
    : reason.startsWith("Lives")
      ? MapPin
      : reason.startsWith("New") || reason.startsWith("Little history")
        ? Sparkles
        : reason.startsWith("Knows")
          ? HeartHandshake
          : reason.startsWith("Usually") || reason.startsWith("Has hours")
            ? Clock
            : TrendingUp;
  return (
    <span className={`reason-chip ${warning ? "warning" : ""}`}>
      <Icon />
      {reason}
    </span>
  );
}
export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="card-footer">
      <span>{children}</span>
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
export function StatTile({
  value,
  label,
  best = false,
}: {
  value: ReactNode;
  label: string;
  best?: boolean;
}) {
  return (
    <div className="stat-tile">
      <span className="big-number">{value}</span>
      {best && <Badge tone="neutral">Best</Badge>}
      <p>{label}</p>
    </div>
  );
}
export function PageSkeleton() {
  return (
    <div className="skeleton-page" role="status" aria-label="Loading data">
      {[0, 1, 2].map((n) => (
        <div key={n}>
          <div className="skeleton skeleton-line" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-block" />
          ))}
        </div>
      ))}
    </div>
  );
}
export const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const dayAndTime = (value: string) =>
  `${new Date(value).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${time(value)}`;
export const noticeLabel = (hours: number) =>
  hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : hours < 48 ? `${Math.round(hours * 10) / 10} h` : `${Math.round(hours / 24)} d`;
export const time = (value: string) =>
  new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
