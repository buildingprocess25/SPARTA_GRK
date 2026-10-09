'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User, Eye, EyeOff, LogIn } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || 'Login gagal.');
        setLoading(false);
        return;
      }
      const redirectTo = searchParams.get('redirect');
      router.replace(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/');
      router.refresh();
    } catch (_err) {
      setError('Tidak dapat terhubung ke server. Coba lagi.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1220] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-6">
          <img src="/alfamart-logo.png" alt="Alfamart" className="w-40 h-auto dark:brightness-110" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 text-center">
            SPARTA Sustainability Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1 mb-5">
            Masuk untuk mengakses dashboard
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Username
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="admin atau valens"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold py-2.5 mt-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogIn size={15} />
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-4">
          Akses terbatas untuk tim Sustainability ESG Alfamart.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
