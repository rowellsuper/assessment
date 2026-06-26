import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Heading from '@tiptap/extension-heading';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef } from 'react';
import EditorToolbar from './EditorToolbar';
import RemoteCursorsOverlay, { RemoteCursor } from './RemoteCursorsOverlay';
import type { CursorPosition } from '../hooks/useDocumentSocket';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onSelectionChange?: (text: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onCursorMove?: (pos: CursorPosition) => void;
  onCursorClear?: () => void;
  onSyncApplied?: () => void;
  remoteCursors?: RemoteCursor[];
  frozenCursorUserIds?: string[];
  editable?: boolean;
  syncVersion?: number;
}

export default function RichTextEditor({
  content,
  onChange,
  onSelectionChange,
  onFocusChange,
  onCursorMove,
  onCursorClear,
  onSyncApplied,
  remoteCursors = [],
  frozenCursorUserIds = [],
  editable = true,
  syncVersion = 0,
}: RichTextEditorProps) {
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isApplyingRemoteRef = useRef(false);
  const onCursorMoveRef = useRef(onCursorMove);
  const onSyncAppliedRef = useRef(onSyncApplied);
  onCursorMoveRef.current = onCursorMove;
  onSyncAppliedRef.current = onSyncApplied;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      Heading.configure({ levels: [1, 2, 3] }),
      Placeholder.configure({ placeholder: 'Start writing your document…' }),
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      if (isApplyingRemoteRef.current) return;
      onChange(ed.getHTML());
      broadcastCursorPosition(ed.state.selection.head, ed.state.selection.from, ed.state.selection.to);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (isApplyingRemoteRef.current) return;
      const { from, to, head } = ed.state.selection;
      const text = from !== to ? ed.state.doc.textBetween(from, to, ' ') : '';
      onSelectionChange?.(text);
      broadcastCursorPosition(head, from, to);
    },
    onFocus: () => onFocusChange?.(true),
    onBlur: () => {
      onFocusChange?.(false);
      onCursorClear?.();
    },
    editorProps: {
      attributes: { class: 'focus:outline-none' },
    },
  });

  function broadcastCursorPosition(head: number, from: number, to: number) {
    if (!editable || isApplyingRemoteRef.current) return;
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = setTimeout(() => {
      onCursorMoveRef.current?.({ head, from, to });
    }, 50);
  }

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || syncVersion <= 0 || content === editor.getHTML()) return;

    isApplyingRemoteRef.current = true;
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);

    editor.commands.setContent(content, false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isApplyingRemoteRef.current = false;
        onSyncAppliedRef.current?.();
      });
    });
  }, [syncVersion, content, editor]);

  useEffect(() => {
    return () => {
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, []);

  if (!editor) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="tiptap-editor overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
      {editable && <EditorToolbar editor={editor} />}
      <div className={`editor-canvas relative min-h-[500px] bg-white ${!editable ? 'opacity-90' : ''}`}>
        <EditorContent editor={editor} />
        <RemoteCursorsOverlay
          editor={editor}
          cursors={remoteCursors}
          layoutKey={syncVersion}
          frozenUserIds={frozenCursorUserIds}
        />
      </div>
    </div>
  );
}
