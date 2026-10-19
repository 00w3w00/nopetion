import { ReactRenderer, useEditor } from "@tiptap/react";
import CommandList from "@/features/editor/components/slash-menu/command-list";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
} from "@floating-ui/dom";
import { exitSuggestion } from "@tiptap/suggestion";
import {
  slashMenuPluginKey,
  angleMenuPluginKey,
} from "@/features/editor/extensions/slash-command";

const renderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: HTMLElement | null = null;
  let cleanup: (() => void) | null = null;
  let getReferenceClientRect: (() => DOMRect) | null = null;
  let activeEditor: ReturnType<typeof useEditor> | null = null;
  let activeKey = slashMenuPluginKey;

  const updatePosition = () => {
    if (!popup || !getReferenceClientRect) return;
    const element = popup;

    // @ts-ignore
    const rect = getReferenceClientRect();

    computePosition({ getBoundingClientRect: () => rect }, element, {
      placement: "bottom-start",
      middleware: [
        offset(0),
        flip({ padding: 8 }),
        shift({ crossAxis: true, padding: 8 }),
        size({
          padding: 8,
          apply({ availableHeight }) {
            if (popup !== element) return;
            const scroll = element.querySelector<HTMLElement>(
              ".mantine-ScrollArea-root",
            );
            if (!scroll) return;
            const chrome =
              element.getBoundingClientRect().height -
              scroll.getBoundingClientRect().height;
            element.style.setProperty(
              "--slash-menu-scroll-height",
              `${Math.max(0, Math.min(350, availableHeight - chrome))}px`,
            );
          },
        }),
      ],
    }).then(({ x, y }) => {
      if (popup === element) {
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      }
    });
  };

  return {
    onStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
      range?: { from: number; to: number };
    }) => {
      activeEditor = props.editor;
      activeKey =
        props.range &&
        props.editor.state.doc.textBetween(
          props.range.from,
          props.range.from + 1,
        ) === "<"
          ? angleMenuPluginKey
          : slashMenuPluginKey;
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      // @ts-ignore
      getReferenceClientRect = props.clientRect;

      popup = document.createElement("div");
      popup.style.zIndex = "199";
      popup.style.position = "absolute";
      popup.style.top = "0";
      popup.style.left = "0";

      document.body.appendChild(popup);
      popup.appendChild(component.element);

      const stopAutoUpdate = autoUpdate(
        // @ts-ignore
        {
          getBoundingClientRect: () => {
            return getReferenceClientRect
              ? getReferenceClientRect()
              : new DOMRect();
          },
          contextElement: props.editor.view.dom,
        },
        popup,
        updatePosition,
      );
      const viewport = window.visualViewport;
      viewport?.addEventListener("resize", updatePosition);
      viewport?.addEventListener("scroll", updatePosition);
      cleanup = () => {
        stopAutoUpdate();
        viewport?.removeEventListener("resize", updatePosition);
        viewport?.removeEventListener("scroll", updatePosition);
      };
    },
    onUpdate: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {
      component?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      // @ts-ignore
      getReferenceClientRect = props.clientRect;
      updatePosition();
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key === "Escape") {
        if (activeEditor) exitSuggestion(activeEditor.view, activeKey);

        return true;
      }

      // @ts-ignore
      return component?.ref?.onKeyDown(props);
    },
    onExit: () => {
      activeEditor = null;
      if (cleanup) {
        cleanup();
        cleanup = null;
      }

      if (popup) {
        popup.remove();
        popup = null;
      }

      if (component) {
        component.destroy();
        component = null;
      }
    },
  };
};

export default renderItems;
