import { Editor, JSONContent } from "@tiptap/core";

export const mediaLabel = (kind: string) =>
  ({
    image: "Image",
    video: "Video",
    audio: "Audio",
    pdf: "PDF",
    attachment: "File",
  })[kind] || "File";
export const mediaAccept = (kind: string) =>
  ({
    image: "image/*",
    video: "video/*",
    audio: "audio/*",
    pdf: "application/pdf",
  })[kind] || "*/*";
export function validateMediaFile(
  kind: string,
  file: Pick<File, "type" | "size">,
  limit: number,
): boolean {
  return (
    file.size <= limit &&
    (kind === "attachment" ||
      (kind === "pdf"
        ? file.type === "application/pdf"
        : ["image", "audio", "video"].includes(kind) &&
          file.type.startsWith(kind + "/")))
  );
}
export function replaceMediaPlaceholder(
  editor: Editor,
  getPos: () => number | undefined,
  pageId: string,
  id: string,
  kind: string,
  file: { id: string; fileName: string; fileSize: number; mimeType?: string },
): boolean {
  if (
    editor.isDestroyed ||
    !editor.isEditable ||
    editor.storage.pageId !== pageId
  )
    return false;
  const pos = getPos();
  if (typeof pos !== "number") return false;
  const live = editor.state.doc.nodeAt(pos);
  if (
    !live ||
    live.type.name !== "personalWidget" ||
    live.attrs.kind !== "media" ||
    live.attrs.id !== id ||
    live.attrs.provider !== kind
  )
    return false;
  const url = `/api/files/${file.id}/${encodeURIComponent(file.fileName)}`;
  const attrs = {
    attachmentId: file.id,
    size: file.fileSize,
    name: file.fileName,
    alt: file.fileName,
  };
  const content: JSONContent = {
    type: kind,
    attrs: {
      ...attrs,
      ...(kind === "attachment" ? { url, mime: file.mimeType } : { src: url }),
    },
  };
  return editor
    .chain()
    .focus()
    .insertContentAt({ from: pos, to: pos + live.nodeSize }, content)
    .run();
}
