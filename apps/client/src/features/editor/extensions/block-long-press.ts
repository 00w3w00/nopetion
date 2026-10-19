/** Touch/keyboard access to block actions. Never consume ordinary scrolling. */
export function installBlockLongPress(element: HTMLElement, open: (x: number, y: number) => boolean, editable: () => boolean) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { id: number; x: number; y: number } | undefined;
  let consumed = false;
  const cancel = () => { clearTimeout(timer); timer = undefined; start = undefined; };
  const down = (event: PointerEvent) => {
    cancel(); consumed = false;
    if (event.pointerType !== "touch" || !event.isPrimary || !editable() ||
      (event.target as Element).closest("button,input,textarea,select,a,[data-no-block-menu]")) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      if (start && editable()) consumed = open(start.x, start.y);
      cancel();
    }, 550);
  };
  const move = (event: PointerEvent) => {
    if (start && (start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8)) cancel();
  };
  const click = (event: MouseEvent) => { if (consumed) { event.preventDefault(); event.stopPropagation(); consumed = false; } };
  const context = (event: Event) => { if (consumed) event.preventDefault(); };
  // Cancel compatibility mouse events only for a completed long press. Otherwise
  // the generated mousedown is treated as an outside click and closes the menu
  // as soon as the finger leaves the editor. Ordinary taps/scrolling stay native.
  const touchEnd = (event: TouchEvent) => { if (consumed) { event.preventDefault(); event.stopPropagation(); } };
  element.addEventListener("pointerdown", down, { passive: true });
  element.addEventListener("pointermove", move, { passive: true });
  element.addEventListener("pointerup", cancel, { passive: true });
  element.addEventListener("pointercancel", cancel, { passive: true });
  element.addEventListener("click", click, true);
  element.addEventListener("contextmenu", context);
  element.addEventListener("touchend", touchEnd, { capture: true, passive: false });
  window.addEventListener("scroll", cancel, true);
  return () => {
    cancel(); element.removeEventListener("pointerdown", down); element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", cancel); element.removeEventListener("pointercancel", cancel);
    element.removeEventListener("click", click, true); element.removeEventListener("contextmenu", context);
    element.removeEventListener("touchend", touchEnd, true);
    window.removeEventListener("scroll", cancel, true);
  };
}
