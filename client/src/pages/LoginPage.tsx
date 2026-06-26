import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { FileText, LogIn, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { email: 'alice@ajaia.test', name: 'Alice Chen', role: 'Document owner' },
  { email: 'bob@ajaia.test', name: 'Bob Martinez', role: 'Shared access demo' },
  { email: 'carol@ajaia.test', name: 'Carol Williams', role: 'Additional teammate' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('alice@ajaia.test');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword('password123');
    setError('');
    setLoading(true);
    try {
      await login(accountEmail, 'password123');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Ajaia Docs</span>
        </div>

        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Write, share, and collaborate — simply.
          </h2>
          <p className="mt-4 max-w-md text-lg text-indigo-100">
            Create rich-text documents, import files, and share with your team in seconds.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-indigo-100">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
              Rich-text editing with auto-save
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
              Upload .txt, .md, and .docx files
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
              Share documents with teammates
            </li>
          </ul>
        </div>

        <p className="text-sm text-indigo-300">Ajaia LLC — Developer Assessment</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <div className="mb-4 flex items-center justify-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold text-slate-900">Ajaia Docs</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to access your documents</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input-field"
                placeholder="you@ajaia.test"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input-field"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              <LogIn className="h-4 w-4" />
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Users className="h-4 w-4 text-brand-600" />
              Demo accounts — click to sign in
            </div>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => quickLogin(acc.email)}
                  disabled={loading}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand-300 hover:shadow-sm disabled:opacity-60"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{acc.name}</p>
                    <p className="text-xs text-slate-500">{acc.email}</p>
                  </div>
                  <span className="text-xs text-slate-400">{acc.role}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              All accounts use password: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-600">password123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
