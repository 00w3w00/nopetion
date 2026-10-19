import "@/features/editor/styles/index.css";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useAtomValue } from "jotai";
import {
  currentPageEditModeAtom,
  pageEditorAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import {
  updatePageData,
  useUpdateTitlePageMutation,
} from "@/features/page/queries/page-query";
import { useDebouncedCallback, getHotkeyHandler } from "@mantine/hooks";
import { useAtom } from "jotai";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { History } from "@tiptap/extension-history";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import EmojiCommand from "@/features/editor/extensions/emoji-command.ts";
import { UpdateEvent } from "@/features/websocket/types";
import localEmitter from "@/lib/local-emitter.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { searchSpotlight } from "@/features/search/constants.ts";
import { platformModifierKey } from "@/lib";
import { useSetAtom } from "jotai";
import { titleSaveStateAtom } from "@/features/personal/save-status";
import { isPersonalMode } from "@/lib/config";
import { createSerialSave } from "@/features/personal/serial-save";
import { getPageById } from "@/features/page/services/page-service";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { acknowledgeOfflineTitle, offlineEnabled, offlineKey, storeOfflineTitle } from "@/features/offline/offline-store";

export interface TitleEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  spaceSlug: string;
  editable: boolean;
  isBase?: boolean;
}

