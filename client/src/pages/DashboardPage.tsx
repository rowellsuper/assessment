import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Upload,
  LogOut,
  File,
  Clock,
  Users,
  FolderOpen,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, DocumentListItem } from '../api';
import { PermissionBadge } from '../components/SharePanel';
import type { Permission } from '../api';

const ACCEPTED_FILES = '.txt,.md,.markdown,.docx';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [owned, setOwned] = useState<DocumentListItem[]>([]);
  const [shared, setShared] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadDocuments = async () => {
    try {
      const data = await api.getDocuments();
      setOwned(data.owned);
      setShared(data.shared);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const { document } = await api.createDocument();
      navigate(`/doc/${document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const { document } = await api.uploadDocument(file);
      navigate(`/doc/${document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'Z').toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Ajaia Docs</h1>
              <p className="text-xs text-slate-500">Your documents</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <button onClick={logout} className="btn-ghost">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Action cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-soft transition hover:border-brand-300 hover:shadow-card disabled:opacity-60"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">New document</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Start a blank document with rich-text editing
              </p>
            </div>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-soft transition hover:border-brand-300 hover:shadow-card disabled:opacity-60"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-100">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {uploading ? 'Uploading…' : 'Upload file'}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                Import .txt, .md, or .docx as a new document
              </p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILES}
            onChange={handleUpload}
            hidden
          />
        </div>

        {/* File type info */}
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <File className="h-4 w-4 shrink-0" />
          <span>
            <strong>Supported formats:</strong> .txt, .md, .docx &nbsp;·&nbsp; Max size: 5 MB
          </span>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-400">
            Loading your documents…
          </div>
        ) : (
          <div className="space-y-8">
            {/* Owned documents */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  My documents
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {owned.length}
                </span>
              </div>

              {owned.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-12 text-center">
                  <FileText className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-medium text-slate-600">No documents yet</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Create a new document or upload a file to get started
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {owned.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        to={`/doc/${doc.id}`}
                        className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft transition hover:border-brand-300 hover:shadow-card"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{doc.title}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                              <Clock className="h-3 w-3" />
                              Updated {formatDate(doc.updated_at)}
                            </p>
                          </div>
                        </div>
                        <span className="badge-owned ml-4 shrink-0">Owned</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Shared documents */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Shared with me
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {shared.length}
                </span>
              </div>

              {shared.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-12 text-center">
                  <Inbox className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-medium text-slate-600">No shared documents</p>
                  <p className="mt-1 text-sm text-slate-400">
                    When someone shares a document with you, it will appear here
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {shared.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        to={`/doc/${doc.id}`}
                        className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft transition hover:border-emerald-300 hover:shadow-card"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{doc.title}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                              <Users className="h-3 w-3" />
                              Shared by {doc.owner_name} · Updated {formatDate(doc.updated_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {doc.permission && doc.permission !== 'edit' && (
                            <PermissionBadge permission={doc.permission as Permission} />
                          )}
                          <span className="badge-shared">Shared</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
