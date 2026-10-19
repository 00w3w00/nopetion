import { ReactRenderer, useEditor } from "@tiptap/react";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import MentionList from "@/features/editor/components/mention/mention-list.tsx";
import { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion";
import { MentionPluginKey } from "@docmost/editor-ext";

function getWhitespaceCount(query: string) {
  const matches = query?.match(/([\s]+)/g);
  return matches?.length || 0;
}

const mentionRenderItems = () => {
  let component: ReactRenderer | null = null;
  let activeClientRect: (() => DOMRect) | null = null;
  let updatePositionCleanup: (() => void) | null = null;
  let outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  let activeEditor: ReturnType<typeof useEditor> | null = null;
  const exit = () => {
    if (activeEditor && !activeEditor.isDestroyed) exitSuggestion(activeEditor.view, MentionPluginKey);
    else destroy();
  };

  const destroy = () => {
    if (outsideClickHandler) {
      document.removeEventListener("pointerdown", outsideClickHandler);
      outsideClickHandler = null;
    }
    updatePositionCleanup?.();
    updatePositionCleanup = null;
    component?.destroy();
    if (component?.element?.parentNode) {
      component.element.parentNode.removeChild(component.element);
    }
    component = null;
  };

  return {
    onStart: (props: SuggestionProps) => {
      activeEditor = props.editor;
      // query must not start with a whitespace
      if (props.query.charAt(0) === " ") {
        exit();
        return;
      }

      // don't render component if space between the search query words is greater than 4
      const whitespaceCount = getWhitespaceCount(props.query);
      if (whitespaceCount > 4) {
        exit();
        return;
      }

      const editorDom = props.editor?.view?.dom;
      const asideEl = editorDom?.closest(".mantine-AppShell-aside");
      const dialogEl = editorDom?.closest("[data-comment-dialog]");
      const chatInput = editorDom?.closest("[data-chat-input]");
      const isInCommentContext = !!(asideEl || dialogEl || chatInput);

      component = new ReactRenderer(MentionList, {
        props: { ...props, isInCommentContext },
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      activeClientRect = props.clientRect;

      const { element } = component;
      document.body.appendChild(element);

      outsideClickHandler = (e: MouseEvent) => {
        const target = e.target as Node;
        if (element && !element.contains(target)) {
          exit();
        }
      };
      document.addEventListener("pointerdown", outsideClickHandler);

      const shiftMiddleware = asideEl
        ? shift({ boundary: asideEl, crossAxis: true, padding: 8 })
        : shift();

      updatePositionCleanup = autoUpdate(
        {
          getBoundingClientRect: () =>
            activeClientRect ? activeClientRect() : new DOMRect(),
        },
        element,
        () => {
          if (!component?.element) return;
          computePosition(
            {
              getBoundingClientRect: () => {
                return activeClientRect ? activeClientRect() : new DOMRect();
              },
            },
            element,
            {
              placement: "bottom-start",
              middleware: [offset(4), flip(), shiftMiddleware],
            },
          ).then(({ x, y }) => {
            Object.assign(element.style, {
              left: `${x}px`,
              top: `${y}px`,
              position: "absolute",
              zIndex: "190",
            });
          });
        },
      );
    },
    onUpdate: (props: SuggestionProps) => {
      // query must not start with a whitespace
      if (props.query.charAt(0) === " ") {
        exit();
        return;
      }

      // only update component if popup is not destroyed
      if (component) {
        component.updateProps(props);
      }

      if (!props || !props.clientRect) {
        return;
      }

      activeClientRect = props.clientRect;

      const whitespaceCount = getWhitespaceCount(props.query);

      // destroy component if space is greater 3 without a match
      if (
        whitespaceCount > 4 &&
        //@ts-ignore
        props.editor.storage.mentionItems?.length === 1
      ) {
        exit();
        return;
      }
      // fallback exit
      if (whitespaceCount > 7) {
        exit();
        return;
      }
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.isComposing || props.event.keyCode === 229) return false;
      if (props.event.key === "Escape") {
        exit();
        return true;
      }

      if (props.event.key === "Enter" && !component) {
        destroy();
        return false;
      }

      return (component?.ref as any)?.onKeyDown(props);
    },
    onExit: () => {
      if (activeEditor) activeEditor.storage.mentionEntityFilter = undefined;
      activeEditor = null;
      destroy();
    },
  };
};

export default mentionRenderItems;
