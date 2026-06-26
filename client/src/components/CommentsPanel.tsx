import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Lightbulb, Check, X, Pencil, Trash2 } from 'lucide-react';
import { api, Comment } from '../api';
import { getUserColor, MY_COMMENT_STYLE } from '../utils/userColors';
import ConfirmModal from './ConfirmModal';

interface CommentsPanelProps {
  documentId: string;
  currentUserId?: string;
  canComment: boolean;
  canEdit: boolean;
  selectedText: string;
  suggestionMode: boolean;
  refreshVersion: number;
  onSuggestionAccepted?: (document: { content: string }) => void;
  onCommentPosted?: () => void;
}

export default function CommentsPanel({
  documentId,
  currentUserId,
  canComment,
  canEdit,
  selectedText,
  suggestionMode,
  refreshVersion,
  onSuggestionAccepted,
  onCommentPosted,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editSuggestion, setEditSuggestion] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);

  const loadComments = useCallback(() => {
    api
      .getComments(documentId)
      .then(({ comments: c }) => setComments(c))
      .catch(() => setError('Failed to load comments'))
      .finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => {
    setLoading(true);
    loadComments();
  }, [documentId, refreshVersion, loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const isSuggestion = suggestionMode && !!suggestion.trim();
      const { comment } = await api.addComment(documentId, {
        body: body.trim(),
        quotedText: selectedText || undefined,
        suggestion: isSuggestion ? suggestion.trim() : undefined,
        isSuggestion,
      });
      setComments((prev) => [...prev, comment]);
      setBody('');
      setSuggestion('');
      onCommentPosted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (commentId: string, status: Comment['status']) => {
    try {
      const { comment, document } = await api.updateCommentStatus(documentId, commentId, status);
      setComments((prev) => prev.map((c) => (c.id === commentId ? comment : c)));
      onCommentPosted?.();
      if (document && onSuggestionAccepted) {
        onSuggestionAccepted(document);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
    setEditSuggestion(comment.suggestion || '');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody('');
    setEditSuggestion('');
  };

  const saveEdit = async (comment: Comment) => {
    if (!editBody.trim()) return;

    setSavingEdit(true);
    setError('');
    try {
      const { comment: updated } = await api.updateComment(documentId, comment.id, {
        body: editBody.trim(),
        suggestion: comment.is_suggestion === 1 ? editSuggestion.trim() : undefined,
      });
      setComments((prev) => prev.map((c) => (c.id === comment.id ? updated : c)));
      cancelEdit();
      onCommentPosted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update comment');
    } finally {
      setSavingEdit(false);
    }
  };

  const requestDelete = (comment: Comment) => {
    setDeleteTarget(comment);
    setError('');
  };

  const cancelDelete = () => {
    if (deletingId) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const commentId = deleteTarget.id;
    setDeletingId(commentId);
    setError('');
    try {
      await api.deleteComment(documentId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (editingId === commentId) cancelEdit();
      setDeleteTarget(null);
      onCommentPosted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    } finally {
      setDeletingId(null);
    }
  };

  const statusBadge = (status: Comment['status']) => {
    const styles: Record<string, string> = {
      open: 'bg-amber-50 text-amber-700',
      resolved: 'bg-slate-100 text-slate-600',
      accepted: 'bg-emerald-50 text-emerald-700',
      rejected: 'bg-red-50 text-red-600',
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageSquare className="h-4 w-4 text-brand-600" />
          Comments & suggestions
          <span className="ml-auto text-xs font-normal text-emerald-600">Live</span>
        </h3>
        <p className="mt-1 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />
            You
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
            Others
          </span>
        </p>
        {error && !canComment && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '420px' }}>
        {loading && <p className="text-sm text-slate-400">Loading…</p>}
        {!loading && comments.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">No comments yet</p>
        )}
        {comments.map((c) => {
          const isMine = !!currentUserId && c.user_id === currentUserId;
          const authorColor = getUserColor(c.user_id);
          const isEditing = editingId === c.id;
          const canManage = isMine && c.status === 'open';

          return (
            <div
              key={c.id}
              className={`rounded-lg border p-3 ${
                isMine
                  ? `${MY_COMMENT_STYLE.light} ${MY_COMMENT_STYLE.border} border-l-4 ${MY_COMMENT_STYLE.borderLeft}`
                  : `${authorColor.light} ${authorColor.border} border-l-4`
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${isMine ? MY_COMMENT_STYLE.dot : authorColor.bg}`}
                  />
                  <span
                    className={`text-xs font-semibold ${isMine ? MY_COMMENT_STYLE.name : authorColor.text}`}
                  >
                    {isMine ? 'You' : c.user_name}
                  </span>
                  {isMine && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${MY_COMMENT_STYLE.badge}`}>
                      Your comment
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {canManage && !isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        title="Edit comment"
                        className="rounded p-1 text-slate-400 hover:bg-white/80 hover:text-sky-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(c)}
                        disabled={deletingId === c.id}
                        title="Delete comment"
                        className="rounded p-1 text-slate-400 hover:bg-white/80 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {statusBadge(c.status)}
                </div>
              </div>

              {c.quoted_text && (
                <blockquote
                  className={`mb-2 border-l-2 pl-2 text-xs italic ${
                    isMine ? MY_COMMENT_STYLE.quote : `${authorColor.border} opacity-80`
                  }`}
                >
                  &ldquo;{c.quoted_text}&rdquo;
                </blockquote>
              )}

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={2}
                    className="input-field w-full resize-none !py-2 text-sm"
                    autoFocus
                  />
                  {c.is_suggestion === 1 && (
                    <input
                      value={editSuggestion}
                      onChange={(e) => setEditSuggestion(e.target.value)}
                      placeholder="Suggested replacement text…"
                      className="input-field w-full !py-2 text-sm"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(c)}
                      disabled={savingEdit || !editBody.trim()}
                      className="flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" />
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={savingEdit}
                      className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      <X className="h-3 w-3" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={`text-sm ${isMine ? 'text-sky-950' : 'text-slate-800'}`}>{c.body}</p>
                  {c.is_suggestion === 1 && c.suggestion && (
                    <div
                      className={`mt-2 rounded-md px-2 py-1.5 text-xs ${
                        isMine ? 'bg-sky-100 text-sky-900' : 'bg-amber-50 text-amber-900'
                      }`}
                    >
                      <span className="flex items-center gap-1 font-medium">
                        <Lightbulb className="h-3 w-3" /> Suggest:
                      </span>
                      {c.suggestion}
                    </div>
                  )}
                </>
              )}

              {!isEditing && canEdit && c.is_suggestion === 1 && c.status === 'open' && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatus(c.id, 'accepted')}
                    className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatus(c.id, 'rejected')}
                    className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              )}
              {!isEditing && c.status === 'open' && !c.is_suggestion && (
                <button
                  type="button"
                  onClick={() => handleStatus(c.id, 'resolved')}
                  className="mt-2 text-xs text-slate-500 hover:text-slate-700"
                >
                  Mark resolved
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canComment && (
        <form onSubmit={handleSubmit} className="border-t border-slate-100 p-4 space-y-2">
          {selectedText && (
            <div className="rounded-md bg-brand-50 px-2 py-1.5 text-xs text-brand-700">
              Quoting: &ldquo;{selectedText.slice(0, 80)}
              {selectedText.length > 80 ? '…' : ''}&rdquo;
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="input-field resize-none !py-2 text-sm"
            required
          />
          {suggestionMode && (
            <input
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Suggested replacement text…"
              className="input-field !py-2 text-sm"
            />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full !py-2 !text-sm">
            {submitting ? 'Posting…' : suggestionMode ? 'Post suggestion' : 'Post comment'}
          </button>
        </form>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete comment?"
        message={
          deleteTarget
            ? `This will permanently remove your comment${deleteTarget.body ? `: "${deleteTarget.body.slice(0, 100)}${deleteTarget.body.length > 100 ? '…' : ''}"` : ''}. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete comment"
        cancelLabel="Keep comment"
        variant="danger"
        loading={!!deletingId}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
