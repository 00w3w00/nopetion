import { useEffect, useRef, useState } from "react";
import { Editor } from "@tiptap/core";
import { Transaction } from "@tiptap/pm/state";
import { Menu } from "@mantine/core";
import {
  IconTrash,
  IconCopy,
  IconTransform,
  IconArrowUp,
  IconArrowDown,
  IconSparkles,
  IconPalette,
} from "@tabler/icons-react";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import {
  convertibleBlocks,
  convertBlock,
  duplicateBlock,
  moveBlock,
} from "./block-actions";

export const PERSONAL_BLOCK_MENU = "nopetion:block-menu";
type Target = { pos: number; left: number; top: number };
export default function BlockMenu({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const setAside = useSetAtom(asideStateAtom);
  const [target, setTarget] = useState<Target | null>(null);
  const current = useRef<Target | null>(null);
  useEffect(() => {
    const close = () => {
      current.current = null;
      setTarget(null);
    };
    const open = (event: Event) => {
      if (!editor.isEditable || editor.isDestroyed) return;
      const detail = (event as CustomEvent<Target>).detail;
      if (!editor.state.doc.nodeAt(detail.pos)) return;
      current.current = detail;
      setTarget(detail);
    };
    const map = ({ transaction }: { transaction: Transaction }) => {
      if (!current.current) return;
      const mapped = transaction.mapping.mapResult(current.current.pos, 1);
      if (mapped.deleted || !editor.isEditable) close();
      else {
        current.current = { ...current.current, pos: mapped.pos };
        setTarget(current.current);
      }
    };
    const dom = editor.view.dom;
    dom.addEventListener(PERSONAL_BLOCK_MENU, open);
    editor.on("transaction", map);
    editor.on("destroy", close);
    return () => {
      dom.removeEventListener(PERSONAL_BLOCK_MENU, open);
      editor.off("transaction", map);
      editor.off("destroy", close);
    };
  }, [editor]);
  const node =
    target && !editor.isDestroyed ? editor.state.doc.nodeAt(target.pos) : null;
  const act = (action: (pos: number) => void) => {
    if (current.current && editor.isEditable && !editor.isDestroyed)
      action(current.current.pos);
    current.current = null;
    setTarget(null);
  };
  const color = (value: string) =>
    act((pos) => {
      const live = editor.state.doc.nodeAt(pos);
      if (!live) return;
      editor
        .chain()
        .focus()
        .setTextSelection({ from: pos + 1, to: pos + live.nodeSize - 1 })
        .setColor(value)
        .run();
    });
  return (
    <Menu
      opened={!!target}
      onChange={(opened) => {
        if (!opened) {
          current.current = null;
          setTarget(null);
        }
      }}
      position="right-start"
      shadow="md"
      width={240}
      withinPortal
    >
      <Menu.Target>
        <button
          aria-hidden
          tabIndex={-1}
          style={{
            position: "fixed",
            left: target?.left || 0,
            top: target?.top || 0,
            width: 20,
            height: 24,
            opacity: 0,
            pointerEvents: "none",
            border: 0,
          }}
        />
      </Menu.Target>
      <Menu.Dropdown aria-label={t("Block actions")}>
        <Menu.Item
          leftSection={<IconSparkles size={17} />}
          onClick={() =>
            act((pos) => {
              editor.commands.setNodeSelection(pos);
              setAside({ tab: "personal-ai", isAsideOpen: true });
            })
          }
        >
          {t("Ask AI")}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Sub disabled={!node || !convertibleBlocks.has(node.type.name)}>
          <Menu.Sub.Target>
            <Menu.Sub.Item leftSection={<IconTransform size={17} />}>
              {t("Turn into")}
            </Menu.Sub.Item>
          </Menu.Sub.Target>
          <Menu.Sub.Dropdown>
            {[
              ["paragraph", "Text"],
              ["heading1", "Heading 1"],
              ["heading2", "Heading 2"],
              ["heading3", "Heading 3"],
              ["heading4", "Heading 4"],
              ["bulletList", "Bullet list"],
              ["orderedList", "Numbered list"],
              ["taskList", "To-do list"],
              ["details", "Toggle list"],
              ["blockquote", "Quote"],
              ["callout", "Callout"],
            ].map(([kind, title]) => (
              <Menu.Item
                key={kind}
                onClick={() =>
                  act((pos) => {
                    const live = editor.state.doc.nodeAt(pos);
                    if (!live) return;
                    const content = convertBlock(live.toJSON(), kind);
                    if (content)
                      editor
                        .chain()
                        .focus()
                        .insertContentAt(
                          { from: pos, to: pos + live.nodeSize },
                          content,
                        )
                        .run();
                  })
                }
              >
                {t(title)}
              </Menu.Item>
            ))}
          </Menu.Sub.Dropdown>
        </Menu.Sub>
        <Menu.Sub disabled={!node || !convertibleBlocks.has(node.type.name)}>
          <Menu.Sub.Target>
            <Menu.Sub.Item leftSection={<IconPalette size={17} />}>
              {t("Color")}
            </Menu.Sub.Item>
          </Menu.Sub.Target>
          <Menu.Sub.Dropdown>
            {[
              ["Default", "inherit"],
              ["Gray", "#787774"],
              ["Brown", "#9f6b53"],
              ["Orange", "#d9730d"],
              ["Yellow", "#cb912f"],
              ["Green", "#448361"],
              ["Blue", "#337ea9"],
              ["Purple", "#9065b0"],
              ["Pink", "#c14c8a"],
              ["Red", "#d44c47"],
            ].map(([label, value]) => (
              <Menu.Item
                key={label}
                onClick={() => color(value)}
                leftSection={<span style={{ color: value }}>A</span>}
              >
                {t(label)}
              </Menu.Item>
            ))}
          </Menu.Sub.Dropdown>
        </Menu.Sub>
        <Menu.Item
          leftSection={<IconCopy size={17} />}
          disabled={node?.type.name === "transclusionSource"}
          onClick={() => act((pos) => duplicateBlock(editor, pos))}
        >
          {t("Duplicate")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconArrowUp size={17} />}
          onClick={() => act((pos) => moveBlock(editor, pos, -1))}
        >
          {t("Move up")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconArrowDown size={17} />}
          onClick={() => act((pos) => moveBlock(editor, pos, 1))}
        >
          {t("Move down")}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={17} />}
          onClick={() =>
            act((pos) => {
              const live = editor.state.doc.nodeAt(pos);
              if (live)
                editor
                  .chain()
                  .focus()
                  .deleteRange({ from: pos, to: pos + live.nodeSize })
                  .run();
            })
          }
        >
          {t("Delete")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
