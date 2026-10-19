import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query.ts";
import {
  ActionIcon,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Text,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import clsx from "clsx";
import classes from "./mention.module.css";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { IconFileDescription, IconPlus } from "@tabler/icons-react";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useParams } from "react-router-dom";
import { v7 as uuid7 } from "uuid";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import {
  MentionListProps,
  MentionSuggestionItem,
} from "@/features/editor/components/mention/mention.type.ts";
import { IPage } from "@/features/page/types/page.types";
import { getPageTitle } from "@/features/page/page.utils";
import {
  useCreatePageMutation,
  usePageQuery,
} from "@/features/page/queries/page-query";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { SpaceTreeNode } from "@/features/page/tree/types";
import { useTranslation } from "react-i18next";
import { useQueryEmit } from "@/features/websocket/use-query-emit";
import { extractPageSlugId } from "@/lib";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text.tsx";
import { TextSelection, Transaction } from "@tiptap/pm/state";
import { selectedPersonalWorkspace } from "@/lib/personal-workspace-scope";
import { isPersonalMode } from "@/lib/config";
import { addCreatedPageToTree } from "@/features/personal/editor/create-page-command";

const MentionList = forwardRef<any, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [countAnnouncement, setCountAnnouncement] = useState("");
  const [selectionAnnouncement, setSelectionAnnouncement] = useState("");
  const { pageSlug, spaceSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useSpaceQuery(spaceSlug);
  const [currentUser] = useAtom(currentUserAtom);
  const [renderItems, setRenderItems] = useState<MentionSuggestionItem[]>([]);
  const { t } = useTranslation();
  const [data, setData] = useAtom(treeDataAtom);
  const createPageMutation = useCreatePageMutation();
  const emit = useQueryEmit();
  const isInCommentContext = props.isInCommentContext ?? false;
  const personalMode = isPersonalMode();
  // A stale people-only slash filter or cached mixed response must not bring
  // people suggestions back into the personal editor or its comment editor.
  const entityFilter = personalMode ? "page" : props.editor.storage.mentionEntityFilter;
  const creatingPage = useRef(false);

  const { data: suggestion, isLoading } = useSearchSuggestionsQuery({
    query: props.query,
    includeUsers: !personalMode && entityFilter !== "page",
    includePages: entityFilter !== "user",
    spaceId: space?.id,
    limit: props.query ? 10 : 5,
    preload: true,
  });

  const createPageItem = (label: string): MentionSuggestionItem => {
    return {
      id: null,
      label: label,
      entityType: "page",
      entityId: null,
      slugId: null,
      icon: null,
    };
  };

  useEffect(() => {
    if (suggestion && !isLoading) {
      let items: MentionSuggestionItem[] = [];

      if (entityFilter !== "page" && suggestion?.users?.length > 0) {
        items.push({ entityType: "header", label: t("People") });

        items = items.concat(
          suggestion.users.map((user) => ({
            id: uuid7(),
            label: user.name,
            entityType: "user",
            entityId: user.id,
            avatarUrl: user.avatarUrl,
          })),
        );
      }

      if (entityFilter !== "user" && suggestion?.pages?.length > 0) {
        items.push({ entityType: "header", label: t("Pages") });
        items = items.concat(
          suggestion.pages.map((page) => ({
            id: uuid7(),
            label: getPageTitle(page.title, page.isBase, t),
            entityType: "page",
            entityId: page.id,
            slugId: page.slugId,
            icon: page.icon,
            spaceName: page.space?.name,
            spaceSlug: page.space?.slug,
          })),
        );
      }
      if (entityFilter !== "user" && !isInCommentContext && props.query && space?.id && page?.id) {
        items.push(createPageItem(props.query));
      }

      setRenderItems(items);
      // update editor storage
      //@ts-ignore
      props.editor.storage.mentionItems = items;
    }
  }, [suggestion, isLoading, entityFilter, isInCommentContext, props.query, props.editor, space?.id, page?.id, t]);

  const selectItem = useCallback(
    (index: number) => {
      const item = renderItems?.[index];
      if (item) {
        if (item.entityType === "user" && !personalMode) {
          props.command({
            id: item.id,
            label: item.label,
            entityType: "user",
            entityId: item.entityId,
            creatorId: currentUser?.user.id,
          });
        }
        if (item.entityType === "page" && item.id !== null) {
          props.command({
            id: item.id,
            label: item.label || t("Untitled"),
            entityType: "page",
            entityId: item.entityId,
            slugId: item.slugId,
            creatorId: currentUser?.user.id,
          });
        }
        if (item.entityType === "page" && item.id === null) {
          createPage(item.label);
        }
      }
    },
    [renderItems, personalMode],
  );

  const upHandler = () => {
    if (!renderItems.length) return;

    let newIndex = selectedIndex;

    do {
      newIndex = (newIndex + renderItems.length - 1) % renderItems.length;
    } while (renderItems[newIndex].entityType === "header");
    setSelectedIndex(newIndex);
  };

  const downHandler = () => {
    if (!renderItems.length) return;
    let newIndex = selectedIndex;
    do {
      newIndex = (newIndex + 1) % renderItems.length;
    } while (renderItems[newIndex].entityType === "header");
    setSelectedIndex(newIndex);
  };

  const enterHandler = () => {
    if (!renderItems.length || creatingPage.current) return;
    if (renderItems[selectedIndex]?.entityType !== "header") {
      selectItem(selectedIndex);
    }
  };

  useEffect(() => {
    const first = renderItems.findIndex(item => item.entityType !== "header");
    setSelectedIndex(Math.max(first, 0));
  }, [renderItems]);

  const selectableCount = useMemo(
    () => renderItems.filter((item) => item.entityType !== "header").length,
    [renderItems],
  );

  useEffect(() => {
    if (renderItems.length === 0) {
      setCountAnnouncement(t("No results"));
      return;
    }
    setCountAnnouncement(
      t("{{count}} result available", { count: selectableCount }),
    );
  }, [renderItems.length, selectableCount, t]);

  useEffect(() => {
    const item = renderItems[selectedIndex];
    if (!item || item.entityType === "header") {
      setSelectionAnnouncement("");
      return;
    }
    if (item.entityType === "user") {
      setSelectionAnnouncement(`${t("People")}: ${item.label}`);
      return;
    }
    if (item.entityType === "page") {
      if (item.id === null) {
        setSelectionAnnouncement(`${t("Create page")}: ${item.label}`);
        return;
      }
      const pageLabel = item.label || t("Untitled");
      setSelectionAnnouncement(
        item.spaceName
          ? `${t("Pages")}: ${pageLabel}, ${item.spaceName}`
          : `${t("Pages")}: ${pageLabel}`,
      );
    }
  }, [selectedIndex, renderItems, t]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.isComposing || event.keyCode === 229) return false;
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        // don't trap the enter button if there are no items to render
        if (renderItems.length === 0) {
          return false;
        }
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  const createPage = async (title: string) => {
    if (creatingPage.current || !space?.id || !page?.id || !props.editor.isEditable || props.editor.isDestroyed) return;
    creatingPage.current = true;
    const editor = props.editor;
    const sourcePageId = page.id;
    const workspace = selectedPersonalWorkspace();
    const sourceText = editor.state.doc.textBetween(props.range.from, props.range.to);
    editor.commands.deleteRange(props.range);
    const afterRemoval = editor.state.doc;
    let bookmark = TextSelection.near(editor.state.doc.resolve(props.range.from)).getBookmark();
    const map = ({ transaction }: { transaction: Transaction }) => { bookmark = bookmark.map(transaction.mapping); };
    editor.on("transaction", map);
    const active = () => !editor.isDestroyed && editor.isEditable
      && editor.storage.pageId === sourcePageId && selectedPersonalWorkspace() === workspace;
    const payload: { spaceId: string; parentPageId?: string; title: string } = {
      spaceId: space.id,
      parentPageId: page.id || null,
      title: title,
    };

    let createdPage: IPage;
    try {
      createdPage = await createPageMutation.mutateAsync(payload);
      if (!active()) return;
      const parentId = page.id || null;
      const newNode: SpaceTreeNode = {
        id: createdPage.id,
        slugId: createdPage.slugId,
        name: createdPage.title,
        position: createdPage.position,
        spaceId: createdPage.spaceId,
        parentPageId: createdPage.parentPageId,
        hasChildren: false,
        children: [],
      };

      const lastIndex = data.length;

      if (isPersonalMode()) addCreatedPageToTree(createdPage);
      else setData(treeModel.insert(data, parentId, newNode, lastIndex));

      const attrs = {
        id: uuid7(),
        label: getPageTitle(createdPage.title, createdPage.isBase, t),
        entityType: "page",
        entityId: createdPage.id,
        slugId: createdPage.slugId,
        creatorId: currentUser?.user.id,
      };
      editor.commands.insertContentAt(bookmark.resolve(editor.state.doc).from, [
        { type: "mention", attrs }, { type: "text", text: " " },
      ]);

      setTimeout(() => {
        if (!active()) return;
        emit({
          operation: "addTreeNode",
          spaceId: space.id,
          payload: {
            parentId,
            index: lastIndex,
            data: newNode,
          },
        });
      }, 50);
    } catch {
      // Mutation reports its API error. Keep the picker available for retry.
      if (active() && editor.state.doc.eq(afterRemoval) && sourceText)
        editor.commands.insertContentAt(bookmark.resolve(editor.state.doc).from, sourceText);
    } finally {
      editor.off("transaction", map);
      creatingPage.current = false;
    }
  };

  useEffect(() => {
    viewportRef.current
      ?.querySelector(`[data-item-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const popupWidth = isInCommentContext ? 280 : 320;

  if (renderItems.length === 0) {
    return (
      <Paper id="mention" shadow="md" py="xs" withBorder radius="md">
        <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
          {countAnnouncement}
        </VisuallyHidden>
        <Text c="dimmed" size="sm" px="sm">
          {t("No results")}
        </Text>
      </Paper>
    );
  }

  const hasUsers = renderItems.some((item) => item.entityType === "user");
  const hasPages = renderItems.some(
    (item) => item.entityType === "page" && item.id !== null,
  );
  const createPageItemData = renderItems.find(
    (item) => item.entityType === "page" && item.id === null,
  );

  return (
    <Paper
      id="mention"
      shadow="md"
      withBorder
      radius="md"
      py={6}
      role="listbox"
      aria-label={t(personalMode ? "Page link" : "Mention suggestions")}
      aria-activedescendant={`mention-option-${selectedIndex}`}
    >
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {countAnnouncement}
      </VisuallyHidden>
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {selectionAnnouncement}
      </VisuallyHidden>
      <ScrollArea.Autosize
        viewportRef={viewportRef}
        mah={350}
        w={popupWidth}
        scrollbars={"y"}
        scrollbarSize={6}
        overscrollBehavior={"contain"}
        styles={{ content: { minWidth: 0 } }}
      >
        {renderItems?.map((item, index) => {
          if (item.entityType === "header") {
            const isFirst = index === 0;
            return (
              <div key={`${item.label}-${index}`} role="presentation">
                {!isFirst && <Divider my={6} />}
                <Text
                  c="dimmed"
                  size="xs"
                  fw={500}
                  px="sm"
                  pt={isFirst ? 2 : 4}
                  pb={4}
                  tt="uppercase"
                  style={{ userSelect: "none" }}
                >
                  {item.label}
                </Text>
              </div>
            );
          } else if (item.entityType === "user") {
            return (
              <UnstyledButton
                data-item-index={index}
                key={index}
                id={`mention-option-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => selectItem(index)}
                className={clsx(classes.menuBtn, {
                  [classes.selectedItem]: index === selectedIndex,
                })}
                px="sm"
              >
                <Group gap="sm">
                  <CustomAvatar
                    size={"sm"}
                    avatarUrl={item.avatarUrl}
                    name={item.label}
                  />

                  <div style={{ flex: 1 }}>
                    <AutoTooltipText size="sm" fw={500}>
                      {item.label}
                    </AutoTooltipText>
                  </div>
                </Group>
              </UnstyledButton>
            );
          } else if (item.entityType === "page" && item.id !== null) {
            return (
              <UnstyledButton
                data-item-index={index}
                key={index}
                id={`mention-option-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => selectItem(index)}
                className={clsx(classes.menuBtn, {
                  [classes.selectedItem]: index === selectedIndex,
                })}
                px="sm"
              >
                <Group gap="sm" wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    component="div"
                    aria-hidden="true"
                    color="gray"
                    size="sm"
                  >
                    {item.icon || (
                      <IconFileDescription size={18} stroke={1.5} />
                    )}
                  </ActionIcon>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <AutoTooltipText size="sm" fw={500} truncate>
                      {item.label}
                    </AutoTooltipText>
                    {item.spaceName && (
                      <Text size="xs" c="dimmed" truncate>
                        {item.spaceName}
                      </Text>
                    )}
                  </div>
                </Group>
              </UnstyledButton>
            );
          } else {
            return null;
          }
        })}

        {createPageItemData && !isInCommentContext && (
          <>
            {(hasUsers || hasPages) && <Divider my={6} />}
            <UnstyledButton
              data-item-index={renderItems.indexOf(createPageItemData)}
              id={`mention-option-${renderItems.indexOf(createPageItemData)}`}
              role="option"
              aria-selected={
                renderItems.indexOf(createPageItemData) === selectedIndex
              }
              onClick={() =>
                selectItem(renderItems.indexOf(createPageItemData))
              }
              className={clsx(classes.menuBtn, {
                [classes.selectedItem]:
                  renderItems.indexOf(createPageItemData) === selectedIndex,
              })}
              px="sm"
            >
              <Group gap="sm" wrap="nowrap">
                <ActionIcon
                  variant="subtle"
                  component="div"
                  color="gray"
                  size="sm"
                  aria-hidden="true"
                >
                  <IconPlus size={16} stroke={1.5} />
                </ActionIcon>

                <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                  <Text size="sm" fw={500} truncate>
                    {t("Create page")}: {createPageItemData.label}
                  </Text>
                </div>
              </Group>
            </UnstyledButton>
          </>
        )}
      </ScrollArea.Autosize>
    </Paper>
  );
});

export default MentionList;
