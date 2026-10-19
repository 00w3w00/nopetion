import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowRight,
  IconArrowsHorizontal,
  IconDots,
  IconEye,
  IconEyeOff,
  IconFileExport,
  IconHistory,
  IconLink,
  IconList,
  IconMarkdown,
  IconMessage,
  IconPaperclip,
  IconPrinter,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconWifiOff,
} from "@tabler/icons-react";
import React, { useEffect, useRef, useState } from "react";
import { useAsideTriggerProps } from "@/hooks/use-toggle-aside.tsx";
import { useAtom, useAtomValue } from "jotai";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms.ts";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import { useClipboard } from "@/hooks/use-clipboard";
import { useLocation, useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { notifications } from "@mantine/notifications";
import { getAppUrl, isPersonalMode } from "@/lib/config.ts";
import SaveStatus from "@/features/personal/components/save-status";
import headerClasses from "./page-header.module.css";
import PersonalAiPanel from "@/features/personal-ai/personal-ai-panel";
import { aiJobIdFromSearch } from "@/features/personal-ai/ai-job-link";
import DocumentAppearance from "@/features/personal/editor/document-appearance";
import { extractPageSlugId } from "@/lib";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { PageWidthToggle } from "@/features/user/components/page-width-pref.tsx";
import { Trans, useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import { htmlToMarkdown } from "@docmost/editor-ext";
import {
  pageEditorAtom,
  yjsConnectionStatusAtom,
} from "@/features/editor/atoms/editor-atoms.ts";
import { formattedDate } from "@/lib/time.ts";
import { PageEditModeToggle } from "@/features/user/components/page-state-pref.tsx";
import MovePageModal from "@/features/page/components/move-page-modal.tsx";
import PageAttachmentsModal from "@/features/attachments/components/page-attachments-modal.tsx";
import { useTimeAgo } from "@/hooks/use-time-ago.tsx";
import {
  useFavoriteIds,
  useAddFavoriteMutation,
  useRemoveFavoriteMutation,
} from "@/features/favorite/queries/favorite-query";
import {
  useWatchStatusQuery,
  useWatchPageMutation,
  useUnwatchPageMutation,
} from "@/features/page/queries/watcher-query";

interface PageHeaderMenuProps {
  readOnly?: boolean;
}
export default function PageHeaderMenu({ readOnly }: PageHeaderMenuProps) {
  const { t } = useTranslation();
  const commentsTriggerProps = useAsideTriggerProps("comments");
  const tocTriggerProps = useAsideTriggerProps("toc");
  const { pageSlug } = useParams();
  const notificationJobId = aiJobIdFromSearch(useLocation().search);
  const { data: page } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const isDeleted = !!page?.deletedAt;

  useHotkeys(
    [
      [
        "mod+F",
        () => {
          const event = new CustomEvent("openFindDialogFromEditor", {});
          document.dispatchEvent(event);
        },
      ],
      [
        "Escape",
        () => {
          const event = new CustomEvent("closeFindDialogFromEditor", {});
          document.dispatchEvent(event);
        },
        { preventDefault: false },
      ],
    ],
    [],
  );

  if (isDeleted) {
    return null;
  }

  return (
    <>
      {isPersonalMode() && !readOnly ? (
        <SaveStatus pageId={page?.id} compactOnMobile />
      ) : (
        <ConnectionWarning />
      )}

      {!readOnly && !page?.isBase && (
        <Box visibleFrom={isPersonalMode() ? "sm" : undefined}>
          <PageEditModeToggle size="xs" compact={isPersonalMode()} />
        </Box>
      )}
      {isPersonalMode() && (!readOnly || notificationJobId) && page && !page.isBase && (
        <PersonalAiPanel pageId={page.id} title={page.title || ""} readOnly={readOnly} />
      )}

      {!isPersonalMode() && null}

      {!isPersonalMode() && (
        <Tooltip label={t("Comments")} openDelay={250} withArrow>
          <ActionIcon
            variant="subtle"
            color="dark"
            aria-label={t("Comments")}
            {...commentsTriggerProps}
          >
            <IconMessage size={20} stroke={2} />
          </ActionIcon>
        </Tooltip>
      )}

      {!page?.isBase && (
        <Tooltip label={t("Table of contents")} openDelay={250} withArrow>
          <ActionIcon
            variant="subtle"
            color="dark"
            aria-label={t("Table of contents")}
            visibleFrom={isPersonalMode() ? "sm" : undefined}
            {...tocTriggerProps}
          >
            <IconList size={20} stroke={2} />
          </ActionIcon>
        </Tooltip>
      )}

      {isPersonalMode() && page && <Group visibleFrom="sm" gap={4} wrap="nowrap"><PersonalQuickActions pageId={page.id} /></Group>}
      <PageActionMenu readOnly={readOnly} />
    </>
  );
}

function PersonalQuickActions({ pageId }: { pageId: string }) {
  const { t } = useTranslation();
  const ids = useFavoriteIds("page");
  const add = useAddFavoriteMutation();
  const remove = useRemoveFavoriteMutation();
  const [, setHistory] = useAtom(historyAtoms);
  return (
    <>
      <Tooltip label={t("Page history")}>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("Page history")}
          onClick={() => setHistory(true)}
        >
          <IconHistory size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t("Favorites")}>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("Favorites")}
          aria-pressed={ids.has(pageId)}
          disabled={add.isPending || remove.isPending}
          onClick={() =>
            ids.has(pageId)
              ? remove.mutate({ pageId, type: "page" })
              : add.mutate({ pageId, type: "page" })
          }
        >
          {ids.has(pageId) ? (
            <IconStarFilled size={18} color="#c8a45d" />
          ) : (
            <IconStar size={18} />
          )}
        </ActionIcon>
      </Tooltip>
    </>
  );
}

