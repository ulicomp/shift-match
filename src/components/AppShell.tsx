import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Radar,
  Users,
  CalendarCheck,
  FlaskConical,
  BookOpen,
  RotateCcw,
  Sparkles,
  Plus,
  Menu,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { InitialsAvatar, IconButton } from "./shared";
import { useEngineVersion, setDockOpen } from "./engineStore";
import { LogCancellationDialog } from "./LogCancellationDialog";
import { TopStats } from "./TopStats";
import { installElasticScroll } from "./elasticScroll";
import { getAgent, resetDemo, setAgentMode } from "@/lib/api";
import { AgentDock } from "./AgentDock";
import { AgentOrb } from "./AgentOrb";
import logoUrl from "@/assets/logo.webp";

function LogoMark({ size = 20 }: { size?: number }) {
  return <img src={logoUrl} width={size} height={size} alt="" aria-hidden="true" className="logo-img" />;
}
const tabs = [
  { to: "/", label: "Dispatch", icon: Radar },
  { to: "/caregivers", label: "Caregivers", icon: Users },
  { to: "/shifts", label: "Shifts", icon: CalendarCheck },
  { to: "/simulation", label: "Simulation", icon: FlaskConical },
  { to: "/agent", label: "Agent report", icon: Sparkles },
  { to: "/how-it-works", label: "How it works", icon: BookOpen },
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menu, setMenu] = useState(false);
  const [logging, setLogging] = useState(false);
  const agentState = getAgent();
  const agent = agentState.on;
  const agentRunning = agentState.run?.status === "running" || agentState.run?.status === "stopping";
  const queryClient = useQueryClient();
  const version = useEngineVersion();
  // Any engine change (offer answered, shift filled, new cancellation) refreshes every screen.
  useEffect(() => {
    if (version) void queryClient.invalidateQueries();
  }, [version, queryClient]);
  // Hosts like Amplify may add a trailing slash (/agent/), so normalize before matching.
  const cleanPath = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const title = tabs.find((t) => t.to === cleanPath)?.label ?? "Page not found";
  useEffect(() => {
    document.title = `${title} · Shift Match`;
  }, [title]);
  useEffect(() => installElasticScroll(), []);
  const reset = () =>
    toast("Reset the demo?", {
      description: "Brings back the original open shifts and clears today's offers.",
      action: {
        label: "Reset",
        onClick: () => {
          setDockOpen(false);
          resetDemo();
        },
      },
    });
  return (
    <div className="app-frame">
      <aside className="rail">
        <Link to="/" className="logo" aria-label="Shift Match home">
          <LogoMark size={48} />
        </Link>
        <nav className="rail-nav" aria-label="Main navigation">
          {tabs.map((t) => (
            <Tooltip key={t.to}>
              <TooltipTrigger asChild>
                <Button asChild variant="nav" size="icon">
                  <Link to={t.to} activeOptions={{ exact: true }} aria-label={t.label}>
                    <t.icon size={20} />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t.label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
        <div className="rail-bottom">
          <InitialsAvatar name="Alex Morgan" />
        </div>
      </aside>
      <div className="workspace">
        <div className="mobile-menu">
          <Link to="/" className="brand">
            <LogoMark size={28} />
            Shift Match
          </Link>
          <IconButton label="Open navigation" onClick={() => setMenu(true)}>
            <Menu />
          </IconButton>
        </div>
        <header className="top-bar">
          <h1 className="sr-only">{title}</h1>
          <TopStats />
          <div className="toolbar">
            <div className={`agent-switch ${agent ? "on" : ""}`}>
              <button
                type="button"
                className="agent-open"
                aria-label="Show the agent panel"
                onClick={() => setDockOpen(true)}
              >
                <AgentOrb size={22} active={agentRunning} asleep={!agent} />
                <span>Agent mode</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={agent}
                aria-label="Agent mode"
                className="agent-track"
                onClick={() => {
                  if (!agent) setDockOpen(true);
                  setAgentMode(!agent);
                }}
              >
                <span className="agent-knob" />
              </button>
            </div>
            <span className="utility">
              <IconButton label="Reset demo" onClick={reset}>
                <RotateCcw />
              </IconButton>
            </span>
            <Button onClick={() => setLogging(true)}>
              <Plus />
              Log cancellation
            </Button>
          </div>
        </header>
        <main className="page-content" data-elastic>{children}</main>
      </div>
      <AgentDock />
      <LogCancellationDialog open={logging} onOpenChange={setLogging} />
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left">
          <SheetTitle>Shift Match</SheetTitle>
          <SheetDescription>Miami home care agency · demo</SheetDescription>
          <nav className="nav-sheet" aria-label="Mobile navigation">
            {tabs.map((t) => (
              <Button key={t.to} asChild variant="nav">
                <Link to={t.to} activeOptions={{ exact: true }} onClick={() => setMenu(false)}>
                  <t.icon />
                  {t.label}
                </Link>
              </Button>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
