import type { AnyExtension } from "@tiptap/core";

const networkNodes = new Set([
  "personalDatabaseReference", "transclusionReference", "base", "personalWidget",
  "image", "video", "audio", "attachment", "pdf", "drawio", "excalidraw", "embed", "subpages",
]);

/** Preserve every node and attribute while keeping remote editors/resources
 * out of the local document session. They remain available in the workspace. */
export function offlineExtensions(extensions: AnyExtension[], label: string): AnyExtension[] {
  return extensions.map((extension) => networkNodes.has(extension.name) ? extension.extend({
    addNodeView() {
      return () => {
        const dom = document.createElement("div");
        dom.contentEditable = "false";
        dom.textContent = label;
        dom.className = "offline-network-block";
        dom.style.cssText = "padding:12px;border:1px dashed var(--mantine-color-default-border);border-radius:4px;color:var(--mantine-color-dimmed);margin:8px 0";
        return { dom };
      };
    },
  }) : extension);
}
