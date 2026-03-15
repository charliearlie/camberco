/**
 * Slash command menu for TipTap.
 *
 * Pure implementation without @tiptap/suggestion or tippy.js —
 * uses a ProseMirror Plugin that intercepts "/" keystrokes and manages
 * a React portal rendered into the document body.
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useState,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/core';

// ----------------------------------------------------------------
// Command definitions
// ----------------------------------------------------------------

export interface CommandItem {
  icon: string;
  label: string;
  hint: string;
  command: (editor: Editor) => void;
}

const ALL_COMMANDS: CommandItem[] = [
  {
    icon: 'H2',
    label: 'Heading 2',
    hint: '##',
    command: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    icon: 'H3',
    label: 'Heading 3',
    hint: '###',
    command: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    icon: '•',
    label: 'Bullet List',
    hint: '- item',
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    icon: '1.',
    label: 'Ordered List',
    hint: '1. item',
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    icon: '"',
    label: 'Blockquote',
    hint: '> quote',
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    icon: '</>',
    label: 'Code Block',
    hint: '```',
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    icon: 'img',
    label: 'Image',
    hint: 'embed',
    command: (editor) => {
      const url = window.prompt('Image URL');
      if (url) editor.chain().focus().setImage({ src: url }).run();
    },
  },
  {
    icon: '—',
    label: 'Horizontal Rule',
    hint: '---',
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
];

// ----------------------------------------------------------------
// Menu React component
// ----------------------------------------------------------------

interface MenuProps {
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
}

export interface MenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashMenu = forwardRef<MenuHandle, MenuProps>(({ items, onSelect }, ref) => {
  const [selected, setSelected] = useState(0);

  useLayoutEffect(() => {
    setSelected(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === 'Enter') {
        if (items[selected]) onSelect(items[selected]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  return (
    <div className="slash-menu">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`slash-menu-item${i === selected ? ' is-selected' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          onMouseEnter={() => setSelected(i)}
        >
          <span className="slash-menu-item-icon">{item.icon}</span>
          <span className="slash-menu-item-label">{item.label}</span>
          <span className="slash-menu-item-hint">{item.hint}</span>
        </div>
      ))}
    </div>
  );
});

SlashMenu.displayName = 'SlashMenu';

// ----------------------------------------------------------------
// Plugin state
// ----------------------------------------------------------------

const slashKey = new PluginKey('slashCommand');

interface SlashState {
  active: boolean;
  query: string;
  slashPos: number;
}

// ----------------------------------------------------------------
// Extension
// ----------------------------------------------------------------

const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    const editor = this.editor;
    let containerEl: HTMLDivElement | null = null;
    let root: Root | null = null;
    let menuRef: MenuHandle | null = null;

    function getMenuItems(query: string): CommandItem[] {
      const q = query.toLowerCase();
      return ALL_COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
    }

    function showMenu(view: EditorView, slashPos: number, query: string) {
      // Get cursor coordinates
      const coords = view.coordsAtPos(slashPos);

      if (!containerEl) {
        containerEl = document.createElement('div');
        containerEl.style.position = 'fixed';
        containerEl.style.zIndex = '9999';
        document.body.appendChild(containerEl);
        root = createRoot(containerEl);
      }

      containerEl.style.left = `${coords.left}px`;
      containerEl.style.top = `${coords.bottom + 4}px`;

      const items = getMenuItems(query);

      const handleSelect = (item: CommandItem) => {
        // Delete the slash + query text
        const { state, dispatch } = view;
        const tr = state.tr.delete(slashPos, state.selection.from);
        dispatch(tr);
        item.command(editor);
        hideMenu();
      };

      root?.render(
        <SlashMenu
          ref={(r) => { menuRef = r; }}
          items={items}
          onSelect={handleSelect}
        />
      );
    }

    function hideMenu() {
      if (root) {
        root.render(null);
      }
      menuRef = null;
    }

    return [
      new Plugin({
        key: slashKey,
        state: {
          init(): SlashState {
            return { active: false, query: '', slashPos: -1 };
          },
          apply(tr, prev): SlashState {
            const meta = tr.getMeta(slashKey) as SlashState | undefined;
            if (meta !== undefined) return meta;
            if (!prev.active) return prev;
            // If doc changed reset pos
            if (tr.docChanged) {
              const mappedPos = tr.mapping.map(prev.slashPos);
              return { ...prev, slashPos: mappedPos };
            }
            return prev;
          },
        },
        view() {
          return {
            update(view) {
              const pluginState = slashKey.getState(view.state) as SlashState;
              if (!pluginState.active) {
                hideMenu();
                return;
              }
              const { slashPos, query } = pluginState;
              showMenu(view, slashPos, query);
            },
            destroy() {
              hideMenu();
              if (containerEl) {
                setTimeout(() => {
                  root?.unmount();
                  containerEl?.remove();
                  containerEl = null;
                  root = null;
                }, 0);
              }
            },
          };
        },
        props: {
          handleKeyDown(view, event) {
            const state = slashKey.getState(view.state) as SlashState;

            // If menu is open, delegate arrow/enter to menu
            if (state.active) {
              if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
                return menuRef?.onKeyDown(event) ?? false;
              }
              if (event.key === 'Escape') {
                view.dispatch(
                  view.state.tr.setMeta(slashKey, {
                    active: false,
                    query: '',
                    slashPos: -1,
                  })
                );
                hideMenu();
                return true;
              }
            }

            return false;
          },
          handleTextInput(view, _from, _to, text) {
            if (text === '/') {
              const pos = view.state.selection.from;
              // Delay so the character is actually inserted first
              setTimeout(() => {
                view.dispatch(
                  view.state.tr.setMeta(slashKey, {
                    active: true,
                    query: '',
                    slashPos: pos,
                  })
                );
              }, 0);
            } else {
              const state = slashKey.getState(view.state) as SlashState;
              if (state.active) {
                const { from } = view.state.selection;
                const slashPos = state.slashPos;
                // Extract typed query after the slash
                const query = view.state.doc.textBetween(slashPos + 1, from) + text;
                setTimeout(() => {
                  view.dispatch(
                    view.state.tr.setMeta(slashKey, {
                      active: true,
                      query,
                      slashPos,
                    })
                  );
                }, 0);
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

export default SlashCommandExtension;
