import React, { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';

interface EditorToolbarProps {
  editor: Editor;
  onImageUpload?: () => Promise<string>;
}

interface ToolbarButton {
  label: string;
  title: string;
  action: () => void;
  isActive: () => boolean;
  disabled?: () => boolean;
}

interface ToolbarGroup {
  buttons: ToolbarButton[];
}

// ----------------------------------------------------------------
// Inline bubble menu — shown when text is selected
// ----------------------------------------------------------------

function BubbleMenuBar({ editor }: { editor: Editor }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', prev ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  useEffect(() => {
    const update = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        setRect(null);
        return;
      }
      const view = editor.view;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      // Build a synthetic rect centered above the selection
      const syntheticRect = new DOMRect(
        (start.left + end.left) / 2,
        start.top,
        0,
        0
      );
      setRect(syntheticRect);
    };

    const clearRect = (_: unknown) => setRect(null);

    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    editor.on('blur', clearRect);

    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      editor.off('blur', clearRect);
    };
  }, [editor]);

  if (!rect) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: rect.left,
    top: rect.top - 52,
    transform: 'translateX(-50%)',
    zIndex: 200,
  };

  return (
    <div className="bubble-menu" style={style}>
      <button
        className={`toolbar-btn${editor.isActive('bold') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        type="button"
        title="Bold"
      >B</button>
      <button
        className={`toolbar-btn${editor.isActive('italic') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        type="button"
        title="Italic"
      >I</button>
      <button
        className={`toolbar-btn${editor.isActive('code') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}
        type="button"
        title="Inline Code"
      >`</button>
      <div className="toolbar-divider" />
      <button
        className={`toolbar-btn${editor.isActive('link') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); setLink(); }}
        type="button"
        title="Link"
      >link</button>
    </div>
  );
}

// ----------------------------------------------------------------
// Main toolbar
// ----------------------------------------------------------------

export default function EditorToolbar({ editor, onImageUpload }: EditorToolbarProps) {
  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', prev ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  const insertImage = useCallback(() => {
    if (onImageUpload) {
      onImageUpload().catch(() => {});
    } else {
      const url = window.prompt('Image URL');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
  }, [editor, onImageUpload]);

  const groups: ToolbarGroup[] = [
    {
      buttons: [
        {
          label: 'B',
          title: 'Bold',
          action: () => editor.chain().focus().toggleBold().run(),
          isActive: () => editor.isActive('bold'),
        },
        {
          label: 'I',
          title: 'Italic',
          action: () => editor.chain().focus().toggleItalic().run(),
          isActive: () => editor.isActive('italic'),
        },
        {
          label: 'S',
          title: 'Strikethrough',
          action: () => editor.chain().focus().toggleStrike().run(),
          isActive: () => editor.isActive('strike'),
        },
      ],
    },
    {
      buttons: [
        {
          label: 'H2',
          title: 'Heading 2',
          action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          isActive: () => editor.isActive('heading', { level: 2 }),
        },
        {
          label: 'H3',
          title: 'Heading 3',
          action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          isActive: () => editor.isActive('heading', { level: 3 }),
        },
      ],
    },
    {
      buttons: [
        {
          label: '• —',
          title: 'Bullet List',
          action: () => editor.chain().focus().toggleBulletList().run(),
          isActive: () => editor.isActive('bulletList'),
        },
        {
          label: '1.',
          title: 'Ordered List',
          action: () => editor.chain().focus().toggleOrderedList().run(),
          isActive: () => editor.isActive('orderedList'),
        },
        {
          label: '"',
          title: 'Blockquote',
          action: () => editor.chain().focus().toggleBlockquote().run(),
          isActive: () => editor.isActive('blockquote'),
        },
        {
          label: '</>',
          title: 'Code Block',
          action: () => editor.chain().focus().toggleCodeBlock().run(),
          isActive: () => editor.isActive('codeBlock'),
        },
      ],
    },
    {
      buttons: [
        {
          label: '🔗',
          title: 'Link',
          action: setLink,
          isActive: () => editor.isActive('link'),
        },
        {
          label: 'img',
          title: 'Image',
          action: insertImage,
          isActive: () => false,
        },
      ],
    },
    {
      buttons: [
        {
          label: '↩',
          title: 'Undo',
          action: () => editor.chain().focus().undo().run(),
          isActive: () => false,
          disabled: () => !editor.can().undo(),
        },
        {
          label: '↪',
          title: 'Redo',
          action: () => editor.chain().focus().redo().run(),
          isActive: () => false,
          disabled: () => !editor.can().redo(),
        },
      ],
    },
  ];

  return (
    <>
      <div className="editor-toolbar" style={{ flex: 1, borderBottom: 'none', height: '44px' }}>
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <div className="toolbar-divider" />}
            {group.buttons.map((btn) => (
              <button
                key={btn.title}
                className={`toolbar-btn${btn.isActive() ? ' is-active' : ''}`}
                title={btn.title}
                onClick={btn.action}
                disabled={btn.disabled ? btn.disabled() : false}
                type="button"
              >
                {btn.label}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>

      <BubbleMenuBar editor={editor} />
    </>
  );
}