export function TitleEditor({
  pageId,
  slugId,
  title,
  spaceSlug,
  editable,
  isBase,
}: TitleEditorProps) {
  const { t } = useTranslation();
  const { mutateAsync: updateTitlePageMutationAsync } =
    useUpdateTitlePageMutation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const identity = useAtomValue(currentUserAtom);
  const offlinePageKey = identity?.accountId ? offlineKey(identity.accountId, identity.workspace.id, pageId) : "";
  const [, setTitleEditor] = useAtom(titleEditorAtom);
  const emit = useQueryEmit();
  const navigate = useNavigate();
  const [activePageId, setActivePageId] = useState(pageId);
  const currentPageEditMode = useAtomValue(currentPageEditModeAtom);
  const setTitleSave = useSetAtom(titleSaveStateAtom);
  const titleSession = useRef<{ persisted: string | null; pending: number }>({
    persisted: isPersonalMode() ? null : title || "",
    pending: 0,
  });
  const queuedTitleSave = useRef(
    createSerialSave(updateTitlePageMutationAsync),
  );

  const titleEditor = useEditor({
    extensions: [
      Document.extend({
        content: "heading",
      }),
      Heading.configure({
        levels: [1],
      }),
      Text,
      Placeholder.configure({
        placeholder: isBase ? t("Untitled base") : t("Untitled"),
        showOnlyWhenEditable: false,
      }),
      History.configure({
        depth: 20,
      }),
      EmojiCommand,
    ],
    onCreate({ editor }) {
      if (editor) {
        editor.storage.pageId = pageId;
        setTitleEditor(editor);
        setActivePageId(pageId);
      }
    },
    onUpdate({ editor }) {
      if (isPersonalMode()) setTitleSave({ pageId, state: "saving" });
      if (isPersonalMode() && offlinePageKey && offlineEnabled()) {
        void storeOfflineTitle(offlinePageKey, editor.getText()).catch(() => {});
      }
      debounceUpdate();
    },
    editable: editable,
    content: title,
    textDirection: "auto",
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        "aria-label": t("Page title"),
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          if (event.isComposing || event.keyCode === 229) return false;
          if (platformModifierKey(event) && event.code === "KeyS") {
            event.preventDefault();
            return true;
          }
          if (platformModifierKey(event) && event.code === "KeyK") {
            searchSpotlight.open();
            return true;
          }
        },
      },
    },
  });

  useLayoutEffect(() => {
    if (!titleEditor || titleEditor.isDestroyed) return;
    titleEditor.storage.pageId = pageId;
    setTitleEditor(titleEditor);
    const clearEditor = () => {
      setTitleEditor((current) => (current === titleEditor ? null : current));
    };
    titleEditor.on("destroy", clearEditor);
    return () => {
      titleEditor.off("destroy", clearEditor);
      clearEditor();
    };
  }, [titleEditor, pageId, setTitleEditor]);

  useEffect(() => {
    if (!isPersonalMode() || !titleEditor) return;
    let cancelled = false;
    setTitleSave({ pageId, state: "connecting" });
    getPageById({ pageId })
      .then((page) => {
        if (
          cancelled ||
          titleEditor.isDestroyed ||
          titleSession.current.pending > 0 ||
          titleSession.current.persisted !== null
        )
          return;
        titleSession.current.persisted = page.title || "";
        setTitleSave((current) =>
          current?.pageId === pageId && current.state === "connecting"
            ? {
                pageId,
                state:
                  titleEditor.getText() === titleSession.current.persisted
                    ? "saved"
                    : "saving",
              }
            : current,
        );
      })
      .catch(() => {
        if (!cancelled)
          setTitleSave((current) =>
            current?.pageId === pageId && current.state === "connecting"
              ? { pageId, state: "error" }
              : current,
          );
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, titleEditor, setTitleSave]);

  useEffect(() => {
    // Canonicalize only the path slug; keep query params (?row=, ?view=
    // deep links) and the hash anchor intact.
    const pageSlug = buildPageUrl(spaceSlug, slugId, title);
    navigate(
      {
        pathname: pageSlug,
        search: window.location.search,
        hash: window.location.hash,
      },
      { replace: true },
    );
  }, [title]);

  const saveTitle = useCallback(() => {
    if (!titleEditor || titleEditor.isDestroyed || activePageId !== pageId)
      return;

    const snapshot = titleEditor.getText();
    const session = titleSession.current;
    if (snapshot === session.persisted && session.pending === 0) {
      if (isPersonalMode())
        setTitleSave((current) =>
          current?.pageId === pageId ? { pageId, state: "saved" } : current,
        );
      return;
    }

    session.pending++;
    queuedTitleSave
      .current({
        pageId: pageId,
        title: snapshot,
      })
      .then(
        (page) => {
          session.pending--;
          session.persisted = page.title || "";
          if (isPersonalMode() && offlinePageKey && offlineEnabled()) {
            void acknowledgeOfflineTitle(offlinePageKey, page.title || "", String(page.updatedAt)).catch(() => {});
          }
          const event: UpdateEvent = {
            operation: "updateOne",
            spaceId: page.spaceId,
            entity: ["pages"],
            id: page.id,
            payload: {
              title: page.title,
              slugId: page.slugId,
              parentPageId: page.parentPageId,
              icon: page.icon,
            },
          };

          if (!titleEditor.isDestroyed && page.title !== titleEditor.getText())
            return;
          if (isPersonalMode() && session.pending === 0)
            setTitleSave((current) =>
              current?.pageId === pageId ? { pageId, state: "saved" } : current,
            );

          updatePageData(page);

          localEmitter.emit("message", event);
          emit(event);
        },
        () => {
          session.pending--;
          if (isPersonalMode() && session.pending === 0)
            setTitleSave((current) =>
              current?.pageId === pageId ? { pageId, state: "error" } : current,
            );
        },
      );
  }, [pageId, title, titleEditor]);

  const debounceUpdate = useDebouncedCallback(saveTitle, 500);

  useEffect(() => {
    if (
      titleEditor &&
      !titleEditor.isDestroyed &&
      titleSession.current.pending === 0 &&
      titleEditor.getText() === titleSession.current.persisted &&
      title !== titleEditor.getText()
    ) {
      titleEditor.commands.setContent(title, { emitUpdate: false });
      titleSession.current.persisted = title || "";
    }
  }, [pageId, title, titleEditor]);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      // guard against Cannot access view['hasFocus'] error
      if (!titleEditor?.isInitialized || titleEditor.isDestroyed) return;
      // A delayed autofocus must not move the user's chosen input or caret.
      if (document.activeElement && document.activeElement !== document.body) return;
      titleEditor?.commands?.focus("end");
    }, 300);
    return () => clearTimeout(focusTimer);
  }, [titleEditor]);

  useEffect(() => {
    return () => {
      // force-save title on navigation
      saveTitle();
    };
  }, [pageId]);

  useEffect(() => {
    if (!titleEditor) return;
    titleEditor.setEditable(
      editable && currentPageEditMode === PageEditMode.Edit,
    );
  }, [currentPageEditMode, titleEditor, editable]);

  const openSearchDialog = () => {
    const event = new CustomEvent("openFindDialogFromEditor", {});
    document.dispatchEvent(event);
  };

  function handleTitleKeyDown(event: any) {
    if (!titleEditor || !pageEditor || event.shiftKey) return;

    // Prevent focus shift when IME composition is active
    // `keyCode === 229` is added to support Safari where `isComposing` may not be reliable
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
      return;

    const { key } = event;
    const { $head } = titleEditor.state.selection;

    if (key === "Enter") {
      event.preventDefault();

      const { $from } = titleEditor.state.selection;
      const titleText = titleEditor.getText();

      // Get the text offset within the heading node (not document position)
      const textOffset = $from.parentOffset;

      const textAfterCursor = titleText.slice(textOffset);

      // Delete text after cursor from title (this will be in undo history)
      const endPos = titleEditor.state.doc.content.size;
      if (textAfterCursor) {
        titleEditor.commands.deleteRange({ from: $from.pos, to: endPos });
      }

      // Don't add to history so undo in page editor won't remove this split
      pageEditor
        .chain()
        .command(({ tr }) => {
          tr.setMeta("addToHistory", false);
          return true;
        })
        .insertContentAt(0, {
          type: "paragraph",
          content: textAfterCursor
            ? [{ type: "text", text: textAfterCursor }]
            : undefined,
        })
        .focus("start")
        .run();
      return;
    }

    const shouldFocusEditor =
      key === "ArrowDown" || (key === "ArrowRight" && !$head.nodeAfter);

    if (shouldFocusEditor) {
      pageEditor.commands.focus("start");
    }
  }

  return (
    <div className="page-title">
      <EditorContent
        editor={titleEditor}
        onKeyDown={(event) => {
          // First handle the search hotkey
          getHotkeyHandler([["mod+F", openSearchDialog]])(event);

          // Then handle other key events
          handleTitleKeyDown(event);
        }}
      />
    </div>
  );
}
