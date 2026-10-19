import { useEffect, useRef, useState } from "react";
import { Button, FileButton, Group, Popover, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPhoto, IconUpload } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  usePageQuery,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query";
import { uploadFile } from "@/features/page/services/page-service";
import { getFileUploadSizeLimit } from "@/lib/config";
import { selectedPersonalWorkspace } from "@/lib/personal-workspace-scope";
import { formatBytes } from "@/lib";
import { covers } from "./presentation";
import { coverImageUrl, isCoverImage } from "./cover-image";
import classes from "./personal-editor.module.css";

const attachmentPrefix = "nopetion:attachment:";

async function checkImage(file: File) {
  const src = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = src;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("Invalid image");
  } finally {
    URL.revokeObjectURL(src);
  }
}

export function CoverPicker({
  pageId,
  withRemove = false,
}: {
  pageId: string;
  withRemove?: boolean;
}) {
  const { t } = useTranslation();
  const { data: page } = usePageQuery({ pageId });
  const mutation = useUpdatePageMutation();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef(false);
  const resetInput = useRef<() => void>(null);
  const scope = useRef({ pageId, workspaceId: page?.workspaceId });
  scope.current = { pageId, workspaceId: page?.workspaceId };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const current = (id: string, workspaceId: string) =>
    mounted.current &&
    scope.current.pageId === id &&
    scope.current.workspaceId === workspaceId &&
    (!selectedPersonalWorkspace() ||
      selectedPersonalWorkspace() === workspaceId);

  const change = async (coverPhoto: string) => {
    if (request.current || !page) return;
    request.current = true;
    setBusy(true);
    try {
      await mutation.mutateAsync({ pageId, coverPhoto });
      if (mounted.current) setOpened(false);
    } catch {
      if (mounted.current)
        notifications.show({
          color: "red",
          message: t("Failed to update page"),
        });
    } finally {
      request.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const upload = async (file: File | null) => {
    if (!file || !page || request.current) return;
    const limit = getFileUploadSizeLimit();
    if (!isCoverImage(file) || file.size > limit) {
      notifications.show({
        color: "red",
        message:
          file.size > limit
            ? t("File exceeds the {{limit}} attachment limit", {
                limit: formatBytes(limit),
              })
            : t("Choose a PNG, JPEG, WebP, GIF or AVIF image."),
      });
      resetInput.current?.();
      return;
    }
    const id = pageId,
      workspaceId = page.workspaceId;
    request.current = true;
    setBusy(true);
    try {
      await checkImage(file);
      if (!current(id, workspaceId)) return;
      const attachment = await uploadFile(file, id);
      // A delayed file dialog/upload must never change the newly opened page/workspace.
      if (!current(id, workspaceId)) return;
      await mutation.mutateAsync({
        pageId: id,
        coverPhoto: attachmentPrefix + attachment.id,
      });
      if (mounted.current) setOpened(false);
    } catch {
      if (current(id, workspaceId))
        notifications.show({
          color: "red",
          message: t("Failed to upload cover image"),
        });
    } finally {
      request.current = false;
      resetInput.current?.();
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Group gap="xs" wrap="nowrap">
      <Popover
        opened={opened}
        onChange={setOpened}
        trapFocus
        returnFocus
        position="bottom-start"
        shadow="md"
        width={310}
      >
        <Popover.Target>
          <Button
            variant="default"
            size="xs"
            loading={busy}
            disabled={!page}
            leftSection={<IconPhoto size={14} />}
            onClick={() => setOpened((o) => !o)}
          >
            {t(page?.coverPhoto ? "Change cover" : "Add cover")}
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <Text size="xs" c="dimmed" mb="xs">
            {t("Cover colors")}
          </Text>
          <Group gap="xs">
            {Object.entries(covers).map(([coverPhoto, background]) => (
              <button
                key={coverPhoto}
                className={classes.coverSwatch}
                style={{ background }}
                aria-label={t(coverPhoto.slice(9))}
                disabled={busy}
                onClick={() => {
                  void change(coverPhoto);
                }}
              />
            ))}
          </Group>
          <FileButton
            onChange={(file) => {
              void upload(file);
            }}
            resetRef={resetInput}
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          >
            {(props) => (
              <Button
                {...props}
                mt="md"
                fullWidth
                variant="light"
                loading={busy}
                leftSection={<IconUpload size={16} />}
              >
                {t("Upload image")}
              </Button>
            )}
          </FileButton>
          <Text size="xs" c="dimmed" mt="xs">
            {t("Cover image size limit: {{limit}}", {
              limit: formatBytes(getFileUploadSizeLimit()),
            })}
          </Text>
        </Popover.Dropdown>
      </Popover>
      {withRemove && (
        <Button
          variant="default"
          size="xs"
          disabled={busy}
          onClick={() => {
            void change("");
          }}
        >
          {t("Remove cover")}
        </Button>
      )}
    </Group>
  );
}

export function PersonalCover({
  pageId,
  editable,
}: {
  pageId: string;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const { data: page } = usePageQuery({ pageId });
  const [failed, setFailed] = useState<string>();
  const background = covers[page?.coverPhoto];
  const src = coverImageUrl(page?.coverPhoto, page?.workspaceId || "");
  if (!background && !src) return null;
  return (
    <div className={classes.cover} style={{ background }} data-personal-cover>
      {src && (
        <img
          key={src}
          src={src}
          alt={t("Page cover")}
          className={classes.coverImage}
          onError={() => setFailed(src)}
          onLoad={() => setFailed(undefined)}
        />
      )}
      {src && failed === src && (
        <Text className={classes.coverError}>
          {t("Failed to load cover image")}
        </Text>
      )}
      {editable && (
        <div className={classes.coverActions}>
          <CoverPicker key={pageId} pageId={pageId} withRemove />
        </div>
      )}
    </div>
  );
}
