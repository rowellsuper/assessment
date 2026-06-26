import { useEffect, useState, useRef, useCallback } from 'react';
import type { PresenceUser } from '../api';
import type { RemoteCursor } from '../components/RemoteCursorsOverlay';

function getWsUrl(documentId: string): string {
  const token = localStorage.getItem('token');
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws?token=${encodeURIComponent(token || '')}&documentId=${encodeURIComponent(documentId)}`;
}

export interface RemoteDocumentUpdate {
  title: string;
  content: string;
  userId: string;
  userName: string;
  cursor?: CursorPosition;
}

export interface CursorPosition {
  head: number;
  from: number;
  to: number;
}

interface UseDocumentSocketOptions {
  userId?: string;
  isEditing: boolean;
  canEdit: boolean;
  onRemoteDocumentUpdate: (update: RemoteDocumentUpdate) => void;
  onCommentsChanged: () => void;
}

const CURSOR_STALE_MS = 8000;
const CURSOR_SHOW_DELAY_MS = 280;

export function useDocumentSocket(
  documentId: string | undefined,
  options: UseDocumentSocketOptions
) {
  const { userId, isEditing, canEdit, onRemoteDocumentUpdate, onCommentsChanged } = options;
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [syncingUserIds, setSyncingUserIds] = useState<string[]>([]);
  const [lastRemoteEditor, setLastRemoteEditor] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const docBroadcastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cursorTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const syncingUsers = useRef<Set<string>>(new Set());
  const pendingCursors = useRef<Map<string, RemoteCursor>>(new Map());
  const cursorShowTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const onRemoteRef = useRef(onRemoteDocumentUpdate);
  const onCommentsRef = useRef(onCommentsChanged);
  onRemoteRef.current = onRemoteDocumentUpdate;
  onCommentsRef.current = onCommentsChanged;

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendEditing = useCallback(
    (editing: boolean) => {
      sendMessage({ type: 'editing', isEditing: editing });
    },
    [sendMessage]
  );

  const removeRemoteCursor = useCallback((uid: string) => {
    setRemoteCursors((prev) => prev.filter((c) => c.userId !== uid));
    pendingCursors.current.delete(uid);
    syncingUsers.current.delete(uid);
    setSyncingUserIds((prev) => prev.filter((id) => id !== uid));
    const timer = cursorTimers.current.get(uid);
    if (timer) {
      clearTimeout(timer);
      cursorTimers.current.delete(uid);
    }
    const showTimer = cursorShowTimers.current.get(uid);
    if (showTimer) {
      clearTimeout(showTimer);
      cursorShowTimers.current.delete(uid);
    }
  }, []);

  const showRemoteCursor = useCallback(
    (cursor: RemoteCursor) => {
      setRemoteCursors((prev) => {
        const others = prev.filter((c) => c.userId !== cursor.userId);
        return [...others, cursor];
      });

      const existing = cursorTimers.current.get(cursor.userId);
      if (existing) clearTimeout(existing);

      cursorTimers.current.set(
        cursor.userId,
        setTimeout(() => removeRemoteCursor(cursor.userId), CURSOR_STALE_MS)
      );
    },
    [removeRemoteCursor]
  );

  const queueRemoteCursor = useCallback(
    (cursor: RemoteCursor) => {
      pendingCursors.current.set(cursor.userId, cursor);

      if (syncingUsers.current.has(cursor.userId)) {
        return;
      }

      const existingShow = cursorShowTimers.current.get(cursor.userId);
      if (existingShow) clearTimeout(existingShow);

      cursorShowTimers.current.set(
        cursor.userId,
        setTimeout(() => {
          cursorShowTimers.current.delete(cursor.userId);
          if (!syncingUsers.current.has(cursor.userId)) {
            showRemoteCursor(cursor);
          }
        }, CURSOR_SHOW_DELAY_MS)
      );
    },
    [showRemoteCursor]
  );

  const beginRemoteSync = useCallback(
    (remoteUserId: string, cursor?: CursorPosition, userName?: string) => {
      syncingUsers.current.add(remoteUserId);
      setSyncingUserIds(Array.from(syncingUsers.current));

      const showTimer = cursorShowTimers.current.get(remoteUserId);
      if (showTimer) {
        clearTimeout(showTimer);
        cursorShowTimers.current.delete(remoteUserId);
      }

      if (cursor && userName) {
        pendingCursors.current.set(remoteUserId, {
          userId: remoteUserId,
          userName,
          head: cursor.head,
          from: cursor.from,
          to: cursor.to,
        });
      }
    },
    []
  );

  const completeRemoteSync = useCallback(() => {
    const toApply = Array.from(syncingUsers.current);
    syncingUsers.current.clear();
    setSyncingUserIds([]);

    toApply.forEach((uid) => {
      const pending = pendingCursors.current.get(uid);
      if (pending) {
        showRemoteCursor(pending);
      }
    });
  }, [showRemoteCursor]);

  const broadcastDocument = useCallback(
    (title: string, content: string, cursor?: CursorPosition) => {
      if (!canEdit) return;
      if (docBroadcastTimer.current) clearTimeout(docBroadcastTimer.current);
      docBroadcastTimer.current = setTimeout(() => {
        sendMessage({
          type: 'document:update',
          title,
          content,
          head: cursor?.head,
          from: cursor?.from,
          to: cursor?.to,
        });
      }, 250);
    },
    [canEdit, sendMessage]
  );

  const broadcastCursor = useCallback(
    (pos: CursorPosition) => {
      sendMessage({ type: 'cursor:update', head: pos.head, from: pos.from, to: pos.to });
    },
    [sendMessage]
  );

  const clearCursor = useCallback(() => {
    sendMessage({ type: 'cursor:leave' });
  }, [sendMessage]);

  const notifyCommentsChanged = useCallback(() => {
    sendMessage({ type: 'comments:notify' });
  }, [sendMessage]);

  useEffect(() => {
    sendEditing(isEditing);
  }, [isEditing, sendEditing]);

  useEffect(() => {
    if (!documentId) return;

    const ws = new WebSocket(getWsUrl(documentId));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          type: string;
          users?: PresenceUser[];
          userId?: string;
          userName?: string;
          title?: string;
          content?: string;
          head?: number;
          from?: number;
          to?: number;
        };

        if (msg.type === 'presence' && msg.users) {
          setUsers(msg.users);
          return;
        }

        if (msg.type === 'document:update' && msg.title !== undefined && msg.content !== undefined) {
          if (msg.userId === userId) return;

          const remoteUserId = msg.userId || '';
          const remoteUserName = msg.userName || 'Someone';
          const cursor =
            typeof msg.head === 'number'
              ? {
                  head: msg.head,
                  from: typeof msg.from === 'number' ? msg.from : msg.head,
                  to: typeof msg.to === 'number' ? msg.to : msg.head,
                }
              : undefined;

          beginRemoteSync(remoteUserId, cursor, remoteUserName);
          setLastRemoteEditor(remoteUserName);
          onRemoteRef.current({
            title: msg.title,
            content: msg.content,
            userId: remoteUserId,
            userName: remoteUserName,
            cursor,
          });
          return;
        }

        if (msg.type === 'comments:changed') {
          onCommentsRef.current();
          return;
        }

        if (
          msg.type === 'cursor:update' &&
          msg.userId &&
          msg.userId !== userId &&
          typeof msg.head === 'number'
        ) {
          queueRemoteCursor({
            userId: msg.userId,
            userName: msg.userName || 'Someone',
            head: msg.head,
            from: msg.from ?? msg.head,
            to: msg.to ?? msg.head,
          });
          return;
        }

        if (msg.type === 'cursor:leave' && msg.userId) {
          removeRemoteCursor(msg.userId);
        }
      } catch {
        // ignore
      }
    };

    ws.onopen = () => sendEditing(isEditing);

    return () => {
      sendMessage({ type: 'cursor:leave' });
      if (docBroadcastTimer.current) clearTimeout(docBroadcastTimer.current);
      cursorShowTimers.current.forEach((t) => clearTimeout(t));
      cursorShowTimers.current.clear();
      cursorTimers.current.forEach((t) => clearTimeout(t));
      cursorTimers.current.clear();
      syncingUsers.current.clear();
      pendingCursors.current.clear();
      ws.close();
      wsRef.current = null;
    };
  }, [
    documentId,
    userId,
    sendEditing,
    isEditing,
    sendMessage,
    queueRemoteCursor,
    removeRemoteCursor,
    beginRemoteSync,
  ]);

  useEffect(() => {
    if (!lastRemoteEditor) return;
    const t = setTimeout(() => setLastRemoteEditor(null), 4000);
    return () => clearTimeout(t);
  }, [lastRemoteEditor]);

  return {
    users,
    remoteCursors,
    syncingUserIds,
    lastRemoteEditor,
    broadcastDocument,
    broadcastCursor,
    clearCursor,
    completeRemoteSync,
    notifyCommentsChanged,
  };
}