interface PageActionMenuProps {
  readOnly?: boolean;
}
function PageActionMenu({ readOnly }: PageActionMenuProps) {
  const { t } = useTranslation();
  const tocTriggerProps = useAsideTriggerProps("toc");
  const [, setHistoryModalOpen] = useAtom(historyAtoms);
  const clipboard = useClipboard({ timeout: 500 });
  const { pageSlug, spaceSlug } = useParams();
  const { data: page, isLoading } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const { openDeleteModal } = useDeletePageModal();
  const { handleDelete } = useTreeMutation(page?.spaceId ?? "");
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [
    movePageModalOpened,
    { open: openMovePageModal, close: closeMoveSpaceModal },
  ] = useDisclosure(false);
  const [
    verificationOpened,
    { open: openVerificationModal, close: closeVerificationModal },
  ] = useDisclosure(false);
  const [
    attachmentsOpened,
    { open: openAttachmentsModal, close: closeAttachmentsModal },
  ] = useDisclosure(false);
  const [pageEditor] = useAtom(pageEditorAtom);
  const pageUpdatedAt = useTimeAgo(page?.updatedAt);
  const favoriteIds = useFavoriteIds("page", page?.spaceId);
  const addFavoriteMutation = useAddFavoriteMutation();
  const removeFavoriteMutation = useRemoveFavoriteMutation();
  const isFavorited = page?.id ? favoriteIds.has(page.id) : false;
  const { data: watchStatus } = useWatchStatusQuery(page?.id);
  const watchPage = useWatchPageMutation();
  const unwatchPage = useUnwatchPageMutation();

  // Moving a page removes its active query before navigation completes.
  // Keep all Hooks mounted while waiting for the replacement page data.
  if (!page) return null;

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, page.slugId, page.title);

    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
  };

  const handleCopyAsMarkdown = () => {
    if (!pageEditor) return;
    const html = pageEditor.getHTML();
    const markdown = htmlToMarkdown(html);
    const title = page?.title ? `# ${page.title}\n\n` : "";
    clipboard.copy(`${title}${markdown}`);
    notifications.show({ message: t("Copied") });
  };

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const openHistoryModal = () => {
    setHistoryModalOpen(true);
  };

  const handleDeletePage = () => {
    openDeleteModal({ onConfirm: () => handleDelete(page.id) });
  };

  const handleToggleFavorite = () => {
    if (!page?.id) return;
    const params = { type: "page" as const, pageId: page.id };
    if (isFavorited) {
      removeFavoriteMutation.mutate(params);
    } else {
      addFavoriteMutation.mutate(params);
    }
  };

  return (
    <>
      <Menu
        shadow="xl"
        position="bottom-end"
        offset={8}
        width={230}
        withArrow
        arrowPosition="center"
      >
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="dark"
            aria-label={t("Page actions")}
            className={headerClasses.moreButton}
          >
            <IconDots size={20} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown className={headerClasses.actionDropdown}>
          {isPersonalMode() && !readOnly && !page.isBase && (
            <Box hiddenFrom="sm" p="xs"><PageEditModeToggle size="sm" /></Box>
          )}
          {isPersonalMode() && !page.isBase && (
            <Menu.Item hiddenFrom="sm" leftSection={<IconList size={16} />} {...tocTriggerProps}>
              {t("Table of contents")}
            </Menu.Item>
          )}
          {isPersonalMode() && <DocumentAppearance />}
          <Menu.Item
            leftSection={<IconLink size={16} />}
            onClick={handleCopyLink}
          >
            {t("Copy link")}
          </Menu.Item>

          {!page?.isBase && (
            <Menu.Item
              leftSection={<IconMarkdown size={16} />}
              onClick={handleCopyAsMarkdown}
            >
              {t("Copy as Markdown")}
            </Menu.Item>
          )}

          <Menu.Item
            leftSection={
              isFavorited ? (
                <IconStarFilled
                  size={16}
                  color="var(--mantine-color-yellow-5)"
                />
              ) : (
                <IconStar size={16} />
              )
            }
            onClick={handleToggleFavorite}
          >
            {isFavorited ? t("Remove from favorites") : t("Add to favorites")}
          </Menu.Item>

          {!isPersonalMode() && (watchStatus?.watching ? (
            <Menu.Item
              leftSection={<IconEyeOff size={16} />}
              onClick={() => unwatchPage.mutate(page.id)}
            >
              {t("Stop watching")}
            </Menu.Item>
          ) : (
            <Menu.Item
              leftSection={<IconEye size={16} />}
              onClick={() => watchPage.mutate(page.id)}
            >
              {t("Watch page")}
            </Menu.Item>
          ))}

          {!page?.isBase && <Menu.Divider />}

          {!page?.isBase && (
            <Menu.Item leftSection={<IconArrowsHorizontal size={16} />}>
              <Group wrap="nowrap">
                <PageWidthToggle label={t("Full width")} />
              </Group>
            </Menu.Item>
          )}

          {!page?.isBase && (
            <Menu.Item
              leftSection={<IconHistory size={16} />}
              onClick={openHistoryModal}
            >
              {t("Page history")}
            </Menu.Item>
          )}

          {!page?.isBase && (
            <Menu.Item
              leftSection={<IconPaperclip size={16} />}
              onClick={openAttachmentsModal}
            >
              {t("Attachments")}
            </Menu.Item>
          )}

          {!isPersonalMode() && !readOnly && !page?.isBase && null}

          <Menu.Divider />

          {!readOnly && (
            <Menu.Item
              leftSection={<IconArrowRight size={16} />}
              onClick={openMovePageModal}
            >
              {t("Move")}
            </Menu.Item>
          )}

          <Menu.Item
            leftSection={<IconFileExport size={16} />}
            onClick={openExportModal}
          >
            {t("Export")}
          </Menu.Item>

          <Menu.Item
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
          >
            {isPersonalMode() ? t("Print") : t("Print PDF")}
          </Menu.Item>

          {!readOnly && (
            <>
              <Menu.Divider />
              <Menu.Item
                color={"red"}
                leftSection={<IconTrash size={16} />}
                onClick={handleDeletePage}
              >
                {t("Move to trash")}
              </Menu.Item>
            </>
          )}

          <Menu.Divider />

          <>
            <Group px="sm" wrap="nowrap" style={{ cursor: "pointer" }}>
              <Tooltip
                label={t("Edited by {{name}} {{time}}", {
                  name: page.lastUpdatedBy.name,
                  time: pageUpdatedAt,
                })}
                position="left-start"
              >
                <div style={{ width: 210 }}>
                  <Text size="xs" c="dimmed" truncate="end">
                    {t("Word count: {{wordCount}}", {
                      wordCount: pageEditor?.storage?.characterCount?.words(),
                    })}
                  </Text>

                  <Text size="xs" c="dimmed" lineClamp={1}>
                    <Trans
                      defaults="Created by: <b>{{creatorName}}</b>"
                      values={{ creatorName: page?.creator?.name }}
                      components={{ b: <Text span fw={500} /> }}
                    />
                  </Text>
                  <Text size="xs" c="dimmed" truncate="end">
                    {t("Created at: {{time}}", {
                      time: formattedDate(page.createdAt),
                    })}
                  </Text>
                </div>
              </Tooltip>
            </Group>
          </>
        </Menu.Dropdown>
      </Menu>

      <ExportModal
        type="page"
        id={page.id}
        open={exportOpened}
        onClose={closeExportModal}
      />

      <MovePageModal
        pageId={page.id}
        slugId={page.slugId}
        currentSpaceSlug={spaceSlug}
        onClose={closeMoveSpaceModal}
        open={movePageModalOpened}
      />



      <PageAttachmentsModal
        pageId={page.id}
        open={attachmentsOpened}
        onClose={closeAttachmentsModal}
      />
    </>
  );
}

function ConnectionWarning() {
  const { t } = useTranslation();
  const yjsConnectionStatus = useAtomValue(yjsConnectionStatusAtom);
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isDisconnected = ["disconnected", "connecting"].includes(
      yjsConnectionStatus,
    );

    if (isDisconnected) {
      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => setShowWarning(true), 5000);
      }
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setShowWarning(false);
    }
  }, [yjsConnectionStatus]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!showWarning) return null;

  return (
    <Tooltip
      label={t("Real-time editor connection lost. Retrying...")}
      openDelay={250}
      withArrow
    >
      <ThemeIcon
        variant="default"
        c="red"
        role="status"
        aria-label={t("Real-time editor connection lost. Retrying...")}
        style={{ border: "none" }}
      >
        <IconWifiOff size={20} stroke={2} />
      </ThemeIcon>
    </Tooltip>
  );
}
