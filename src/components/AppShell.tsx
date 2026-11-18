import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Radar,
  Users,
  CalendarCheck,
  FlaskConical,
  BookOpen,
  Search,
  SlidersHorizontal,
  Bell,
  Settings,
  HelpCircle,
  Plus,
  Menu,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { InitialsAvatar, IconButton } from "./shared";
import { useGlobalSearch, setGlobalSearch } from "./searchStore";

function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </svg>
  );
}
const tabs = [
  { to: "/", label: "Dispatch", icon: Radar },
  { to: "/caregivers", label: "Caregivers", icon: Users },
  { to: "/shifts", label: "Shifts", icon: CalendarCheck },
  { to: "/simulation", label: "Simulation", icon: FlaskConical },
  { to: "/how-it-works", label: "How it works", icon: BookOpen },
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menu, setMenu] = useState(false);
  const search = useGlobalSearch();
  const setSearch = setGlobalSearch;
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const title = tabs.find((t) => t.to === path)?.label ?? "Page not found";
  const prototype = () => toast("This is a prototype. No notifications or settings are connected.");
  return (
    <div className="app-frame">
      <aside className="rail">
        <Link to="/" className="logo" aria-label="Shift Match home">
          <LogoMark size={21} />
        </Link>
        <nav className="rail-nav" aria-label="Main navigation">
          {tabs.map((t) => (
            <Tooltip key={t.to}>
              <TooltipTrigger asChild>
                <Button asChild variant="nav" size="icon">
                  <Link to={t.to} activeOptions={{ exact: true }} aria-label={t.label}>
                    <t.icon size={18} />
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
            <span className="logo">
              <LogoMark size={20} />
            </span>
            Shift Match
          </Link>
          <IconButton label="Open navigation" onClick={() => setMenu(true)}>
            <Menu />
          </IconButton>
        </div>
        <header className="top-bar">
          <div className="page-name">
            <span className="text-muted-foreground text-[11px]">Shift Match</span>
            <h1>{title}</h1>
          </div>
          <form
            className="search-pill"
            onSubmit={(e) => {
              e.preventDefault();
              if (path !== "/caregivers")
                toast(
                  search
                    ? `Search for “${search}” in the Caregivers tab.`
                    : "Enter a caregiver or client name.",
                );
            }}
          >
            <Search size={15} className="text-muted-foreground" />
            <input
              ref={searchRef}
              aria-label="Search caregivers or clients"
              placeholder="Search caregivers or clients"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd className="search-kbd">⌘K</kbd>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Search filters"
              onClick={() => toast("Skill and payer filters are available in Caregivers.")}
              type="button"
            >
              <SlidersHorizontal />
            </Button>
          </form>
          <div className="toolbar">
            <span className="prototype">Prototype · mock data</span>
            <span className="utility">
              <IconButton label="Notifications" onClick={prototype}>
                <Bell />
              </IconButton>
            </span>
            <span className="utility">
              <IconButton label="Settings" onClick={prototype}>
                <Settings />
              </IconButton>
            </span>
            <span className="utility">
              <Button asChild variant="circle" size="icon">
                <Link to="/how-it-works" aria-label="Help">
                  <HelpCircle />
                </Link>
              </Button>
            </span>
            <Button onClick={() => toast("Prototype only — cancellations use local sample data.")}>
              <Plus />
              Log cancellation
            </Button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left">
          <SheetTitle>Shift Match</SheetTitle>
          <SheetDescription>Miami Home Care</SheetDescription>
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
