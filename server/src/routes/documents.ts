import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import { db } from '../db.js';
import { authMiddleware, AuthRequest } from '../auth.js';
import { fileBufferToHtml, isAllowedFile } from '../fileConvert.js';
import {
  canViewDocument,
  canEditDocument,
  canCommentOnDocument,
  getDocumentPermission,
  isValidPermission,
  Permission,
} from '../permissions.js';
import { broadcastDocumentUpdate, broadcastCommentsChanged } from '../ws.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedFile(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: .txt, .md, .docx'));
    }
  },
});

const MAX_VERSIONS = 30;

function saveVersion(documentId: string, title: string, content: string, userId: string) {
  const versionId = uuid();
  db.prepare(
    'INSERT INTO document_versions (id, document_id, title, content, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(versionId, documentId, title, content, userId);

  const excess = db
    .prepare(
      `SELECT id FROM document_versions WHERE document_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET ?`
    )
    .all(documentId, MAX_VERSIONS) as { id: string }[];

  for (const row of excess) {
    db.prepare('DELETE FROM document_versions WHERE id = ?').run(row.id);
  }
}

router.use(authMiddleware);

router.get('/', (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const owned = db
    .prepare(
      `SELECT d.id, d.title, d.updated_at, d.owner_id, u.name as owner_name, 'owned' as access_type, 'edit' as permission
       FROM documents d
       JOIN users u ON u.id = d.owner_id
       WHERE d.owner_id = ?
       ORDER BY d.updated_at DESC`
    )
    .all(userId);

  const shared = db
    .prepare(
      `SELECT d.id, d.title, d.updated_at, d.owner_id, u.name as owner_name, 'shared' as access_type, ds.permission
       FROM documents d
       JOIN document_shares ds ON ds.document_id = d.id
       JOIN users u ON u.id = d.owner_id
       WHERE ds.user_id = ?
       ORDER BY d.updated_at DESC`
    )
    .all(userId);

  res.json({ owned, shared });
});

router.post('/', (req: AuthRequest, res) => {
  const { title } = req.body;
  const id = uuid();
  const userId = req.user!.id;

  db.prepare(
    'INSERT INTO documents (id, title, content, owner_id) VALUES (?, ?, ?, ?)'
  ).run(id, title?.trim() || 'Untitled Document', '', userId);

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.status(201).json({ document: doc });
});

router.post('/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const html = await fileBufferToHtml(req.file.buffer, req.file.originalname);
    const baseName = req.file.originalname.replace(/\.[^.]+$/, '');
    const id = uuid();
    const userId = req.user!.id;

    db.prepare(
      'INSERT INTO documents (id, title, content, owner_id) VALUES (?, ?, ?, ?)'
    ).run(id, baseName || 'Imported Document', html, userId);

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    res.status(201).json({ document: doc });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const userId = req.user!.id;

  if (!canViewDocument(id, userId)) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  const owner = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(
    (doc as { owner_id: string }).owner_id
  );
  const isOwner = (doc as { owner_id: string }).owner_id === userId;
  const permission = getDocumentPermission(id, userId)!;

  const shares = isOwner
    ? db
        .prepare(
          `SELECT ds.id, ds.user_id, u.name, u.email, ds.permission, ds.created_at
           FROM document_shares ds
           JOIN users u ON u.id = ds.user_id
           WHERE ds.document_id = ?`
        )
        .all(id)
    : [];

  res.json({
    document: doc,
    owner,
    isOwner,
    permission,
    canEdit: permission === 'edit',
    canComment: permission === 'comment' || permission === 'edit',
    shares,
  });
});

router.patch('/:id', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const userId = req.user!.id;
  const { title, content } = req.body;

  if (!canEditDocument(id, userId)) {
    res.status(403).json({ error: 'You do not have permission to edit this document' });
    return;
  }

  const current = db.prepare('SELECT title, content FROM documents WHERE id = ?').get(id) as
    | { title: string; content: string }
    | undefined;

  if (!current) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) {
    const trimmed = String(title).trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Title cannot be empty' });
      return;
    }
    updates.push('title = ?');
    values.push(trimmed);
  }

  if (content !== undefined) {
    updates.push('content = ?');
    values.push(content);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  const contentChanged = content !== undefined && content !== current.content;
  const titleChanged = title !== undefined && String(title).trim() !== current.title;

  if (contentChanged || titleChanged) {
    saveVersion(id, current.title, current.content, userId);
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as {
    title: string;
    content: string;
  };
  broadcastDocumentUpdate(
    id,
    { title: doc.title, content: doc.content, userId, userName: req.user!.name },
    userId
  );
  res.json({ document: doc });
});

