import { Node } from "@tiptap/pm/model";
import { MediaUploadOptions, UploadFn, captureUploadPosition } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Command } from "@tiptap/core";

const findAttachmentNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (
      node.type.name === "attachment" &&
      node.attrs.placeholder?.id === placeholderId
    ) {
      result = { node, pos };
      return false;
    }
    return true;
  });

  return result;
};
const handleAttachmentUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, editor, pos, pageId, allowMedia) => {
    const validated = validateFn ? validateFn(file, allowMedia) : true;
    if (!validated || editor.isDestroyed || !editor.isEditable || editor.storage.pageId !== pageId) return;
    const anchor = captureUploadPosition(editor, pos, pageId);

    const placeholderId = generateNodeId();

    let placeholderInserted = false;

    const insertPlaceholder = (): Command => {
      return ({ tr, state }) => {
        const initialPlaceholderNode = state.schema.nodes.attachment?.create({
          placeholder: {
            id: placeholderId,
          },
          name: file.name,
          size: file.size,
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
    const replacePlaceholderWithAttachment = (
      attachment: IAttachment,
    ): Command => {
      return ({ tr }) => {
        if (anchor.current() === undefined) return false;
        const { pos: currentPos = null } =
          findAttachmentNodeByPlaceholderId(tr.doc, placeholderId) || {};

        //  If the placeholder is not found or attachment is missing, abort the process
        if (currentPos === null || !attachment) return false;

        // Update the placeholder node with the actual attachment data
        tr.setNodeMarkup(currentPos, undefined, {
          url: `/api/files/${attachment.id}/${attachment.fileName}`,
          name: attachment.fileName,
          mime: attachment.mimeType,
          size: attachment.fileSize,
          attachmentId: attachment.id,
        });

        return true;
      };
    };
    const removePlaceholder = (): Command => {
      return ({ tr }) => {
        if (editor.isDestroyed || editor.storage.pageId !== pageId) return false;
        const { pos: currentPos = null, node: placeholderNode } =
          findAttachmentNodeByPlaceholderId(tr.doc, placeholderId) || {};

        if (currentPos === null) return false;

        tr.delete(currentPos, currentPos + placeholderNode.nodeSize);

        return true;
      };
    };
    // Only show the placeholder if the upload takes more than 250ms
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
        editor.commands.command(replacePlaceholderWithAttachment(attachment));
      } else {
        editor
          .chain()
          .command(insertPlaceholder())
          .command(replacePlaceholderWithAttachment(attachment))
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

export { handleAttachmentUpload };
