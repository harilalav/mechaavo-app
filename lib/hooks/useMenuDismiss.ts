import { useEffect, type RefObject } from "react";

/**
 * An open menu closes on Escape (focus returns to its button) and on a press anywhere
 * outside `container`. Shared by the hero nav and the sticky bar's Menu buttons.
 */
export function useMenuDismiss(
  open: boolean,
  close: () => void,
  container: RefObject<HTMLElement | null>,
  button: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    const onPress = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [open, close, container, button]);
}