router.post('/:id/import', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.id;

    if (!canEditDocument(id, userId)) {
      res.status(403).json({ error: 'You do not have permission to edit this document' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const current = db.prepare('SELECT title, content FROM documents WHERE id = ?').get(id) as {
      title: string;
      content: string;
    };
    saveVersion(id, current.title, current.content, userId);

    const html = await fileBufferToHtml(req.file.buffer, req.file.originalname);

    db.prepare(
      "UPDATE documents SET content = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(html, id);

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as {
      title: string;
      content: string;
    };
    broadcastDocumentUpdate(
      id,
      { title: doc.title, content: doc.content, userId, userName: req.user!.name },
      userId
    );
    res.json({ document: doc });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const userId = req.user!.id;

  const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(id) as
    | { owner_id: string }
    | undefined;

  if (!doc || doc.owner_id !== userId) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  res.json({ success: true });
});

router.post('/:id/share', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const userId = req.user!.id;
  const { email, permission = 'edit' } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  if (!isValidPermission(permission)) {
    res.status(400).json({ error: 'Permission must be view, comment, or edit' });
    return;
  }

  const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(id) as
    | { owner_id: string }
    | undefined;

  if (!doc || doc.owner_id !== userId) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const targetUser = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email) as
    | { id: string; name: string; email: string }
    | undefined;

  if (!targetUser) {
    res.status(404).json({ error: 'User not found. Use a seeded account email.' });
    return;
  }

  if (targetUser.id === userId) {
    res.status(400).json({ error: 'Cannot share with yourself' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM document_shares WHERE document_id = ? AND user_id = ?')
    .get(id, targetUser.id);

  if (existing) {
    res.status(409).json({ error: 'Document already shared with this user' });
    return;
  }

  const shareId = uuid();
  db.prepare(
    'INSERT INTO document_shares (id, document_id, user_id, shared_by, permission) VALUES (?, ?, ?, ?, ?)'
  ).run(shareId, id, targetUser.id, userId, permission);

  res.status(201).json({
    share: {
      id: shareId,
      user_id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      permission,
    },
  });
});

router.patch('/:id/share/:shareId', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const shareId = String(req.params.shareId);
  const userId = req.user!.id;
  const { permission } = req.body;

  if (!isValidPermission(permission)) {
    res.status(400).json({ error: 'Permission must be view, comment, or edit' });
    return;
  }

  const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(id) as
    | { owner_id: string }
    | undefined;

  if (!doc || doc.owner_id !== userId) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const result = db
    .prepare('UPDATE document_shares SET permission = ? WHERE id = ? AND document_id = ?')
    .run(permission, shareId, id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Share not found' });
    return;
  }

  const share = db
    .prepare(
      `SELECT ds.id, ds.user_id, u.name, u.email, ds.permission, ds.created_at
       FROM document_shares ds JOIN users u ON u.id = ds.user_id
       WHERE ds.id = ?`
    )
    .get(shareId);

  res.json({ share });
});

router.delete('/:id/share/:shareId', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const shareId = String(req.params.shareId);
  const userId = req.user!.id;

  const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(id) as
    | { owner_id: string }
    | undefined;

  if (!doc || doc.owner_id !== userId) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  db.prepare('DELETE FROM document_shares WHERE id = ? AND document_id = ?').run(shareId, id);
  res.json({ success: true });
});

// Version history
router.get('/:id/versions', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const userId = req.user!.id;

  if (!canViewDocument(id, userId)) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const versions = db
    .prepare(
      `SELECT v.id, v.title, v.created_at, u.name as created_by_name
       FROM document_versions v
       JOIN users u ON u.id = v.created_by
       WHERE v.document_id = ?
       ORDER BY v.created_at DESC`
    )
    .all(id);

  res.json({ versions });
});

router.post('/:id/versions/:versionId/restore', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const versionId = String(req.params.versionId);
  const userId = req.user!.id;

  if (!canEditDocument(id, userId)) {
    res.status(403).json({ error: 'You do not have permission to edit this document' });
    return;
  }

  const version = db
    .prepare('SELECT title, content FROM document_versions WHERE id = ? AND document_id = ?')
    .get(versionId, id) as { title: string; content: string } | undefined;

  if (!version) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }

  const current = db.prepare('SELECT title, content FROM documents WHERE id = ?').get(id) as {
    title: string;
    content: string;
  };
  saveVersion(id, current.title, current.content, userId);

  db.prepare(
    "UPDATE documents SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(version.title, version.content, id);

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as {
    title: string;
    content: string;
  };
  broadcastDocumentUpdate(
    id,
    { title: doc.title, content: doc.content, userId, userName: req.user!.name },
    userId
  );
  res.json({ document: doc });
});

