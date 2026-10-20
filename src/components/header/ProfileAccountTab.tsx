'use client';

import { User, KeyRound, Lock, Eye, EyeOff, LoaderCircle } from 'lucide-react';

export default function ProfileAccountTab({
  currentUser,
  handleResetPassword,
  isChangingPassword,
  passwordState,
  profileData,
  roleConfig,
  setPasswordState,
  setShowCurrentPass,
  setShowNewPass,
  showCurrentPass,
  showNewPass,
}: { currentUser?: any; handleResetPassword?: any; isChangingPassword?: any; passwordState?: any; profileData?: any; roleConfig?: any; setPasswordState?: any; setShowCurrentPass?: any; setShowNewPass?: any; showCurrentPass?: any; showNewPass?: any }) {
  return (
    <div className="space-y-4 animate-in">
      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
            <User size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span>Data Akun</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{profileData.nip}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Username</span>
            <span className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">@{currentUser?.username || '—'}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Peran Sistem</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{roleConfig.name}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Departemen</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{profileData.dept}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Divisi</span>
            <span className="text-slate-800 dark:text-slate-200">{profileData.division}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
            <KeyRound size={15} className="text-amber-600 dark:text-amber-400" />
            <span>Ganti Password</span>
          </div>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Password Saat Ini</label>
            <div className="relative">
              <input
                type={showCurrentPass ? 'text' : 'password'}
                placeholder="Masukkan password lama"
                value={passwordState.currentPass}
                onChange={(e) => setPasswordState({ ...passwordState, currentPass: e.target.value })}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-1.5 pr-9 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
              >
                {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Password Baru</label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  placeholder="Min. 8 karakter"
                  value={passwordState.newPass}
                  onChange={(e) => setPasswordState({ ...passwordState, newPass: e.target.value })}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-1.5 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  onClick={() => setShowNewPass(!showNewPass)}
                >
                  {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Konfirmasi</label>
              <input
                type="password"
                placeholder="Ulangi password"
                value={passwordState.confirmPass}
                onChange={(e) => setPasswordState({ ...passwordState, confirmPass: e.target.value })}
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isChangingPassword ? <LoaderCircle size={13} className="animate-spin" /> : <Lock size={13} />}
              <span>{isChangingPassword ? 'Menyimpan...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
