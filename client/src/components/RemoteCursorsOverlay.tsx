import { useEffect, useState, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { getUserColor } from '../utils/userColors';

export interface RemoteCursor {
  userId: string;
  userName: string;
  head: number;
  from: number;
  to: number;
}

interface RemoteCursorsOverlayProps {
  editor: Editor;
  cursors: RemoteCursor[];
  layoutKey?: number;
  frozenUserIds?: string[];
}

function CaretMarker({
  editor,
  cursor,
  layoutKey,
  frozen,
}: {
  editor: Editor;
  cursor: RemoteCursor;
  layoutKey: number;
  frozen: boolean;
}) {
  const color = getUserColor(cursor.userId);
  const [pos, setPos] = useState<{ top: number; left: number; height: number } | null>(null);
  const frozenPosRef = useRef<{ top: number; left: number; height: number } | null>(null);

  const measure = useCallback(() => {
    try {
      const docSize = editor.state.doc.content.size;
      if (docSize <= 0) {
        setPos(null);
        return;
      }
      const head = Math.max(1, Math.min(cursor.head, docSize));
      const coords = editor.view.coordsAtPos(head);
      const container = editor.view.dom.closest('.editor-canvas') as HTMLElement | null;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const next = {
        top: coords.top - containerRect.top + container.scrollTop,
        left: coords.left - containerRect.left + container.scrollLeft,
        height: Math.max(coords.bottom - coords.top, 18),
      };
      setPos(next);
      frozenPosRef.current = next;
    } catch {
      setPos(null);
    }
  }, [editor, cursor.head]);

  useEffect(() => {
    if (frozen) return;

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        requestAnimationFrame(measure);
      });
    };

    schedule();
    const container = editor.view.dom.closest('.editor-canvas');
    container?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      cancelAnimationFrame(raf);
      container?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [editor, cursor.head, cursor.userId, layoutKey, frozen, measure]);

  const displayPos = frozen ? frozenPosRef.current ?? pos : pos;

  if (!displayPos) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 transition-[top,left] duration-100 ease-out"
      style={{ top: displayPos.top, left: displayPos.left }}
    >
      <div
        className="absolute w-0.5"
        style={{
          height: displayPos.height,
          backgroundColor: color.hex,
          boxShadow: `0 0 4px ${color.hex}`,
        }}
      />
      <div
        className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
        style={{ backgroundColor: color.hex }}
      >
        {cursor.userName}
      </div>
    </div>
  );
}

export default function RemoteCursorsOverlay({
  editor,
  cursors,
  layoutKey = 0,
  frozenUserIds = [],
}: RemoteCursorsOverlayProps) {
  if (cursors.length === 0) return null;

  const frozenSet = new Set(frozenUserIds);

  return (
    <>
      {cursors.map((cursor) => (
        <CaretMarker
          key={cursor.userId}
          editor={editor}
          cursor={cursor}
          layoutKey={layoutKey}
          frozen={frozenSet.has(cursor.userId)}
        />
      ))}
    </>
  );
}
