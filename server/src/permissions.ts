import { db } from './db.js';

export type Permission = 'view' | 'comment' | 'edit';

export function getDocumentPermission(documentId: string, userId: string): Permission | null {
  const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(documentId) as
    | { owner_id: string }
    | undefined;
  if (!doc) return null;
  if (doc.owner_id === userId) return 'edit';

  const share = db
    .prepare('SELECT permission FROM document_shares WHERE document_id = ? AND user_id = ?')
    .get(documentId, userId) as { permission: Permission } | undefined;

  return share?.permission ?? null;
}

export function canViewDocument(documentId: string, userId: string): boolean {
  return getDocumentPermission(documentId, userId) !== null;
}

export function canCommentOnDocument(documentId: string, userId: string): boolean {
  const perm = getDocumentPermission(documentId, userId);
  return perm === 'comment' || perm === 'edit';
}

export function canEditDocument(documentId: string, userId: string): boolean {
  return getDocumentPermission(documentId, userId) === 'edit';
}

export function isValidPermission(value: unknown): value is Permission {
  return value === 'view' || value === 'comment' || value === 'edit';
}
