import { logicalLink } from "@/lib/app-path";
import type { ReactMarkViewRendererOptions } from "@tiptap/react";

// Browser input can land beside the nested contentDOM at a link boundary.
// Reparse the native anchor and adjacent text instead of dropping mutations
// outside React's inner content span. Popover attribute updates are UI only.
export const linkMarkViewOptions: Partial<ReactMarkViewRendererOptions> = {
  ignoreMutation: ({ mutation }) => {
    if (mutation.type === "selection") return false;
    if (mutation.type === "attributes") return true;
    const target = mutation.target.nodeType === Node.ELEMENT_NODE
      ? mutation.target as Element : mutation.target.parentElement;
    const content = target?.closest("[data-mark-view-content]")?.firstElementChild;
    if (content?.contains(mutation.target)) return false;
    if (mutation.type === "characterData") return false;
    // React mounts/moves the wrapper and content span asynchronously. Parsing
    // those structural changes can read a temporarily empty renderer. Native
    // boundary typing adds/removes text nodes outside that span instead.
    return ![...mutation.addedNodes, ...mutation.removedNodes].some(node => {
      if (node.nodeType === Node.TEXT_NODE) return true;
      if (node.nodeType !== Node.ELEMENT_NODE || !node.textContent) return false;
      const element = node as Element;
      // Native composition may wrap its text. React's content mount and its
      // ancestors contain the dedicated content marker and must stay ignored.
      return !element.matches("[data-mark-view-content]")
        && !element.querySelector("[data-mark-view-content]")
        && !target?.matches("[data-mark-view-content]");
    });
  },
};

export function parseEditableLinkHref(element: HTMLElement): string {
  const href = element.getAttribute("href") || "";
  return element.getAttribute("data-internal") === "true" ? logicalLink(href) : href;
}

export function extendEditableLinkSchema(extension: { name: string }) {
  return extension.name === "link" ? { reparseInView: true } : {};
}
