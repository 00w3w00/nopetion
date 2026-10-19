import { MediaUploadOptions, UploadFn, captureUploadPosition } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Node } from "@tiptap/pm/model";
import { Command } from "@tiptap/core";

const findAudioNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;

    if (
      node.type.name === "audio" &&
      node.attrs.placeholder?.id === placeholderId
    ) {
      result = { node, pos };
      return false;
    }

    return true;
  });

  return result;
};

const handleAudioUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, editor, pos, pageId) => {
    const validated = validateFn ? validateFn(file) : true;
    if (!validated || editor.isDestroyed || !editor.isEditable || editor.storage.pageId !== pageId) return;
    const anchor = captureUploadPosition(editor, pos, pageId);

    const objectUrl = URL.createObjectURL(file);
    const placeholderId = generateNodeId();

    let placeholderInserted = false;

    editor.storage.shared.audioPreviews =
      editor.storage.shared.audioPreviews || {};
    editor.storage.shared.audioPreviews[placeholderId] = objectUrl;

    const insertPlaceholder = (): Command => {
      return ({ tr, state }) => {
        const initialPlaceholderNode = state.schema.nodes.audio?.create({
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

    const replacePlaceholderWithAudio = (attachment: IAttachment): Command => {
      return ({ tr }) => {
        if (anchor.current() === undefined) return false;
        const { pos: currentPos = null } =
          findAudioNodeByPlaceholderId(tr.doc, placeholderId) || {};

        if (currentPos === null || !attachment) return;

        tr.setNodeMarkup(currentPos, undefined, {
          src: `/api/files/${attachment.id}/${attachment.fileName}`,
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
          findAudioNodeByPlaceholderId(tr.doc, placeholderId) || {};

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

    const disposePreviewFile = () => {
      URL.revokeObjectURL(objectUrl);

      if (editor.storage.shared.audioPreviews) {
        delete editor.storage.shared.audioPreviews[placeholderId];
      }
    };

    try {
      if (anchor.current() === undefined) return;
      const attachment: IAttachment = await onUpload(file, pageId);

      clearTimeout(insertPlaceholderTimeout);

      if (anchor.current() === undefined) return;
      if (placeholderInserted) {
        editor.commands.command(replacePlaceholderWithAudio(attachment));
      } else {
        editor
          .chain()
          .command(insertPlaceholder())
          .command(replacePlaceholderWithAudio(attachment))
          .run();
      }
    } catch (error) {
      clearTimeout(insertPlaceholderTimeout);

      editor.commands.command(removePlaceholder());
    } finally {
      clearTimeout(insertPlaceholderTimeout);
      disposePreviewFile();
      anchor.release();
    }
  };

export { handleAudioUpload };
