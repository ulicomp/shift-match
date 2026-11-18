import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * The agent's face: a blue circle with two eyes that glance around on their own and blink,
 * like a little pet. It looks around more often while the agent is working.
 * Asleep, its eyes stay shut and it breathes slowly; when it wakes, the eyes open slowly,
 * it blinks twice, then starts looking around.
 */
export function AgentOrb({
  size = 34,
  active = false,
  asleep = false,
  wakeOnMount = false,
  showZ = true,
  className = "",
}: {
  size?: number;
  active?: boolean;
  asleep?: boolean;
  /** Start with the eyes shut and open them right away (used when the panel appears). */
  wakeOnMount?: boolean;
  /** Little "z z" floating up while asleep. */
  showZ?: boolean;
  className?: string;
}) {
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  // Eyes shut: while asleep, and for a moment on mount when the panel wakes the agent.
  const [shut, setShut] = useState(asleep || wakeOnMount);
  const [waking, setWaking] = useState(false);
  const wasAsleep = useRef(asleep || wakeOnMount);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let alive = true;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(() => alive && fn(), ms));

    if (asleep) {
      wasAsleep.current = true;
      setShut(true);
      setLook({ x: 0, y: 0 });
      return () => {
        alive = false;
      };
    }
    if (reduced) {
      setShut(false);
      return () => {
        alive = false;
      };
    }

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

    let start = 0;
    if (wasAsleep.current) {
      // Waking up: slow eye-open, a sleepy double blink, then back to normal.
      wasAsleep.current = false;
      setWaking(true);
      later(() => setShut(false), 260);
      later(() => setWaking(false), 1000);
      later(() => setBlink(true), 1150);
      later(() => setBlink(false), 1260);
      later(() => setBlink(true), 1400);
      later(() => setBlink(false), 1510);
      start = 1500;
    } else setShut(false);

    later(glance, start + 400);
    later(doBlink, start + 2200 + Math.random() * 1500);
    return () => {
      alive = false;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [active, asleep]);

  const style = {
    width: size,
    height: size,
    "--look-x": `${look.x * size * 0.12}px`,
    "--look-y": `${look.y * size * 0.1}px`,
    "--lid": `${Math.max(2, Math.round(size * 0.07 * 10) / 10)}px`,
  } as CSSProperties;
  const wrapStyle = { fontSize: Math.max(8, Math.round(size * 0.3)) } as CSSProperties;

  const eye = `buddy-eye ${blink || shut ? "blink" : ""}`;
  return (
    <span className="buddy-wrap" style={wrapStyle} aria-hidden="true">
      <span
        className={`buddy ${active ? "active" : ""} ${asleep ? "asleep" : ""} ${waking ? "waking" : ""} ${className}`}
        style={style}
      >
        <span className="buddy-eyes">
          <span className={eye} />
          <span className={eye} />
        </span>
      </span>
      {asleep && showZ && (
        <span className="buddy-z">
          <i>z</i>
          <i>z</i>
        </span>
      )}
    </span>
  );
}
