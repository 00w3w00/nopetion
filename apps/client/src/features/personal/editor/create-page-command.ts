import { Editor, Range } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { getDefaultStore } from "jotai";
import { notifications } from "@mantine/notifications";
import i18n from "@/i18n";
import { createPage, getPageById } from "@/features/page/services/page-service";
import { invalidateOnCreatePage } from "@/features/page/queries/page-query";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { updateSpaceRoots } from "@/features/page/tree/utils/utils";
import { selectedPersonalWorkspace } from "@/lib/personal-workspace-scope";
import type { IPage } from "@/features/page/types/page.types";
import type { SpaceTreeNode } from "@/features/page/tree/types";

export const PERSONAL_PAGE_CREATED = "nopetion:page-created";
export type PersonalPageCreated = { page: IPage; editor: Editor };
const pending = new WeakSet<Editor>();

export function addCreatedPageToTree(page: IPage) {
  const store = getDefaultStore();
  const child: SpaceTreeNode = {
    id: page.id,
    slugId: page.slugId,
    name: page.title || "",
    icon: page.icon,
    position: page.position,
    spaceId: page.spaceId,
    parentPageId: page.parentPageId,
    hasChildren: false,
    children: [],
  };
  store.set(treeDataAtom, (old) =>
    updateSpaceRoots(old, page.spaceId, (roots) => {
      if (treeModel.find(roots, page.id)) return roots;
      const next = treeModel.insert(roots, page.parentPageId ?? null, child);
      return page.parentPageId
        ? treeModel.update(next, page.parentPageId, { hasChildren: true })
        : next;
    }),
  );
}

/** Consume the command now and map its insertion point across later edits. */
export async function createPageFromSlash(
  { editor, range }: { editor: Editor; range: Range },
  database = false,
) {
  if (
    !editor ||
    editor.isDestroyed ||
    !editor.isEditable ||
    pending.has(editor)
  )
    return;
  const pageId = editor.storage.pageId;
  if (!pageId) {
    notifications.show({
      color: "red",
      message: i18n.t("Failed to create page"),
    });
    return;
  }
  pending.add(editor);
  const workspace = selectedPersonalWorkspace();
  const commandText = editor.state.doc.textBetween(range.from, range.to);
  editor.chain().focus().deleteRange(range).run();
  const afterRemoval = editor.state.doc;
  let bookmark = TextSelection.near(
    editor.state.doc.resolve(range.from),
  ).getBookmark();
  const map = ({
    transaction,
  }: {
    transaction: import("@tiptap/pm/state").Transaction;
  }) => {
    bookmark = bookmark.map(transaction.mapping);
  };
  editor.on("transaction", map);
  const active = () =>
    !editor.isDestroyed &&
    editor.storage.pageId === pageId &&
    selectedPersonalWorkspace() === workspace;
  const notificationId = notifications.show({
    loading: true,
    autoClose: false,
    withCloseButton: false,
    message: i18n.t("Creating page…"),
  });
  try {
    const source = await getPageById({ pageId });
    if (!active()) return;
    const created = await createPage({
      spaceId: source.spaceId,
      parentPageId: source.id,
      ...(database
        ? {
            icon: "📊",
            content: {
              type: "doc",
              content: [
                {
                  type: "personalDatabase",
                  attrs: { title: i18n.t("Database"), view: "table" },
                  content: [],
                },
                { type: "paragraph" },
              ],
            },
          }
        : {}),
    });
    if (!active()) return;
    // Never apply an old range after an async request: it may now contain
    // text the user just typed. A bookmark follows the original location.
    const position = bookmark.resolve(editor.state.doc).from;
    editor.commands.insertContentAt(position, {
      type: "paragraph",
      content: [
        {
          type: "mention",
          attrs: {
            id: crypto.randomUUID(),
            entityType: "page",
            entityId: created.id,
            slugId: created.slugId,
            label: i18n.t(database ? "Database" : "Untitled"),
            spaceSlug: source.space?.slug,
            icon: created.icon,
          },
        },
      ],
    });
    invalidateOnCreatePage(created);
    addCreatedPageToTree(created);
    window.dispatchEvent(
      new CustomEvent<PersonalPageCreated>(PERSONAL_PAGE_CREATED, {
        detail: { page: created, editor },
      }),
    );
  } catch {
    // Restore only the untouched command line; other edits remain intact.
    if (active() && editor.state.doc.eq(afterRemoval) && commandText)
      editor.commands.insertContentAt(
        bookmark.resolve(editor.state.doc).from,
        commandText,
      );
    notifications.show({
      color: "red",
      message: i18n.t("Failed to create page"),
    });
  } finally {
    editor.off("transaction", map);
    pending.delete(editor);
    notifications.hide(notificationId);
  }
}
