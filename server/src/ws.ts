import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { canViewDocument, canEditDocument } from './permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ajaia-dev-secret-change-in-production';

export interface PresenceUser {
  userId: string;
  name: string;
  isEditing: boolean;
}

interface RoomEntry {
  ws: WebSocket;
  user: PresenceUser;
}

const rooms = new Map<string, Map<string, RoomEntry>>();

export function broadcastToDocument(
  documentId: string,
  message: Record<string, unknown>,
  excludeUserId?: string
) {
  const room = rooms.get(documentId);
  if (!room) return;

  const payload = JSON.stringify(message);
  room.forEach((entry, uid) => {
    if (uid !== excludeUserId && entry.ws.readyState === WebSocket.OPEN) {
      entry.ws.send(payload);
    }
  });
}

function broadcastPresence(documentId: string) {
  const room = rooms.get(documentId);
  const users = room ? Array.from(room.values()).map((r) => r.user) : [];
  broadcastToDocument(documentId, { type: 'presence', users });
}

export function broadcastDocumentUpdate(
  documentId: string,
  data: {
    title: string;
    content: string;
    userId: string;
    userName: string;
    head?: number;
    from?: number;
    to?: number;
  },
  excludeUserId?: string
) {
  broadcastToDocument(documentId, { type: 'document:update', ...data }, excludeUserId);
}

export function broadcastCommentsChanged(documentId: string, excludeUserId?: string) {
  broadcastToDocument(documentId, { type: 'comments:changed' }, excludeUserId);
}

export function createWsServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');
    const documentId = url.searchParams.get('documentId');

    if (!token || !documentId) {
      ws.close(4001, 'Missing token or documentId');
      return;
    }

    let userId: string;
    let userName: string;

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
      const user = db
        .prepare('SELECT id, name FROM users WHERE id = ?')
        .get(payload.sub) as { id: string; name: string } | undefined;

      if (!user || !canViewDocument(documentId, user.id)) {
        ws.close(4003, 'Access denied');
        return;
      }

      userId = user.id;
      userName = user.name;
    } catch {
      ws.close(4002, 'Invalid token');
      return;
    }

    if (!rooms.has(documentId)) {
      rooms.set(documentId, new Map());
    }

    const room = rooms.get(documentId)!;
    room.set(userId, {
      ws,
      user: { userId, name: userName, isEditing: false },
    });

    broadcastPresence(documentId);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          isEditing?: boolean;
          title?: string;
          content?: string;
          head?: number;
          from?: number;
          to?: number;
        };
        const entry = room.get(userId);
        if (!entry) return;

        if (msg.type === 'editing' && typeof msg.isEditing === 'boolean') {
          entry.user.isEditing = msg.isEditing;
          broadcastPresence(documentId);
          return;
        }

        if (msg.type === 'document:update') {
          if (!canEditDocument(documentId, userId)) return;
          if (typeof msg.title !== 'string' || typeof msg.content !== 'string') return;

          broadcastDocumentUpdate(
            documentId,
            {
              title: msg.title,
              content: msg.content,
              userId,
              userName,
              head: typeof msg.head === 'number' ? msg.head : undefined,
              from: typeof msg.from === 'number' ? msg.from : undefined,
              to: typeof msg.to === 'number' ? msg.to : undefined,
            },
            userId
          );
          return;
        }

        if (msg.type === 'comments:notify') {
          broadcastCommentsChanged(documentId, userId);
          return;
        }

        if (msg.type === 'cursor:update') {
          if (typeof msg.head !== 'number') return;
          broadcastToDocument(
            documentId,
            {
              type: 'cursor:update',
              userId,
              userName,
              head: msg.head,
              from: typeof msg.from === 'number' ? msg.from : msg.head,
              to: typeof msg.to === 'number' ? msg.to : msg.head,
            },
            userId
          );
          return;
        }

        if (msg.type === 'cursor:leave') {
          broadcastToDocument(documentId, { type: 'cursor:leave', userId }, userId);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      room.delete(userId);
      broadcastToDocument(documentId, { type: 'cursor:leave', userId });
      if (room.size === 0) {
        rooms.delete(documentId);
      } else {
        broadcastPresence(documentId);
      }
    });
  });

  return wss;
}
