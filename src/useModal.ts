import { useCallback } from "react";

export function useModal() {
  return useCallback((node: HTMLDialogElement | null) => {
    if (!node) return;
    const trigger = document.activeElement;
    if (!node.open) node.showModal();
    node.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      // Removing a dialog removes it from the top layer. Closing it here also
      // queues a close event during StrictMode's connected ref rehearsal,
      // which would dismiss the dialog immediately after it opens again.
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);
}
