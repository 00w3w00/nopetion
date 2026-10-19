import ConnectorWidget from "@/features/personal-connectors/connector-widget";
import RecordingBlock from "./recording-block";
import { useEffect, useState } from "react";
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Button, Group, Textarea } from "@mantine/core";
import { IconCode } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useSetAtom } from "jotai";
import { personalHtmlPreview } from "./widget-utils";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import classes from "./widget-view.module.css";
import MediaBlock from "./media-block";
import LinkBlock from "./link-block";
import ButtonBlock from "./button-block";
import {
  usePageBreadcrumbsQuery,
  usePageQuery,
} from "@/features/page/queries/page-query";
import { Link } from "react-router-dom";
import { buildPageUrl } from "@/features/page/page.utils";
export default function WidgetView({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation();
  const setAside = useSetAtom(asideStateAtom);
  const [version, setVersion] = useState(0);
  const editable = editor.isEditable;
  useEffect(() => {
    const refresh = () => setVersion((n) => n + 1);
    editor.on("update", refresh);
    return () => {
      editor.off("update", refresh);
    };
  }, [editor]);
  const kind = node.attrs.kind;
  const headings: { text: string; pos: number; level: number }[] = [];
  if (kind === "toc")
    editor.state.doc.descendants((child, pos) => {
      if (child.type.name === "heading")
        headings.push({
          text: child.textContent,
          pos,
          level: child.attrs.level,
        });
    });
  return (
    <NodeViewWrapper
      className={classes.widget}
      contentEditable={false}
      data-personal-widget={kind}
      data-type="personalWidget"
      data-widget-id={node.attrs.id}
    >
      {kind === "connector" && <ConnectorWidget node={node} editor={editor} getPos={getPos} />}
      {kind === "recording" && <RecordingBlock node={node} editor={editor} getPos={getPos} updateAttributes={updateAttributes} />}
      {kind === "toc" && (
        <nav aria-label={t("Table of contents")} data-version={version}>
          {headings.length ? (
            headings.map((heading) => (
              <button
                key={heading.pos}
                style={{ paddingLeft: (heading.level - 1) * 14 }}
                onClick={() => {
                  editor.commands.setTextSelection(heading.pos + 1);
                  editor.commands.scrollIntoView();
                }}
              >
                {heading.text || t("Untitled")}
              </button>
            ))
          ) : (
            <p>{t("Add headings to show the table of contents.")}</p>
          )}
        </nav>
      )}
      {kind === "breadcrumb" && (
        <BreadcrumbWidget pageId={editor.storage.pageId} />
      )}
      {kind === "button" && (
        <ButtonBlock
          node={node}
          editor={editor}
          getPos={getPos}
          updateAttributes={updateAttributes}
        />
      )}
      {kind === "media" && (
        <MediaBlock
          node={node}
          editor={editor}
          getPos={getPos}
          updateAttributes={updateAttributes}
        />
      )}
      {kind === "ai" && (
        <div className={classes.ai}>
          <strong>✦ {t("AI block")}</strong>
          <p>{t("Write with your connected AI and add the result below.")}</p>
          <Button
            variant="light"
            size="xs"
            onClick={() => {
              const pos = getPos();
              if (typeof pos === "number" && !editor.isDestroyed)
                editor.commands.setNodeSelection(pos);
              setAside({ tab: "personal-ai", isAsideOpen: true });
            }}
          >
            {t("Open AI assistant")}
          </Button>
        </div>
      )}
      {kind === "date" && (
        <Group>
          <input
            className={classes.date}
            type="date"
            aria-label={t("Date")}
            value={node.attrs.value || ""}
            readOnly={!editable}
            onChange={(e) => updateAttributes({ value: e.target.value })}
          />
          <small>{t("Date marker")}</small>
        </Group>
      )}
      {kind === "html" && (
        <>
          <Group gap="xs">
            <IconCode size={17} />
            <strong>{t("HTML embed")}</strong>
          </Group>
          {editable && (
            <Textarea
              aria-label={t("HTML source")}
              placeholder="<h2>Hello</h2>"
              autosize
              minRows={3}
              maxRows={10}
              value={node.attrs.value || ""}
              maxLength={100000}
              onChange={(e) =>
                updateAttributes({ value: e.currentTarget.value })
              }
              mt="sm"
            />
          )}
          <iframe
            title={t("HTML preview")}
            sandbox=""
            srcDoc={personalHtmlPreview(node.attrs.value || "")}
            className={classes.htmlPreview}
          />
        </>
      )}
      {(kind === "bookmark" || kind === "embed") && (
        <LinkBlock
          node={node}
          editor={editor}
          getPos={getPos}
          updateAttributes={updateAttributes}
        />
      )}
    </NodeViewWrapper>
  );
}
export function TabsView({ node, editor, getPos }: NodeViewProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const titles: string[] = [];
  node.forEach((tab) => titles.push(tab.attrs.title));
  const editTitle = (index: number, title: string) => {
    const pos = getPos();
    const live = typeof pos === "number" && editor.state.doc.nodeAt(pos);
    if (!live || !editor.isEditable) return;
    let offset = 0;
    for (let i = 0; i < index; i++) offset += live.child(i).nodeSize;
    const tab = live.child(index);
    editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(pos + 1 + offset, undefined, { ...tab.attrs, title });
      return true;
    });
  };
  const add = () => {
    const pos = getPos();
    const live = typeof pos === "number" && editor.state.doc.nodeAt(pos);
    if (!live || !editor.isEditable) return;
    editor.commands.insertContentAt(pos + live.nodeSize - 1, {
      type: "personalTab",
      attrs: { title: `${t("Tab")} ${live.childCount + 1}` },
      content: [{ type: "paragraph" }],
    });
    setActive(live.childCount);
  };
  return (
    <NodeViewWrapper
      className={classes.tabs}
      data-personal-tabs
      data-type="personalTabs"
      style={{ "--active-tab": active } as React.CSSProperties}
    >
      <div className={classes.tabBar} contentEditable={false} role="tablist">
        {titles.map((title, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={active === index}
            onClick={() => setActive(index)}
          >
            <input
              aria-label={`${t("Tab title")} ${index + 1}`}
              value={title}
              readOnly={!editor.isEditable}
              maxLength={100}
              onChange={(e) => editTitle(index, e.target.value)}
            />
          </button>
        ))}
        {editor.isEditable && (
          <button aria-label={t("Add tab")} onClick={add}>
            ＋
          </button>
        )}
      </div>
      <NodeViewContent
        className={classes.tabContent}
        data-active-tab={active}
      />
      <style>{`[data-personal-tabs] [data-active-tab="${active}"] > div > section[data-type="personalTab"]:not(:nth-child(${active + 1})) {display:none}`}</style>
    </NodeViewWrapper>
  );
}

