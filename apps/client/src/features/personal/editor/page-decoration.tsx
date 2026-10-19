import { useState } from "react";
import {
  ActionIcon,
  Group,
  Popover,
  TextInput,
} from "@mantine/core";
import { IconFile, IconMessage, IconPlus, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { useAtomValue } from "jotai";
import {
  usePageQuery,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import classes from "./personal-editor.module.css";
import { CoverPicker } from "./page-cover";
import { coverImageUrl } from "./cover-image";
import PageEmojiPalette from './page-emoji-palette';
import { covers } from "./presentation";
export { PersonalCover } from "./page-cover";
export default function PageDecoration({
  pageId,
  editable,
}: {
  pageId: string;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const { data: page } = usePageQuery({ pageId });
  const mutation = useUpdatePageMutation();
  const editor = useAtomValue(pageEditorAtom);
  const [iconOpen, setIconOpen] = useState(false);
  const [customIcon, setCustomIcon] = useState("");
  const { handleCreate } = useTreeMutation(page?.spaceId || "");
  const change = (data: { icon?: string; coverPhoto?: string }) => {
    if (!editable || mutation.isPending) return;
    mutation.mutate(
      { pageId, ...data },
      {
        onSuccess: () => setIconOpen(false),
        onError: () =>
          notifications.show({
            color: "red",
            message: t("Failed to update page"),
          }),
      },
    );
  };
  return (
    <div className={classes.decoration} data-personal-decoration>
      <Popover
        opened={iconOpen}
        onChange={setIconOpen}
        position="bottom-start"
        shadow="md"
        width="min(352px, calc(100vw - 24px))"
      >
        <Popover.Target>
          <button
            className={classes.pageIcon}
            disabled={!editable || mutation.isPending}
            onClick={() => setIconOpen((o) => !o)}
            aria-label={t("Change page icon")}
          >
            {page?.icon || <IconFile size={64} stroke={1} />}
          </button>
        </Popover.Target>
        <Popover.Dropdown style={{ maxHeight: "calc(100dvh - 24px)", overflowY: "auto", overflowX: "hidden" }}>
          <PageEmojiPalette disabled={mutation.isPending || !editable} onSelect={icon => change({ icon })} />
          <Group mt="xs" gap="xs">
            <TextInput
              aria-label={t("Page icon")}
              placeholder={t("Emoji")}
              value={customIcon}
              maxLength={16}
              disabled={!editable || mutation.isPending}
              onChange={(e) => setCustomIcon(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <ActionIcon
              aria-label={t("Apply")}
              disabled={!editable || mutation.isPending}
              onClick={() => {
                if (customIcon.trim()) change({ icon: customIcon.trim() });
              }}
            >
              <IconPlus size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              aria-label={t("Remove icon")}
              disabled={!editable || mutation.isPending}
              onClick={() => change({ icon: "" })}
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Popover.Dropdown>
      </Popover>
      {editable && (
        <div className={classes.tools}>
          {!covers[page?.coverPhoto] &&
            !coverImageUrl(page?.coverPhoto, page?.workspaceId || "") && (
              <CoverPicker key={pageId} pageId={pageId} />
            )}
          <button
            disabled={!editor?.isEditable}
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertContentAt(0, {
                  type: "callout",
                  content: [{ type: "paragraph" }],
                })
                .run()
            }
          >
            <IconMessage size={14} />
            {t("Add note")}
          </button>
          <button onClick={() => handleCreate(pageId)}>
            <IconPlus size={14} />
            {t("Add subpage")}
          </button>
        </div>
      )}
    </div>
  );
}
