import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import renderItems from '@/features/editor/components/slash-menu/render-items';
import getSuggestionItems from '@/features/editor/components/slash-menu/menu-items';

export const slashMenuPluginKey = new PluginKey('slash-command');
export const angleMenuPluginKey = new PluginKey('angle-command');

// @ts-ignore
const Command = Extension.create({
  name: 'slash-command',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        allowSpaces: true,
        command: ({ editor, range, props }) => {
          props.command({ editor, range, props });
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          // Disable slash menu inside code blocks
          if ($from.parent.type.name === 'codeBlock') {
            return false;
          }
          return true;
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: slashMenuPluginKey,
        ...this.options.suggestion,
        editor: this.editor,
      }),
    ];
  },
});

const SlashCommand = Command.configure({
  suggestion: {
    items: getSuggestionItems,
    render: renderItems,
  },
});

export const AngleCommand = Command.extend({ name: 'angle-command' }).configure({
  suggestion: {
    char: '<', pluginKey: angleMenuPluginKey,
    items: getSuggestionItems, render: renderItems,
    allow: ({ state, range }) => {
      const parent = state.doc.resolve(range.from);
      return parent.parent.type.name === 'paragraph' && parent.parentOffset === 0;
    },
  },
});

export { Command as SlashCommandExtension };
export default SlashCommand;