export function ToggleHeadingView({
  node,
  editor,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation();
  const [viewOpen, setViewOpen] = useState(!!node.attrs.open);
  useEffect(() => setViewOpen(!!node.attrs.open), [node.attrs.open]);
  const open = editor.isEditable ? !!node.attrs.open : viewOpen;
  return (
    <NodeViewWrapper
      className={classes.toggle}
      data-personal-toggle
      data-type="personalToggle"
      data-open={open}
    >
      <button
        className={classes.toggleButton}
        contentEditable={false}
        aria-label={t(open ? "Collapse" : "Expand")}
        aria-expanded={open}
        onClick={() =>
          editor.isEditable
            ? updateAttributes({ open: !open })
            : setViewOpen(!open)
        }
      >
        {open ? "▾" : "▸"}
      </button>
      <NodeViewContent className={classes.toggleContent} />
    </NodeViewWrapper>
  );
}

function BreadcrumbWidget({ pageId }: { pageId: string }) {
  const { t } = useTranslation();
  const { data: page } = usePageQuery({ pageId });
  const { data: path } = usePageBreadcrumbsQuery(pageId);
  const nodes = [...(path || [])];
  if (page && !nodes.some((node) => node.id === page.id)) nodes.push(page);
  return (
    <nav className={classes.breadcrumb} aria-label={t("Breadcrumb")}>
      {nodes.map((node, index) => (
        <span key={node.id}>
          {index > 0 && " / "}
          <Link to={buildPageUrl(undefined, node.slugId, node.title)}>
            {node.icon} {node.title || t("Untitled")}
          </Link>
        </span>
      ))}
    </nav>
  );
}
