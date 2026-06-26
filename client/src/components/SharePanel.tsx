import { useState, FormEvent, useEffect, useRef } from 'react';
import { Share2, X, UserPlus, Users, Eye, MessageSquare, Pencil } from 'lucide-react';
import { Share, Permission } from '../api';

interface SharePanelProps {
  shares: Share[];
  onShare: (email: string, permission: Permission) => Promise<void>;
  onUpdatePermission: (shareId: string, permission: Permission) => Promise<void>;
  onRemoveShare: (shareId: string) => Promise<void>;
}

const DEMO_EMAILS = ['alice@ajaia.test', 'bob@ajaia.test', 'carol@ajaia.test'];

const PERMISSIONS: { value: Permission; label: string; icon: typeof Eye; desc: string }[] = [
  { value: 'view', label: 'View only', icon: Eye, desc: 'Can read, no edits' },
  { value: 'comment', label: 'Comment', icon: MessageSquare, desc: 'Can comment & suggest' },
  { value: 'edit', label: 'Edit', icon: Pencil, desc: 'Full edit access' },
];

function PermissionBadge({ permission }: { permission: Permission }) {
  const p = PERMISSIONS.find((x) => x.value === permission)!;
  const Icon = p.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      <Icon className="h-3 w-3" />
      {p.label}
    </span>
  );
}

export default function SharePanel({
  shares,
  onShare,
  onUpdatePermission,
  onRemoveShare,
}: SharePanelProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<Permission>('edit');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');
    try {
      await onShare(email.trim(), permission);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button type="button" onClick={() => setOpen(!open)} className="btn-primary !py-2 !text-sm">
        <Share2 className="h-4 w-4" />
        Share
        {shares.length > 0 && (
          <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{shares.length}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="h-4 w-4 text-brand-600" />
                Share document
              </h3>
              <p className="mt-1 text-xs text-slate-500">Choose access level per teammate</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Teammate email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="bob@ajaia.test"
                list="demo-emails"
                required
                className="input-field !py-2"
              />
              <datalist id="demo-emails">
                {DEMO_EMAILS.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Permission</label>
              <div className="grid grid-cols-3 gap-1.5">
                {PERMISSIONS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPermission(p.value)}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition ${
                        permission === p.value
                          ? 'border-brand-400 bg-brand-50 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full !py-2">
              <UserPlus className="h-4 w-4" />
              {loading ? 'Sharing…' : 'Add person'}
            </button>
          </form>

          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          {shares.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                People with access ({shares.length})
              </p>
              <ul className="space-y-2">
                {shares.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                      <p className="truncate text-xs text-slate-500">{s.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <select
                        value={s.permission}
                        onChange={(e) =>
                          onUpdatePermission(s.id, e.target.value as Permission)
                        }
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
                      >
                        {PERMISSIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onRemoveShare(s.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { PermissionBadge };
