import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * A card that floats under (or above) its trigger. Renders into the open dialog when the
 * trigger lives in one, so it stays inside the dialog's focus trap and isn't clipped by
 * scrolling panels.
 */
export function FloatingPanel({
  anchor,
  open,
  onClose,
  children,
  minWidth = 0,
  className = "",
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  minWidth?: number;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number; above: boolean } | null>(null);
  const container = open ? (anchor.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body) : null;
  const inDialog = !!container && container !== document.body;

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const c = inDialog && container ? container.getBoundingClientRect() : { top: 0, left: 0 };
      const gap = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(a.width, minWidth), vw - gap * 2);
      const maxHeight = vh - gap * 2;
      const h = Math.min(panel.current?.scrollHeight ?? 0, maxHeight);
      // Below if it fits, else above if it fits, else pinned inside the viewport. Never off-screen.
      let top = a.bottom + gap;
      let above = false;
      if (top + h > vh - gap) {
        if (a.top - gap - h >= gap) {
          top = a.top - gap - h;
          above = true;
        } else top = Math.max(gap, vh - gap - h);
      }
      const left = Math.max(gap, Math.min(a.left, vw - width - gap));
      setPos({ top: top - c.top, left: left - c.left, width, maxHeight, above });
    };
    place();
    const frame = requestAnimationFrame(place);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    // Window + capture runs before Radix's own Escape handler, so Escape closes only this panel.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
        anchor.current?.focus();
      }
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, anchor, onClose, minWidth, inDialog, container]);

  if (!open || !container) return null;
  return createPortal(
    <div
      ref={panel}
      className={`floating-panel ${pos?.above ? "above" : ""} ${className}`}
      style={{
        position: inDialog ? "absolute" : "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: pos?.width,
        maxHeight: pos?.maxHeight,
        overflowY: "auto",
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    container,
  );
}
