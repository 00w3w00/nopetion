import { imageDimensionsFromData } from 'image-dimensions';
import { MediaUploadOptions, UploadFn, captureUploadPosition } from '../media-utils';
import { IAttachment } from '../types';
import { generateNodeId } from '../utils';
import { Node } from '@tiptap/pm/model';
import { Command } from '@tiptap/core';

const findImageNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (
      node.type.name === 'image' &&
      node.attrs.placeholder?.id === placeholderId
    ) {
      result = { node, pos };
      return false;
    }
    return true;
  });

  return result;
};
const handleImageUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, editor, pos, pageId) => {
    // check if the file is an image
    const validated = validateFn ? validateFn(file) : true;
    if (!validated || editor.isDestroyed || !editor.isEditable || editor.storage.pageId !== pageId) return;
    const anchor = captureUploadPosition(editor, pos, pageId);

    const objectUrl = URL.createObjectURL(file);

    const imageDimensions = imageDimensionsFromData(
      new Uint8Array(await file.arrayBuffer()),
    );

    const placeholderId = generateNodeId();
    const width = imageDimensions?.width ?? undefined;
    const height = imageDimensions?.height ?? undefined;
    const aspectRatio = imageDimensions
      ? imageDimensions.width / imageDimensions.height
      : undefined;

    let placeholderInserted = false;

    editor.storage.shared.imagePreviews =
      editor.storage.shared.imagePreviews || {};
    editor.storage.shared.imagePreviews[placeholderId] = objectUrl;

    const insertPlaceholder = (): Command => {
      return ({ tr, state }) => {
        const initialPlaceholderNode = state.schema.nodes.image?.create({
          placeholder: {
            id: placeholderId,
            name: file.name,
          },
          width,
          height,
          aspectRatio,
        });

        const currentPos = anchor.current();
        if (!initialPlaceholderNode || currentPos === undefined) return false;

        const { parent } = tr.doc.resolve(currentPos);
        const isEmptyTextBlock = parent.isTextblock && !parent.childCount;

        if (isEmptyTextBlock) {
          // Replace e.g. empty paragraph with the image
          tr.replaceRangeWith(currentPos - 1, currentPos + 1, initialPlaceholderNode);
        } else {
          tr.insert(currentPos, initialPlaceholderNode);
        }

        return true;
      };
    };
    const replacePlaceholderWithImage = (attachment: IAttachment): Command => {
      return ({ tr }) => {
        if (anchor.current() === undefined) return false;
        const { pos: currentPos = null } =
          findImageNodeByPlaceholderId(tr.doc, placeholderId) || {};

        //  If the placeholder is not found or attachment is missing, abort the process
        if (currentPos === null || !attachment) return false;

        // Update the placeholder node with the actual image data
        tr.setNodeMarkup(currentPos, undefined, {
          src: `/api/files/${attachment.id}/${attachment.fileName}`,
          attachmentId: attachment.id,
          size: attachment.fileSize,
          width,
          height,
          aspectRatio,
        });

        return true;
      };
    };
    const removePlaceholder = (): Command => {
      return ({ tr }) => {
        if (editor.isDestroyed || editor.storage.pageId !== pageId) return false;
        const { pos: currentPos = null, node: placeholderNode } =
          findImageNodeByPlaceholderId(tr.doc, placeholderId) || {};

        if (currentPos === null) return false;

        // Remove the placeholder node
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
    const disposePreviewFile = () => {
      URL.revokeObjectURL(objectUrl);

      if (editor.storage.shared.imagePreviews) {
        delete editor.storage.shared.imagePreviews[placeholderId];
      }
    };

    try {
      if (anchor.current() === undefined) return;
      const attachment: IAttachment = await onUpload(file, pageId);

      clearTimeout(insertPlaceholderTimeout);

      if (anchor.current() === undefined) return;
      if (placeholderInserted) {
        editor.commands.command(replacePlaceholderWithImage(attachment));
      } else {
        editor
          .chain()
          .command(insertPlaceholder())
          .command(replacePlaceholderWithImage(attachment))
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

export { handleImageUpload };
