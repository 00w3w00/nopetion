import { MediaUploadOptions, UploadFn, captureUploadPosition } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Node } from "@tiptap/pm/model";
import { Command } from "@tiptap/core";

const findPdfNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;

    if (
      node.type.name === "pdf" &&
      node.attrs.placeholder?.id === placeholderId
    ) {
      result = { node, pos };
      return false;
    }

    return true;
  });

  return result;
};

const handlePdfUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, editor, pos, pageId) => {
    const validated = validateFn ? validateFn(file) : true;
    if (!validated || editor.isDestroyed || !editor.isEditable || editor.storage.pageId !== pageId) return;
    const anchor = captureUploadPosition(editor, pos, pageId);

    const placeholderId = generateNodeId();

    let placeholderInserted = false;

    const insertPlaceholder = (): Command => {
      return ({ tr, state }) => {
        const initialPlaceholderNode = state.schema.nodes.pdf?.create({
          placeholder: {
            id: placeholderId,
            name: file.name,
          },
        });

        const currentPos = anchor.current();
        if (!initialPlaceholderNode || currentPos === undefined) return false;

        const { parent } = tr.doc.resolve(currentPos);
        const isEmptyTextBlock = parent.isTextblock && !parent.childCount;

        if (isEmptyTextBlock) {
          tr.replaceRangeWith(currentPos - 1, currentPos + 1, initialPlaceholderNode);
        } else {
          tr.insert(currentPos, initialPlaceholderNode);
        }

        return true;
      };
    };

    const replacePlaceholderWithPdf = (attachment: IAttachment): Command => {
      return ({ tr }) => {
        if (anchor.current() === undefined) return false;
        const { pos: currentPos = null } =
          findPdfNodeByPlaceholderId(tr.doc, placeholderId) || {};

        if (currentPos === null || !attachment) return;

        tr.setNodeMarkup(currentPos, undefined, {
          src: `/api/files/${attachment.id}/${attachment.fileName}`,
          name: attachment.fileName,
          attachmentId: attachment.id,
          size: attachment.fileSize,
        });

        return true;
      };
    };

    const removePlaceholder = (): Command => {
      return ({ tr }) => {
        if (editor.isDestroyed || editor.storage.pageId !== pageId) return false;
        const { pos: currentPos = null, node: placeholderNode } =
          findPdfNodeByPlaceholderId(tr.doc, placeholderId) || {};

        if (currentPos === null) return false;

        tr.delete(currentPos, currentPos + placeholderNode.nodeSize);

        return true;
      };
    };

    const insertPlaceholderTimeout = setTimeout(() => {
      if (anchor.current() !== undefined) {
        placeholderInserted = editor.commands.command(insertPlaceholder());
      }
    }, 250);

    try {
      if (anchor.current() === undefined) return;
      const attachment: IAttachment = await onUpload(file, pageId);

      clearTimeout(insertPlaceholderTimeout);

      if (anchor.current() === undefined) return;
      if (placeholderInserted) {
        editor.commands.command(replacePlaceholderWithPdf(attachment));
      } else {
        editor
          .chain()
          .command(insertPlaceholder())
          .command(replacePlaceholderWithPdf(attachment))
          .run();
      }
    } catch (error) {
      clearTimeout(insertPlaceholderTimeout);
      editor.commands.command(removePlaceholder());
    } finally {
      clearTimeout(insertPlaceholderTimeout);
      anchor.release();
    }
  };

export { handlePdfUpload };
