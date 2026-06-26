import { useState, useEffect } from 'react';
import { History, RotateCcw, Clock } from 'lucide-react';
import { api, DocumentVersion } from '../api';

interface VersionHistoryPanelProps {
  documentId: string;
  canEdit: boolean;
  onRestore: (content: string, title: string) => void;
}

export default function VersionHistoryPanel({
  documentId,
  canEdit,
  onRestore,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getVersions(documentId)
      .then(({ versions: v }) => setVersions(v))
      .catch(() => setError('Failed to load version history'))
      .finally(() => setLoading(false));
  }, [documentId]);

  const handleRestore = async (versionId: string) => {
    if (!confirm('Restore this version? Current content will be saved to history first.')) return;

    setRestoring(versionId);
    try {
      const { document } = await api.restoreVersion(documentId, versionId);
      onRestore(document.content, document.title);
      const { versions: v } = await api.getVersions(documentId);
      setVersions(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'Z').toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="h-4 w-4 text-brand-600" />
          Version history
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">Snapshots saved on each edit</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: '500px' }}>
        {loading && <p className="text-sm text-slate-400">Loading…</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
        {!loading && versions.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">
            No versions yet — edits will create snapshots
          </p>
        )}
        {versions.map((v, i) => (
          <div
            key={v.id}
            className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">
                {i === 0 ? 'Previous version' : `Version ${versions.length - i}`}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                {formatDate(v.created_at)} · {v.created_by_name}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => handleRestore(v.id)}
                disabled={restoring === v.id}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                {restoring === v.id ? '…' : 'Restore'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
