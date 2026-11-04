import type { Editor } from "@tiptap/core";
import { useEffect, useId, useState } from "react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import classes from "./floating-table-of-contents.module.css";

type OutlineHeading = {
  position: number;
  level: number;
  label: string;
  element: HTMLElement;
};

export default function FloatingTableOfContents({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const panelId = useId();
  const aside = useAtomValue(asideStateAtom);
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    let frame = 0;
    const collect = () => {
      if (editor.isDestroyed) return;
      const next: OutlineHeading[] = [];
      editor.state.doc.descendants((node, position) => {
        if (node.type.name !== "heading" || !node.textContent.trim()) return;
        const element = editor.view.nodeDOM(position);
        if (element instanceof HTMLElement) {
          next.push({ position, level: node.attrs.level, label: node.textContent, element });
        }
      });
      setHeadings(next);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(collect);
    };
    schedule();
    editor.on("create", schedule);
    editor.on("update", schedule);
    return () => {
      cancelAnimationFrame(frame);
      editor.off("create", schedule);
      editor.off("update", schedule);
    };
  }, [editor]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      // Match the fixed document header and leave room above the heading.
      let current = headings[0]?.position ?? null;
      for (const heading of headings) {
        if (heading.element.getBoundingClientRect().top <= 100) current = heading.position;
      }
      setActive(current);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (editor && !editor.isDestroyed) observer?.observe(editor.view.dom);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [editor, headings]);

  if (!headings.length || aside.isAsideOpen) return null;

  return (
    <nav
      className={classes.outline}
      aria-label={t("Table of contents")}
      data-open={open || undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!document.activeElement?.closest(`[id="${panelId}"]`)) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          event.stopPropagation();
        }
      }}
    >
      <button
        type="button"
        className={classes.rail}
        aria-label={t("Table of contents")}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        {headings.map((heading) => (
          <span
            key={heading.position}
            className={classes.marker}
            data-active={heading.position === active || undefined}
            style={{ width: `${Math.max(10, 26 - (heading.level - 1) * 6)}px` }}
          />
        ))}
      </button>
      <div id={panelId} className={classes.panel} hidden={!open}>
        <div className={classes.caption}>{t("Table of contents")}</div>
        <div className={classes.list}>
          {headings.map((heading) => (
            <button
              type="button"
              key={heading.position}
              className={classes.link}
              aria-current={heading.position === active ? "location" : undefined}
              style={{ paddingInlineStart: `${12 + (heading.level - 1) * 12}px` }}
              onClick={() => {
                if (!heading.element.isConnected) return;
                window.scrollTo({
                  top: Math.max(0, window.scrollY + heading.element.getBoundingClientRect().top - 80),
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                });
                setActive(heading.position);
              }}
            >
              {heading.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
