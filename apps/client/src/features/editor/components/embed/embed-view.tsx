import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useMemo, useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Popover,
  Text,
  Textarea,
} from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { getEmbedProviderById } from "@docmost/editor-ext";
import { ResizableWrapper } from "../common/resizable-wrapper";
import {
  personalEmbedSandbox,
  resolvePersonalEmbed,
} from "@/features/personal/editor/embed-adapters";
import classes from "./embed-view.module.css";

export default function EmbedView({
  node,
  selected,
  updateAttributes,
  editor,
}: NodeViewProps) {
  const { t } = useTranslation();
  const { src, provider, width: nodeWidth, height: nodeHeight } = node.attrs;
  const label = getEmbedProviderById(provider || "iframe")?.name || "Embed";
  const [opened, setOpened] = useState(false);
  const [input, setInput] = useState(src || "");
  useEffect(() => {
    if (!opened) setInput(src || "");
  }, [src, opened]);
  const preview = useMemo(
    () => resolvePersonalEmbed(src || "", label),
    [src, label],
  );
  const candidate = resolvePersonalEmbed(input, label);
  const handleResize = useCallback(
    (width: number, height: number) => {
      if (editor.isEditable) updateAttributes({ width, height });
    },
    [editor, updateAttributes],
  );
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor.isEditable || !candidate) return;
    updateAttributes({ src: candidate.sourceUrl });
    setOpened(false);
  };
  return (
    <NodeViewWrapper data-drag-handle className={classes.embedNodeView}>
      <Popover
        width={360}
        position="bottom"
        withArrow
        shadow="md"
        opened={opened}
        onChange={setOpened}
        disabled={!editor.isEditable}
      >
        <Popover.Target>
          <Card
            radius="md"
            p="xs"
            withBorder
            className={clsx(selected && "ProseMirror-selectednode")}
          >
            <Group justify="space-between" wrap="nowrap">
              {preview ? (
                <a
                  href={preview.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {label} ↗
                </a>
              ) : (
                <Text c="dimmed">
                  {t("Embed {{provider}}", { provider: label })}
                </Text>
              )}
              {editor.isEditable && (
                <ActionIcon
                  variant="transparent"
                  color="gray"
                  aria-label={t("Edit embed")}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpened((value) => !value);
                  }}
                >
                  <IconEdit size={18} />
                </ActionIcon>
              )}
            </Group>
          </Card>
        </Popover.Target>
        <Popover.Dropdown bg="var(--mantine-color-body)">
          <form onSubmit={submit}>
            <Textarea
              label={t("Embed URL or iframe code")}
              aria-label={t("Embed URL or iframe code")}
              placeholder={t("Enter {{provider}} link to embed", {
                provider: label,
              })}
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              error={
                input && !candidate
                  ? t("Invalid {{provider}} embed link", { provider: label })
                  : undefined
              }
              data-autofocus
              minRows={2}
              autosize
              maxRows={6}
              maxLength={100000}
            />
            <Group justify="end" mt="xs">
              <Button type="submit" disabled={!candidate}>
                {t("Embed link")}
              </Button>
            </Group>
          </form>
        </Popover.Dropdown>
      </Popover>
      {preview && (preview.src || preview.srcDoc) && (
        <div className={classes.embedContainer}>
          <ResizableWrapper
            initialWidth={nodeWidth || 800}
            initialHeight={nodeHeight || preview.height}
            minWidth={200}
            maxWidth={1200}
            minHeight={200}
            maxHeight={1200}
            onResize={handleResize}
            isEditable={editor.isEditable}
            selected={selected}
            className={clsx(
              classes.embedWrapper,
              selected && "ProseMirror-selectednode",
            )}
          >
            <iframe
              className={classes.embedIframe}
              title={`${t("Embed preview")}: ${label}`}
              src={preview.src}
              srcDoc={preview.srcDoc}
              loading="lazy"
              sandbox={personalEmbedSandbox(preview)}
              referrerPolicy="no-referrer"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              frameBorder="0"
            />
          </ResizableWrapper>
        </div>
      )}
      {preview?.needsEmbedCode && (
        <Text size="xs" c="dimmed" mt={6}>
          {t(
            "This service needs its own embed code. Paste the iframe code from its Share or Embed menu.",
          )}
        </Text>
      )}
    </NodeViewWrapper>
  );
}
