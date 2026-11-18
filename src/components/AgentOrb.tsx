import { useEffect, useState, type CSSProperties } from "react";

/**
 * The agent's face: a blue circle with two eyes that glance around on their own and blink,
 * like a little pet. It looks around more often while the agent is working.
 */
export function AgentOrb({ size = 34, active = false, className = "" }: { size?: number; active?: boolean; className?: string }) {
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(() => alive && fn(), ms));

    const glance = () => {
      const r = Math.random();
      // Mostly side to side, sometimes up or down, often back to center.
      const next =
        r < 0.3 ? { x: -1, y: 0 } : r < 0.6 ? { x: 1, y: 0 } : r < 0.72 ? { x: 0, y: -0.6 } : r < 0.8 ? { x: 0.6, y: 0.5 } : { x: 0, y: 0 };
      setLook(next);
      later(glance, (active ? 500 : 1300) + Math.random() * (active ? 900 : 2200));
    };
    const doBlink = () => {
      setBlink(true);
      later(() => setBlink(false), 120);
      if (Math.random() < 0.25) {
        later(() => setBlink(true), 260);
        later(() => setBlink(false), 380);
      }
      later(doBlink, 2200 + Math.random() * 3200);
    };
    later(glance, 400);
    later(doBlink, 900 + Math.random() * 1500);
    return () => {
      alive = false;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [active]);

  const style = {
    width: size,
    height: size,
    "--look-x": `${look.x * size * 0.12}px`,
    "--look-y": `${look.y * size * 0.1}px`,
  } as CSSProperties;

  return (
    <span className={`buddy ${active ? "active" : ""} ${className}`} style={style} aria-hidden="true">
      <span className="buddy-eyes">
        <span className={`buddy-eye ${blink ? "blink" : ""}`} />
        <span className={`buddy-eye ${blink ? "blink" : ""}`} />
      </span>
    </span>
  );
}
