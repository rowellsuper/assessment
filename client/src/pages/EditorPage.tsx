import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Cloud,
  Eye,
  Lightbulb,
  MessageSquare,
  History,
} from 'lucide-react';
import { api, Document, Share, Permission } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDocumentSocket, CursorPosition } from '../hooks/useDocumentSocket';
import RichTextEditor from '../components/RichTextEditor';
import SharePanel, { PermissionBadge } from '../components/SharePanel';
import PresenceBar from '../components/PresenceBar';
import CommentsPanel from '../components/CommentsPanel';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import ExportMenu from '../components/ExportMenu';

const ACCEPTED_FILES = '.txt,.md,.markdown,.docx';

type SidePanel = 'comments' | 'history' | null;

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [permission, setPermission] = useState<Permission>('edit');
  const [canEdit, setCanEdit] = useState(true);
  const [canComment, setCanComment] = useState(true);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [error, setError] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [suggestionMode, setSuggestionMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sidePanel, setSidePanel] = useState<SidePanel>('comments');
  const [commentsRefreshVersion, setCommentsRefreshVersion] = useState(0);
  const [syncVersion, setSyncVersion] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const importRef = useRef<HTMLInputElement>(null);
  const pendingContentRef = useRef(content);
  const pendingTitleRef = useRef(title);
  const isRemoteUpdateRef = useRef(false);
  const lastCursorRef = useRef<CursorPosition | null>(null);

  const handleRemoteDocumentUpdate = useCallback(
    (update: { title: string; content: string; userId: string; userName: string }) => {
      isRemoteUpdateRef.current = true;
      pendingContentRef.current = update.content;
      pendingTitleRef.current = update.title;
      setContent(update.content);
      setTitle(update.title);
      setSyncVersion((v) => v + 1);
      setSaveStatus('saved');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 100);
    },
    []
  );

  const handleCommentsChanged = useCallback(() => {
    setCommentsRefreshVersion((v) => v + 1);
  }, []);

  const {
    users: presenceUsers,
    remoteCursors,
    syncingUserIds,
    broadcastDocument,
    broadcastCursor,
    clearCursor,
    completeRemoteSync,
    notifyCommentsChanged,
  } = useDocumentSocket(id, {
    userId: user?.id,
    isEditing: isEditing && canEdit,
    canEdit,
    onRemoteDocumentUpdate: handleRemoteDocumentUpdate,
    onCommentsChanged: handleCommentsChanged,
  });

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    api
      .getDocument(id)
      .then((data) => {
        setDocument(data.document);
        setTitle(data.document.title);
        setContent(data.document.content);
        pendingContentRef.current = data.document.content;
        pendingTitleRef.current = data.document.title;
        setEditorKey((k) => k + 1);
        setIsOwner(data.isOwner);
        setOwnerName(data.owner.name);
        setPermission(data.permission);
        setCanEdit(data.canEdit);
        setCanComment(data.canComment);
        setShares(data.shares);
        setSaveStatus('saved');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load document');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const save = useCallback(async () => {
    if (!id || !canEdit) return;

    setSaveStatus('saving');
    try {
      const { document: updated } = await api.updateDocument(id, {
        title: pendingTitleRef.current,
        content: pendingContentRef.current,
      });
      setDocument(updated);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [id, canEdit]);

  const scheduleSave = useCallback(() => {
    if (!canEdit) return;
    setSaveStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(save, 800);
  }, [save, canEdit]);

  const handleTitleChange = (newTitle: string) => {
    if (!canEdit || isRemoteUpdateRef.current) return;
    setTitle(newTitle);
    pendingTitleRef.current = newTitle;
    broadcastDocument(newTitle, pendingContentRef.current, lastCursorRef.current ?? undefined);
    scheduleSave();
  };

  const handleContentChange = (html: string) => {
    if (!canEdit || isRemoteUpdateRef.current) return;
    pendingContentRef.current = html;
    setContent(html);
    broadcastDocument(pendingTitleRef.current, html, lastCursorRef.current ?? undefined);
    scheduleSave();
  };

  const handleCursorMove = (pos: CursorPosition) => {
    lastCursorRef.current = pos;
    broadcastCursor(pos);
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this document permanently? This cannot be undone.')) return;
    try {
      await api.deleteDocument(id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleShare = async (email: string, perm: Permission) => {
    if (!id) return;
    const { share } = await api.shareDocument(id, email, perm);
    setShares((prev) => [...prev, share]);
  };

  const handleUpdatePermission = async (shareId: string, perm: Permission) => {
    if (!id) return;
    const { share } = await api.updateSharePermission(id, shareId, perm);
    setShares((prev) => prev.map((s) => (s.id === shareId ? share : s)));
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!id) return;
    await api.removeShare(id, shareId);
    setShares((prev) => prev.filter((s) => s.id !== shareId));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (!confirm('Importing will replace the current document content. Continue?')) {
      if (importRef.current) importRef.current.value = '';
      return;
    }

    try {
      const { document: updated } = await api.importToDocument(id, file);
      setContent(updated.content);
      pendingContentRef.current = updated.content;
      setEditorKey((k) => k + 1);
      setSaveStatus('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const handleRestore = (restoredContent: string, restoredTitle: string) => {
    setContent(restoredContent);
    setTitle(restoredTitle);
    pendingContentRef.current = restoredContent;
    pendingTitleRef.current = restoredTitle;
    setEditorKey((k) => k + 1);
    setSaveStatus('saved');
  };

  const handleSuggestionAccepted = (doc: { content: string }) => {
    isRemoteUpdateRef.current = true;
    setContent(doc.content);
    pendingContentRef.current = doc.content;
    setSyncVersion((v) => v + 1);
    setTimeout(() => {
      isRemoteUpdateRef.current = false;
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading document…
        </div>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-slate-600">{error}</p>
        <Link to="/" className="btn-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to documents
        </Link>
      </div>
    );
  }

  const SaveIndicator = () => {
    if (!canEdit) return null;
    if (saveStatus === 'saved') {
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Saved
        </span>
      );
    }
    if (saveStatus === 'saving') {
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </span>
      );
    }
    if (saveStatus === 'unsaved') {
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <Cloud className="h-3.5 w-3.5" />
          Unsaved changes
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
        <AlertCircle className="h-3.5 w-3.5" />
        Save failed
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
          </Link>

          <div className="h-5 w-px bg-slate-200" />

          <input
            className="min-w-0 flex-1 border-none bg-transparent text-lg font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none disabled:cursor-default"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled Document"
            readOnly={!canEdit}
          />

          {!isOwner && (
            <div className="flex items-center gap-2">
              <span className="badge-shared shrink-0">Shared by {ownerName}</span>
              <PermissionBadge permission={permission} />
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SaveIndicator />
            <ExportMenu title={title} content={pendingContentRef.current || content} />

            {canEdit && (
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="btn-secondary !py-2 !text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </button>
            )}
            <input ref={importRef} type="file" accept={ACCEPTED_FILES} onChange={handleImport} hidden />

            {canComment && canEdit && (
              <button
                type="button"
                onClick={() => setSuggestionMode(!suggestionMode)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  suggestionMode
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Suggest mode
              </button>
            )}

            {isOwner && (
              <>
                <SharePanel
                  shares={shares}
                  onShare={handleShare}
                  onUpdatePermission={handleUpdatePermission}
                  onRemoveShare={handleRemoveShare}
                />
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {!canEdit && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          <Eye className="mr-1 inline h-4 w-4" />
          {permission === 'view'
            ? 'You have view-only access to this document'
            : 'You can comment and suggest changes, but not edit directly'}
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <PresenceBar users={presenceUsers} currentUserId={user?.id} />
        <div className="mt-4 flex flex-col gap-4 lg:flex-row">
          <main className="min-w-0 flex-1">
            <RichTextEditor
              key={`${id}-${editorKey}`}
              content={content}
              syncVersion={syncVersion}
              onChange={handleContentChange}
              onSelectionChange={setSelectedText}
              onFocusChange={setIsEditing}
              onCursorMove={handleCursorMove}
              onCursorClear={clearCursor}
              onSyncApplied={completeRemoteSync}
              remoteCursors={remoteCursors}
              frozenCursorUserIds={syncingUserIds}
              editable={canEdit}
            />
            <p className="mt-3 text-center text-xs text-slate-400">
              {canEdit
                ? 'Live sync enabled · Changes appear instantly for all viewers'
                : canComment
                  ? 'Comments update live in the panel →'
                  : 'Read-only · Document updates appear live'}
            </p>
          </main>

          <aside className="w-full shrink-0 lg:w-80">
            <div className="mb-2 flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setSidePanel('comments')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                  sidePanel === 'comments'
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Comments
              </button>
              <button
                type="button"
                onClick={() => setSidePanel('history')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                  sidePanel === 'history'
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                History
              </button>
            </div>

            {sidePanel === 'comments' && id && (
              <CommentsPanel
                documentId={id}
                currentUserId={user?.id}
                canComment={canComment}
                canEdit={canEdit}
                selectedText={selectedText}
                suggestionMode={suggestionMode}
                refreshVersion={commentsRefreshVersion}
                onSuggestionAccepted={handleSuggestionAccepted}
                onCommentPosted={notifyCommentsChanged}
              />
            )}
            {sidePanel === 'history' && id && (
              <VersionHistoryPanel
                documentId={id}
                canEdit={canEdit}
                onRestore={handleRestore}
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
