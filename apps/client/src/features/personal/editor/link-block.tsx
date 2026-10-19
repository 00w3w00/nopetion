import { useEffect, useState } from "react";
import { Button, Popover, Textarea, TextInput, Text } from "@mantine/core";
import { IconBookmark, IconExternalLink, IconWorld } from "@tabler/icons-react";
import { NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { safePersonalUrl } from "./widget-utils";
import { resolvePersonalEmbed } from "./embed-adapters";
import EmbedPreview from "./embed-preview";
import classes from "./block-input.module.css";

export default function LinkBlock({
  node,
  editor,
  updateAttributes,
}: Pick<NodeViewProps, "node" | "editor" | "getPos" | "updateAttributes">) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(
    !!node.attrs.id && editor.storage.personalNewWidgetId === node.attrs.id,
  );
  const [url, setUrl] = useState(node.attrs.value || "");
  const [title, setTitle] = useState(node.attrs.title || "");
  const isEmbed = node.attrs.kind === "embed";
  const embed = isEmbed
    ? resolvePersonalEmbed(node.attrs.value, node.attrs.provider)
    : null;
  const stored = embed?.sourceUrl || safePersonalUrl(node.attrs.value || "");
  const input = isEmbed
    ? resolvePersonalEmbed(url, node.attrs.provider)?.storedValue
    : safePersonalUrl(url.trim());
  const label = node.attrs.provider || t(isEmbed ? "Embed" : "Web bookmark");
  useEffect(() => {
    if (editor.storage.personalNewWidgetId === node.attrs.id)
      delete editor.storage.personalNewWidgetId;
  }, [editor, node.attrs.id]);
  useEffect(() => {
    setUrl(node.attrs.value || "");
    setTitle(node.attrs.title || "");
  }, [node.attrs.value, node.attrs.title]);
  return (
    <div>
      {stored && (
        <>
          {embed?.src || embed?.srcDoc ? (
            <EmbedPreview preview={embed} />
          ) : (
            <a
              className={classes.bookmark}
              href={stored}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBookmark size={22} stroke={1.5} />
              <span>
                <strong>
                  {node.attrs.title ||
                    node.attrs.provider ||
                    new URL(stored).hostname}
                </strong>
                <small>{stored}</small>
              </span>
              <IconExternalLink size={16} />
            </a>
          )}
          {embed?.needsEmbedCode && (
            <Text c="dimmed" size="xs" mt={5}>
              {t("This service requires its public embed link or iframe code.")}
            </Text>
          )}
        </>
      )}
      <Popover
        opened={opened && editor.isEditable}
        onChange={setOpened}
        position="bottom-start"
        width={340}
        shadow="md"
        trapFocus
      >
        <Popover.Target>
          <button
            disabled={!editor.isEditable}
            className={stored ? classes.change : classes.placeholder}
            onClick={() => setOpened(!opened)}
            aria-label={
              stored ? t("Change link") : t("Add {{type}}", { type: label })
            }
          >
            {isEmbed ? (
              <IconWorld size={22} stroke={1.5} />
            ) : (
              <IconBookmark size={22} stroke={1.5} />
            )}
            {stored ? t("Change link") : t("Add {{type}}", { type: label })}
          </button>
        </Popover.Target>
        <Popover.Dropdown className={classes.popup}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editor.isEditable && input) {
                updateAttributes({ value: input, title });
                setOpened(false);
              }
            }}
          >
            <Textarea
              aria-label={t(
                isEmbed ? "Embed URL or iframe code" : "Web address",
              )}
              placeholder="https://…"
              autosize
              minRows={2}
              maxRows={5}
              value={url}
              onChange={(e) => setUrl(e.currentTarget.value)}
              error={
                url && !input ? t("Enter a public HTTPS address") : undefined
              }
              data-autofocus
            />
            <TextInput
              mt="sm"
              size="xs"
              aria-label={t("Block title")}
              placeholder={t("Block title")}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            <Button fullWidth mt="sm" type="submit" disabled={!input}>
              {t(isEmbed ? "Embed link" : "Create bookmark")}
            </Button>
            {node.attrs.provider === "Google Maps" && (
              <Text c="dimmed" size="xs" mt="sm">
                {t("Use Google Maps → Share → Embed a map → Copy HTML.")}
              </Text>
            )}
          </form>
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}
