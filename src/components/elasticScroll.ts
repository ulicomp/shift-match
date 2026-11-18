/**
 * Rubber-band overscroll: past the end of a scroll area the content stretches a little
 * with resistance, then springs back. Applies to any element marked data-elastic.
 * Safari already does this natively, so it's skipped there.
 */
const MAX_STRETCH = 56; // px
const RELEASE_AFTER = 140; // ms without input before springing back

const isScrollContainer = (el: HTMLElement) => {
  const o = getComputedStyle(el).overflowY;
  return o === "auto" || o === "scroll";
};

function elasticTarget(node: EventTarget | null): HTMLElement | null {
  let el = node instanceof Element ? node.closest<HTMLElement>("[data-elastic]") : null;
  while (el && !isScrollContainer(el)) el = el.parentElement?.closest<HTMLElement>("[data-elastic]") ?? null;
  return el;
}

const atEdge = (el: HTMLElement, dy: number) =>
  dy > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1 : el.scrollTop <= 0;

export function installElasticScroll(): () => void {
  const ua = navigator.userAgent;
  const nativeBounce = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  if (nativeBounce || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const offsets = new WeakMap<HTMLElement, { offset: number; timer: number }>();

  const set = (el: HTMLElement, offset: number, release: boolean) => {
    el.classList.toggle("elastic-release", release);
    el.style.setProperty("--elastic", `${-offset}px`);
  };
  const release = (el: HTMLElement) => {
    const s = offsets.get(el);
    if (!s) return;
    s.offset = 0;
    set(el, 0, true);
  };
  const stretch = (el: HTMLElement, delta: number) => {
    const s = offsets.get(el) ?? { offset: 0, timer: 0 };
    offsets.set(el, s);
    // Pulling back toward the content relaxes the stretch right away.
    if (s.offset !== 0 && Math.sign(delta) !== Math.sign(s.offset)) return release(el);
    const resistance = 1 - Math.min(1, Math.abs(s.offset) / MAX_STRETCH);
    s.offset = Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, s.offset + delta * 0.3 * resistance));
    set(el, s.offset, false);
    window.clearTimeout(s.timer);
    s.timer = window.setTimeout(() => release(el), RELEASE_AFTER);
  };

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    const el = elasticTarget(e.target);
    if (el && atEdge(el, e.deltaY)) stretch(el, e.deltaY * (e.deltaMode === 1 ? 16 : 1));
  };

  let touchY: number | null = null;
  let touchEl: HTMLElement | null = null;
  const onTouchStart = (e: TouchEvent) => {
    touchY = e.touches[0]?.clientY ?? null;
    touchEl = elasticTarget(e.target);
  };
  const onTouchMove = (e: TouchEvent) => {
    const y = e.touches[0]?.clientY;
    if (touchY === null || y === undefined || !touchEl) return;
    const dy = touchY - y;
    touchY = y;
    if (atEdge(touchEl, dy)) {
      const s = offsets.get(touchEl);
      stretch(touchEl, dy * 1.6);
      if (s) window.clearTimeout(s.timer); // hold while the finger is down
    }
  };
  const onTouchEnd = () => {
    if (touchEl) release(touchEl);
    touchY = null;
    touchEl = null;
  };

  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("touchcancel", onTouchEnd);
  return () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
  };
}