// Comments & suggestions
router.get('/:id/comments', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const userId = req.user!.id;

  if (!canViewDocument(id, userId)) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const comments = db
    .prepare(
      `SELECT c.id, c.body, c.quoted_text, c.suggestion, c.is_suggestion, c.status, c.created_at,
              u.id as user_id, u.name as user_name
       FROM document_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.document_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(id);

  res.json({ comments });
});

router.post('/:id/comments', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const userId = req.user!.id;
  const { body, quotedText, suggestion, isSuggestion } = req.body;

  if (!canCommentOnDocument(id, userId)) {
    res.status(403).json({ error: 'You do not have permission to comment on this document' });
    return;
  }

  if (!body?.trim()) {
    res.status(400).json({ error: 'Comment body is required' });
    return;
  }

  const commentId = uuid();
  const isSuggest = Boolean(isSuggestion && suggestion?.trim());

  db.prepare(
    `INSERT INTO document_comments (id, document_id, user_id, body, quoted_text, suggestion, is_suggestion)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    commentId,
    id,
    userId,
    body.trim(),
    quotedText?.trim() || null,
    isSuggest ? suggestion.trim() : null,
    isSuggest ? 1 : 0
  );

  const comment = db
    .prepare(
      `SELECT c.id, c.body, c.quoted_text, c.suggestion, c.is_suggestion, c.status, c.created_at,
              u.id as user_id, u.name as user_name
       FROM document_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(commentId);

  broadcastCommentsChanged(id, userId);
  res.status(201).json({ comment });
});

function getCommentWithUser(commentId: string) {
  return db
    .prepare(
      `SELECT c.id, c.body, c.quoted_text, c.suggestion, c.is_suggestion, c.status, c.created_at,
              u.id as user_id, u.name as user_name
       FROM document_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(commentId);
}

router.patch('/:id/comments/:commentId', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const commentId = String(req.params.commentId);
  const userId = req.user!.id;
  const { status, body, suggestion } = req.body;

  if (!canViewDocument(id, userId)) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const comment = db
    .prepare('SELECT * FROM document_comments WHERE id = ? AND document_id = ?')
    .get(commentId, id) as
    | {
        user_id: string;
        is_suggestion: number;
        quoted_text: string | null;
        suggestion: string | null;
        status: string;
      }
    | undefined;

  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  if (body !== undefined) {
    if (comment.user_id !== userId) {
      res.status(403).json({ error: 'You can only edit your own comments' });
      return;
    }

    if (!body?.trim()) {
      res.status(400).json({ error: 'Comment body is required' });
      return;
    }

    if (comment.status !== 'open') {
      res.status(400).json({ error: 'Only open comments can be edited' });
      return;
    }

    const nextSuggestion =
      comment.is_suggestion === 1
        ? suggestion !== undefined
          ? suggestion?.trim() || null
          : comment.suggestion
        : null;

    if (comment.is_suggestion === 1 && !nextSuggestion) {
      res.status(400).json({ error: 'Suggestion text is required' });
      return;
    }

    db.prepare(
      'UPDATE document_comments SET body = ?, suggestion = ? WHERE id = ?'
    ).run(body.trim(), nextSuggestion, commentId);

    const updated = getCommentWithUser(commentId);
    broadcastCommentsChanged(id, userId);
    res.json({ comment: updated });
    return;
  }

  const validStatuses = ['open', 'resolved', 'accepted', 'rejected'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  if (status === 'accepted' && comment.is_suggestion && canEditDocument(id, userId)) {
    const doc = db.prepare('SELECT title, content FROM documents WHERE id = ?').get(id) as {
      title: string;
      content: string;
    };

    if (comment.quoted_text && comment.suggestion && doc.content.includes(comment.quoted_text)) {
      saveVersion(id, doc.title, doc.content, userId);
      const newContent = doc.content.replace(comment.quoted_text, comment.suggestion);
      db.prepare(
        "UPDATE documents SET content = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newContent, id);
    }
  }

  db.prepare('UPDATE document_comments SET status = ? WHERE id = ?').run(status, commentId);

  const updated = getCommentWithUser(commentId);

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as
    | { title: string; content: string }
    | undefined;

  broadcastCommentsChanged(id, userId);
  if (doc && status === 'accepted' && comment.is_suggestion) {
    broadcastDocumentUpdate(
      id,
      { title: doc.title, content: doc.content, userId, userName: req.user!.name },
      userId
    );
  }

  res.json({ comment: updated, document: doc });
});

router.delete('/:id/comments/:commentId', (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const commentId = String(req.params.commentId);
  const userId = req.user!.id;

  if (!canViewDocument(id, userId)) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const comment = db
    .prepare('SELECT user_id FROM document_comments WHERE id = ? AND document_id = ?')
    .get(commentId, id) as { user_id: string } | undefined;

  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  if (comment.user_id !== userId) {
    res.status(403).json({ error: 'You can only delete your own comments' });
    return;
  }

  db.prepare('DELETE FROM document_comments WHERE id = ?').run(commentId);
  broadcastCommentsChanged(id, userId);
  res.json({ success: true });
});

export default router;
