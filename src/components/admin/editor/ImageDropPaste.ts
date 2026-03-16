import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { uploadImage } from './uploadImage';

export interface ImageDropPasteOptions {
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  onUploadError?: (error: Error) => void;
}

const imageDropPasteKey = new PluginKey('imageDropPaste');

function getImageFiles(dataTransfer: DataTransfer): File[] {
  const files: File[] = [];
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    if (file.type.startsWith('image/')) files.push(file);
  }
  return files;
}

function getClipboardImages(clipboardData: DataTransfer): File[] {
  const files: File[] = [];
  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i];
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

export const ImageDropPaste = Extension.create<ImageDropPasteOptions>({
  name: 'imageDropPaste',

  addOptions() {
    return {
      onUploadStart: undefined,
      onUploadEnd: undefined,
      onUploadError: undefined,
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const opts = this.options;

    const doUpload = async (file: File, insertPos?: number) => {
      opts.onUploadStart?.();
      try {
        const url = await uploadImage(file);

        if (insertPos !== undefined) {
          editor
            .chain()
            .focus()
            .insertContentAt(insertPos, { type: 'image', attrs: { src: url } })
            .run();
        } else {
          editor.chain().focus().setImage({ src: url }).run();
        }
      } catch (err) {
        opts.onUploadError?.(err instanceof Error ? err : new Error(String(err)));
      } finally {
        opts.onUploadEnd?.();
      }
    };

    return [
      new Plugin({
        key: imageDropPasteKey,
        props: {
          handlePaste(_view, event) {
            if (!event.clipboardData) return false;
            const images = getClipboardImages(event.clipboardData);
            if (images.length === 0) return false;

            event.preventDefault();
            for (const file of images) {
              doUpload(file);
            }
            return true;
          },

          handleDrop(view, event) {
            const dragEvent = event as DragEvent;
            if (!dragEvent.dataTransfer) return false;
            const images = getImageFiles(dragEvent.dataTransfer);
            if (images.length === 0) return false;

            event.preventDefault();
            const coords = { left: dragEvent.clientX, top: dragEvent.clientY };
            const pos = view.posAtCoords(coords);
            const insertPos = pos?.pos;

            for (const file of images) {
              doUpload(file, insertPos);
            }
            return true;
          },
        },
      }),
    ];
  },
});

export default ImageDropPaste;
