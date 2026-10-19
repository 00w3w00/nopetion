import { MediaUploadOptions, UploadFn, captureUploadPosition } from "../media-utils";
import { IAttachment } from "../types";
import { generateNodeId } from "../utils";
import { Node } from "@tiptap/pm/model";
import { Command } from "@tiptap/core";

const findVideoNodeByPlaceholderId = (
  doc: Node,
  placeholderId: string,
): { node: Node; pos: number } | null => {
  let result: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;

    if (
      node.type.name === "video" &&
      node.attrs.placeholder?.id === placeholderId
    ) {
      result = { node, pos };
      return false;
    }

    return true;
  });

  return result;
};
const getVideoDimensions = (
  url: string,
): Promise<
  { width: number; height: number; aspectRatio: number } | undefined
> => {
  return new Promise<
    { width: number; height: number; aspectRatio: number } | undefined
  >((resolve) => {
    const video = document.createElement("video");

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const aspectRatio = height > 0 ? width / height : 1;

      resolve({ width, height, aspectRatio });
    };
    video.onerror = () => {
      resolve(undefined);
    };
    video.src = url;
  });
};
const handleVideoUpload =
  ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
  async (file, editor, pos, pageId) => {
    // check if the file is valid
    const validated = validateFn ? validateFn(file) : true;
    if (!validated || editor.isDestroyed || !editor.isEditable || editor.storage.pageId !== pageId) return;
    const anchor = captureUploadPosition(editor, pos, pageId);

    const objectUrl = URL.createObjectURL(file);
    const videoDimensions = await getVideoDimensions(objectUrl);
    const placeholderId = generateNodeId();
    const width = videoDimensions?.width ?? undefined;
    const height = videoDimensions?.height ?? undefined;
    const aspectRatio = videoDimensions?.aspectRatio;

    let placeholderInserted = false;

    editor.storage.shared.videoPreviews =
      editor.storage.shared.videoPreviews || {};
    editor.storage.shared.videoPreviews[placeholderId] = objectUrl;

    const insertPlaceholder = (): Command => {
      return ({ tr, state }) => {
        const initialPlaceholderNode = state.schema.nodes.video?.create({
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
          // Replace e.g. empty paragraph with the video
          tr.replaceRangeWith(currentPos - 1, currentPos + 1, initialPlaceholderNode);
        } else {
          tr.insert(currentPos, initialPlaceholderNode);
        }

        return true;
      };
    };
    const replacePlaceholderWithVideo = (attachment: IAttachment): Command => {
      return ({ tr }) => {
        if (anchor.current() === undefined) return false;
        const { pos: currentPos = null } =
          findVideoNodeByPlaceholderId(tr.doc, placeholderId) || {};

        //  If the placeholder is not found or attachment is missing, abort the process
        if (currentPos === null || !attachment) return;

        // Update the placeholder node with the actual video data
        tr.setNodeMarkup(currentPos, undefined, {
          src: `/api/files/${attachment.id}/${attachment.fileName}`,
          attachmentId: attachment.id,
          title: attachment.fileName,
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
          findVideoNodeByPlaceholderId(tr.doc, placeholderId) || {};

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
    const disposePreviewFile = () => {
      URL.revokeObjectURL(objectUrl);

      if (editor.storage.shared.videoPreviews) {
        delete editor.storage.shared.videoPreviews[placeholderId];
      }
    };

    try {
      if (anchor.current() === undefined) return;
      const attachment: IAttachment = await onUpload(file, pageId);

      clearTimeout(insertPlaceholderTimeout);

      if (anchor.current() === undefined) return;
      if (placeholderInserted) {
        editor.commands.command(replacePlaceholderWithVideo(attachment));
      } else {
        editor
          .chain()
          .command(insertPlaceholder())
          .command(replacePlaceholderWithVideo(attachment))
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

export { handleVideoUpload };
