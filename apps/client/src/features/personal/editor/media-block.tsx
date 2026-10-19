import { useEffect, useRef, useState } from "react";
import { Button, Popover, Tabs, Text, TextInput } from "@mantine/core";
import {
  IconFile,
  IconPhoto,
  IconPlayerPlay,
  IconVolume,
} from "@tabler/icons-react";
import { NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { uploadFile } from "@/features/page/services/page-service";
import { getFileUploadSizeLimit, getFileUrl } from "@/lib/config";
import { formatBytes } from "@/lib";
import { safePersonalUrl } from "./widget-utils";
import { resolvePersonalEmbed } from "./embed-adapters";
import EmbedPreview from "./embed-preview";
import {
  replaceMediaPlaceholder,
  mediaAccept,
  mediaLabel,
  validateMediaFile,
} from "./media-block-utils";
import classes from "./block-input.module.css";

type Props = Pick<
  NodeViewProps,
  "node" | "editor" | "getPos" | "updateAttributes"
>;
export default function MediaBlock({
  node,
  editor,
  getPos,
  updateAttributes,
}: Props) {
  const { t } = useTranslation();
  const kind = node.attrs.provider;
  const [opened, setOpened] = useState(
    !!node.attrs.id && editor.storage.personalNewWidgetId === node.attrs.id,
  );
  const [tab, setTab] = useState<string | null>("upload");
  const [link, setLink] = useState(node.attrs.value || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const rawValue = node.attrs.value || "";
  const value = /^\/api\/files\/[a-f0-9-]{36}\//i.test(rawValue) ? getFileUrl(rawValue) : safePersonalUrl(rawValue);
  const video =
    kind === "video" &&
    value &&
    (/youtu\.?be/.test(new URL(value, window.location.origin).hostname)
      ? resolvePersonalEmbed(value, "YouTube")
      : new URL(value, window.location.origin).hostname.endsWith("vimeo.com")
        ? resolvePersonalEmbed(value, "Vimeo")
        : null);
  useEffect(() => {
    mounted.current = true;
    if (editor.storage.personalNewWidgetId === node.attrs.id)
      delete editor.storage.personalNewWidgetId;
    return () => {
      mounted.current = false;
    };
  }, [editor, node.attrs.id]);
  const Icon =
    kind === "image"
      ? IconPhoto
      : kind === "video"
        ? IconPlayerPlay
        : kind === "audio"
          ? IconVolume
          : IconFile;
  const upload = async (file?: File) => {
    if (!file || busy || !editor.isEditable || editor.isDestroyed) return;
    const limit = getFileUploadSizeLimit();
    if (!validateMediaFile(kind, file, limit)) {
      setError(
        file.size > limit
          ? t("File exceeds the {{limit}} attachment limit", {
              limit: formatBytes(limit),
            })
          : t("Choose a {{type}} file", { type: t(mediaLabel(kind)) }),
      );
      return;
    }
    const pageId = editor.storage.pageId;
    if (!pageId) return;
    setBusy(true);
    setError("");
    try {
      const attachment = await uploadFile(file, pageId);
      if (mounted.current)
        replaceMediaPlaceholder(
          editor,
          getPos,
          pageId,
          node.attrs.id,
          kind,
          attachment,
        );
    } catch {
      if (mounted.current) setError(t("Upload failed. Try again."));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div className={classes.media} data-media-kind={kind}>
      {value && (
        <div className={classes.preview}>
          {kind === "image" ? (
            <img src={value} alt={node.attrs.title || ""} />
          ) : video ? (
            <EmbedPreview preview={video} />
          ) : kind === "video" ? (
            <video src={value} controls preload="metadata" />
          ) : kind === "audio" ? (
            <audio src={value} controls preload="metadata" />
          ) : kind === "pdf" ? (
            <iframe
              title="PDF"
              src={value}
              sandbox=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <a href={value} target="_blank" rel="noopener noreferrer">
              <Icon size={20} /> {node.attrs.title || value}
            </a>
          )}
        </div>
      )}
      <Popover
        opened={opened && editor.isEditable}
        onChange={setOpened}
        position="bottom-start"
        shadow="md"
        width={340}
        trapFocus
      >
        <Popover.Target>
          <button
            className={value ? classes.change : classes.placeholder}
            disabled={!editor.isEditable || busy}
            onClick={() => setOpened(!opened)}
            aria-label={t("Add {{type}}", { type: t(mediaLabel(kind)) })}
          >
            <Icon size={22} stroke={1.5} />{" "}
            {value
              ? t("Change")
              : t("Add {{type}}", { type: t(mediaLabel(kind)) })}
          </button>
        </Popover.Target>
        <Popover.Dropdown className={classes.popup}>
          <Tabs value={tab} onChange={setTab}>
            <Tabs.List>
              <Tabs.Tab value="upload">{t("Upload")}</Tabs.Tab>
              <Tabs.Tab value="link">{t("Embed link")}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="upload" pt="md">
              <input
                ref={input}
                hidden
                type="file"
                accept={mediaAccept(kind)}
                aria-label={t("Upload {{type}}", { type: t(mediaLabel(kind)) })}
                onChange={(e) => {
                  void upload(e.currentTarget.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
              <Button
                fullWidth
                loading={busy}
                onClick={() => input.current?.click()}
              >
                {t("Choose a file")}
              </Button>
              <Text size="xs" c="dimmed" mt="sm">
                {t("File limit: {{limit}}", {
                  limit: formatBytes(getFileUploadSizeLimit()),
                })}
              </Text>
            </Tabs.Panel>
            <Tabs.Panel value="link" pt="md">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const url = safePersonalUrl(link.trim());
                  if (url && editor.isEditable && !busy) {
                    updateAttributes({ value: url });
                    setOpened(false);
                  }
                }}
              >
                <TextInput
                  aria-label={t("Web address")}
                  placeholder="https://…"
                  value={link}
                  onChange={(e) => setLink(e.currentTarget.value)}
                  data-autofocus={tab === "link" || undefined}
                />
                <Button
                  fullWidth
                  mt="sm"
                  type="submit"
                  disabled={!safePersonalUrl(link.trim()) || busy}
                >
                  {t("Embed {{type}}", { type: t(mediaLabel(kind)) })}
                </Button>
              </form>
            </Tabs.Panel>
          </Tabs>
          {error && (
            <Text role="alert" c="red" size="sm" mt="sm">
              {error}
            </Text>
          )}
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}
