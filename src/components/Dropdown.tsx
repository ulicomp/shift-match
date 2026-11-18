import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { FloatingPanel } from "./FloatingPanel";

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  label,
  prefix,
  className = "",
  menuWidth = 220,
  placeholder = "Choose…",
}: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  label: string;
  prefix?: string;
  className?: string;
  menuWidth?: number;
  placeholder?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [active, setActive] = useState(Math.max(0, selectedIndex));
  const selected = options[selectedIndex];
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, selectedIndex));
    requestAnimationFrame(() => list.current?.focus());
  }, [open, selectedIndex]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    onChange(o.value);
    setOpen(false);
    trigger.current?.focus();
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(last, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`dropdown-trigger ${open ? "open" : ""} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
      >
        <span className="dropdown-value">
          {prefix && <span className="dropdown-prefix">{prefix}</span>}
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="dropdown-chevron" />
      </button>
      <FloatingPanel anchor={trigger} open={open} onClose={close} minWidth={menuWidth}>
        <ul
          ref={list}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          className="dropdown-menu"
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={String(o.value)}
              id={`${id}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              className={`dropdown-option ${i === active ? "active" : ""}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span>
                {o.label}
                {o.hint && <small>{o.hint}</small>}
              </span>
              {o.value === value && <Check />}
            </li>
          ))}
        </ul>
      </FloatingPanel>
    </>
  );
}
