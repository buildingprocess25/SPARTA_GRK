'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, User, KeyRound, CheckCircle2,
  X, ChevronDown, Lock, Shield, Sparkles, Building2,
  Phone, BadgeCheck, Eye, EyeOff, Menu, LogOut,
  AlertCircle, LoaderCircle
} from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

// Flavor/display info per account - not tied to a real HR/SSO record, this
// is a 2-fixed-account login (see src/lib/auth.js), not a user-management
// system. Keyed by username so the modal stops showing "Valens Aditya T."
// for every account regardless of who's actually logged in.
const PROFILE_BY_USERNAME = {
  valens: {
    nip: 'ALFA-78921-EN',
    role: 'Energy & Sustainability Specialist',
    dept: 'Dept. Energy Management & ESG',
    division: 'Operation & Property Division',
    headOffice: 'Alfa Tower lt. 19, Tangerang',
    joinYear: '2022',
  },
  admin: {
    nip: 'ALFA-ADMIN',
    role: 'System Administrator',
    dept: 'Dept. Energy Management & ESG',
    division: 'Operation & Property Division',
    headOffice: 'Alfa Tower lt. 19, Tangerang',
    joinYear: '2026',
  },
};
const DEFAULT_PROFILE = { nip: '—', role: 'Pengguna SPARTA', dept: '—', division: '—', headOffice: 'Alfa Tower, Tangerang', joinYear: '—' };

export default function Header({ isProfileOpen: externalProfileOpen, setIsProfileOpen: setExternalProfileOpen, onToggleMobileSidebar }) {
  const router = useRouter();
  const [internalProfileOpen, setInternalProfileOpen] = useState(false);
  const isProfileOpen = externalProfileOpen !== undefined ? externalProfileOpen : internalProfileOpen;
  const setIsProfileOpen = setExternalProfileOpen || setInternalProfileOpen;
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success) setCurrentUser(data.user);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) { /* best effort - cookie clear still redirects below */ }
    router.replace('/login');
    router.refresh();
  };

  const displayName = currentUser?.displayName || 'Pengguna SPARTA';
  const profileData = PROFILE_BY_USERNAME[currentUser?.username] || DEFAULT_PROFILE;

  const [passwordState, setPasswordState] = useState({
    currentPass: '',
    newPass: '',
    confirmPass: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [notification, setNotification] = useState(null);
  const [notificationType, setNotificationType] = useState('success');
  const modalCloseRef = useRef(null);

  useEffect(() => {
    if (!isProfileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalCloseRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsProfileOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen, setIsProfileOpen]);

  const showNotification = (msg, type = 'success') => {
    setNotification(msg);
    setNotificationType(type);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (isChangingPassword) return;
    if (passwordState.newPass !== passwordState.confirmPass) {
      showNotification('Konfirmasi password baru tidak cocok.', 'error');
      return;
    }
    if (passwordState.newPass.length < 8) {
      showNotification('Password baru minimal 8 karakter.', 'error');
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordState.currentPass,
          newPassword: passwordState.newPass,
          confirmPassword: passwordState.confirmPass,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        showNotification(data?.error || 'Gagal mengubah password.', 'error');
        return;
      }
      setPasswordState({ currentPass: '', newPass: '', confirmPass: '' });
      showNotification('Password berhasil diubah.', 'success');
    } catch (_) {
      showNotification('Koneksi gagal, coba lagi.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-xs">
        {/* KIRI: Hamburger Menu untuk HP, Nama & Badge ESG */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden size-11 -ml-2 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            onClick={onToggleMobileSidebar}
            aria-label="Buka Navigasi Menu"
            title="Menu Navigasi"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2.5">
            <h1 className="max-w-[9rem] truncate text-sm sm:max-w-none sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight uppercase">
              {displayName}
            </h1>
            <span className="hidden lg:inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
              Sustainability ESG
            </span>
          </div>
        </div>

        {/* KANAN: System Live indicator & Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">System Live</span>
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Keluar"
            title="Keluar"
            className="size-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* MODAL CHECK PROFILE ULTRA ELEGAN */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in"
          role="dialog"
          aria-modal="true"
          aria-label="Profil pengguna"
          onClick={() => setIsProfileOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Profil dengan Gradient Card & Avatar Badge */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shrink-0">
              <button
                ref={modalCloseRef}
                className="absolute top-2 right-2 size-11 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                onClick={() => setIsProfileOpen(false)}
                title="Tutup"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-4">
                <div className="relative size-14 rounded-2xl bg-blue-600 border-2 border-white/20 flex items-center justify-center font-bold text-xl text-white shadow-md shrink-0">
                  <span>VA</span>
                  <div className="absolute -bottom-1 -right-1 size-5 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-white" title="Akun Terverifikasi">
                    <BadgeCheck size={12} />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white truncate">{displayName}</h3>
                    <span className="inline-flex rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold">
                      Active PIC
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate">{profileData.role}</p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                    <Building2 size={12} />
                    {profileData.headOffice}
                  </p>
                </div>
              </div>
            </div>

            {/* Notification Toast */}
            {notification && (
              <div className={`border-b px-4 py-2.5 flex items-center gap-2 text-xs font-medium animate-in ${notificationType === 'error'
                ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-800 dark:text-rose-300'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                }`}>
                {notificationType === 'error'
                  ? <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                  : <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
                <span>{notification}</span>
              </div>
            )}

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* 1. INFORMASI AKUN & IDENTITAS */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                    <User size={15} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Identitas Akun Alfamart</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{profileData.nip}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Username</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">@{currentUser?.username || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Departemen</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{profileData.dept}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Divisi</span>
                    <span className="text-slate-800 dark:text-slate-200">{profileData.division}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Bergabung Sejak</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{profileData.joinYear}</span>
                  </div>
                </div>
              </div>

              {/* 2. RESET PASSWORD */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                    <KeyRound size={15} className="text-amber-600 dark:text-amber-400" />
                    <span>Reset Password Akun</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Enkripsi 256-bit</span>
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
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-1.5 pr-9 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60"
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
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-1.5 pr-8 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60"
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
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60"
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

            {/* Footer Profil */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-3.5 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs shrink-0 gap-2">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 min-w-0">
                <Shield size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Terlindungi SPARTA Protocol</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-semibold transition-colors disabled:opacity-50"
                >
                  <LogOut size={13} />
                  Keluar
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
                  onClick={() => setIsProfileOpen(false)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
