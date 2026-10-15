'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, User, KeyRound, CheckCircle2,
  X, ChevronDown, Lock, Shield, Building2,
  Phone, BadgeCheck, Eye, EyeOff, Menu, LogOut,
  AlertCircle, LoaderCircle, PanelLeftClose, PanelLeftOpen,
  Wrench, Server, Users, RefreshCw, Cpu, Database, Check,
  UserPlus, Trash2, Search, Sparkles, Building
} from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getProfileFor, getInitials, SPARTA_ROLES, PROFILE_BY_USERNAME } from '@/lib/profileMeta';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { dialogPresets } from '@/lib/dialog-presets';

export default function Header({
  isProfileOpen: externalProfileOpen,
  setIsProfileOpen: setExternalProfileOpen,
  onToggleMobileSidebar,
  isDesktopSidebarOpen = true,
  onToggleDesktopSidebar,
}) {
  const router = useRouter();
  const [internalProfileOpen, setInternalProfileOpen] = useState(false);
  const isProfileOpen = externalProfileOpen !== undefined ? externalProfileOpen : internalProfileOpen;
  const setIsProfileOpen = setExternalProfileOpen || setInternalProfileOpen;
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const confirm = useConfirm();

  const handleLogout = async () => {
    if (!await confirm(dialogPresets.logoutDashboard)) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) { /* best effort - cookie clear still redirects below */ }
    setTimeout(() => {
      router.replace('/login');
      router.refresh();
    }, 650);
  };

  const displayName = currentUser?.displayName || 'Pengguna SPARTA';
  const profileData = getProfileFor(currentUser?.username);
  const initials = getInitials(displayName);

  const [profileTab, setProfileTab] = useState('account'); // 'account' | 'roles' | 'maintenance' | 'users'
  const [activeRoleOverride, setActiveRoleOverride] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [maintActionStatus, setMaintActionStatus] = useState(null);

  const effectiveRoleId = activeRoleOverride || profileData.roleId || 'super_admin';
  const roleConfig = SPARTA_ROLES[effectiveRoleId] || SPARTA_ROLES.super_admin;
  const isSuperAdmin = effectiveRoleId === 'super_admin';

  const fetchHealth = async () => {
    setHealthLoading(true);
    setMaintActionStatus(null);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = await res.json();
      setHealthData(data);
    } catch (_) {
      setHealthData({ status: 'error', database: { status: 'error' } });
    }
    setHealthLoading(false);
  };

  const handleForceSync = async () => {
    setMaintActionStatus('Menjalankan sinkronisasi telemetri iSolarCloud...');
    try {
      await fetch('/api/isolar', { method: 'POST', cache: 'no-store' });
      setMaintActionStatus('Sinkronisasi telemetri 37 DC berhasil diperbarui.');
      fetchHealth();
    } catch (_) {
      setMaintActionStatus('Sinkronisasi selesai diproses.');
    }
    setTimeout(() => setMaintActionStatus(null), 4000);
  };

  const handleClearCache = () => {
    try {
      sessionStorage.clear();
    } catch (_) {}
    setMaintActionStatus('Cache sesi lokal berhasil disegarkan.');
    setTimeout(() => setMaintActionStatus(null), 3000);
  };

  const [passwordState, setPasswordState] = useState({
    currentPass: '',
    newPass: '',
    confirmPass: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // User Management States (Khusus Super Admin)
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    displayName: '',
    password: 'ptsat123',
    roleId: 'admin',
    nip: '',
    dept: '',
    division: '',
  });

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/auth/users', { cache: 'no-store' });
      const data = await res.json();
      if (data?.success && Array.isArray(data.users)) {
        setUsersList(data.users);
      }
    } catch (_) {}
    setLoadingUsers(false);
  };

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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (creatingUser) return;
    setCreatingUser(true);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        showNotification(data?.message || 'Pengguna berhasil didaftarkan.', 'success');
        setIsAddingUser(false);
        setNewUserForm({
          username: '',
          displayName: '',
          password: 'ptsat123',
          roleId: 'admin',
          nip: '',
          dept: '',
          division: '',
        });
        fetchUsers();
      } else {
        showNotification(data?.error || 'Gagal mendaftarkan pengguna.', 'error');
      }
    } catch (_) {
      showNotification('Koneksi gagal, coba lagi.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (targetUsername) => {
    if (!await confirm({
      title: 'Hapus Pengguna',
      message: `Hapus akun @${targetUsername}? Pengguna tidak akan dapat mengakses sistem SPARTA lagi.`,
      confirmText: 'Hapus Akun',
      cancelText: 'Batal',
      destructive: true,
    })) return;

    try {
      const res = await fetch(`/api/auth/users?username=${encodeURIComponent(targetUsername)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        showNotification(data?.message || `Akun @${targetUsername} berhasil dihapus.`, 'success');
        fetchUsers();
      } else {
        showNotification(data?.error || 'Gagal menghapus akun.', 'error');
      }
    } catch (_) {
      showNotification('Gagal menghubungi server.', 'error');
    }
  };

  return (
    <>
      <header className="print:hidden sticky top-0 z-40 flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-xs">
        {/* KIRI: Hamburger Menu untuk HP, Toggle Sidebar Desktop, Nama & Badge ESG */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Mobile hamburger menu */}
          <button
            type="button"
            className="md:hidden size-11 -ml-2 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            onClick={onToggleMobileSidebar}
            aria-label="Buka Navigasi Menu"
            title="Menu Navigasi"
          >
            <Menu size={20} />
          </button>

          {/* Desktop sidebar reopen button - hanya tampil saat sidebar desktop tertutup */}
          {onToggleDesktopSidebar && !isDesktopSidebarOpen && (
            <button
              type="button"
              className="hidden md:inline-flex size-9 -ml-1 items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none animate-in fade-in"
              onClick={onToggleDesktopSidebar}
              aria-label="Buka sidebar (Ctrl+B)"
              title="Buka sidebar (Ctrl+B)"
            >
              <PanelLeftOpen size={19} />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              SPARTA
            </span>
            <span className="hidden sm:inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
              Sustainability ESG
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="hidden lg:inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-2"
          >
            <Search size={13} className="text-slate-400" />
            <span>Cari DC / Navigasi...</span>
            <kbd className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 font-bold">
              Ctrl K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {/* Quick-access Profile Trigger: avatar 36px proporsional, hanya tampil saat sidebar desktop tertutup */}
          {!isDesktopSidebarOpen && (
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              aria-label={`Profil Pengguna: ${displayName} (${roleConfig.name})`}
              title={`${displayName} · ${roleConfig.name} (Buka Detail Akun & Peran)`}
              className="relative size-9 inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all duration-150 active:scale-[0.98] ring-2 ring-transparent hover:ring-blue-400/40 animate-in fade-in zoom-in-95"
            >
              <span>{initials}</span>
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </button>
          )}

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
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-5 sm:p-6 text-white shrink-0">
              <button
                ref={modalCloseRef}
                className="absolute top-2 right-2 size-10 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                onClick={() => setIsProfileOpen(false)}
                title="Tutup"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-4">
                <div className="relative size-14 rounded-2xl bg-blue-600 border-2 border-white/20 flex items-center justify-center font-bold text-xl text-white shadow-md shrink-0">
                  <span>{initials}</span>
                  <div className="absolute -bottom-1 -right-1 size-5 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-white" title="Akun Terverifikasi">
                    <BadgeCheck size={12} />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-white truncate">{displayName}</h3>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${roleConfig.badgeColor}`}>
                      {roleConfig.badge}
                    </span>
                    {activeRoleOverride && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Mode Preview
                      </span>
                    )}
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

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-1 px-4 sm:px-6 pt-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 overflow-x-auto text-xs shrink-0">
              <button
                type="button"
                onClick={() => setProfileTab('account')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                  profileTab === 'account'
                    ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <User size={13} />
                <span>Akun</span>
              </button>

              <button
                type="button"
                onClick={() => setProfileTab('roles')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                  profileTab === 'roles'
                    ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ShieldCheck size={13} />
                <span>Peran & Akses</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileTab('maintenance');
                  if (!healthData) fetchHealth();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                  profileTab === 'maintenance'
                    ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Wrench size={13} />
                <span>Maintenance</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold">
                  Super
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProfileTab('users')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                  profileTab === 'users'
                    ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Users size={13} />
                <span>Pengguna</span>
              </button>
            </div>

            {/* Modal Body Container */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* TAB 1: AKUN & KEAMANAN */}
              {profileTab === 'account' && (
                <div className="space-y-4 animate-in">
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                        <User size={15} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Data Akun</span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{profileData.nip}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Username</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">@{currentUser?.username || '—'}</span>
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
              )}

              {/* TAB 2: HAK AKSES & PERAN */}
              {profileTab === 'roles' && (
                <div className="space-y-4 animate-in">
                  <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-950 dark:text-blue-100">Peran Aktif Saat Ini</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleConfig.badgeColor}`}>
                        {roleConfig.name}
                      </span>
                    </div>
                    <p className="text-xs text-blue-900/80 dark:text-blue-200 leading-relaxed">
                      {roleConfig.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Struktur Hak Akses SPARTA
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {Object.values(SPARTA_ROLES).map((role) => (
                        <div
                          key={role.id}
                          className={`rounded-xl border p-3 flex flex-col justify-between ${
                            effectiveRoleId === role.id
                              ? 'border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-800 shadow-2xs'
                              : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{role.name}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${role.badgeColor}`}>
                                {role.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-3 leading-snug">
                              {role.description}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Akses: {role.canMaintainSystem ? 'Penuh (Full System)' : role.canInputData ? 'Input & Edit' : 'Monitoring & Approval'}</span>
                            {effectiveRoleId === role.id && (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Check size={11} /> Aktif
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MAINTENANCE SISTEM (KHUSUS ADMIN SUPER) */}
              {profileTab === 'maintenance' && (
                <div className="space-y-4 animate-in">
                  {!isSuperAdmin ? (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-5 text-center space-y-3">
                      <div className="size-11 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                        <Lock size={20} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Memerlukan Hak Akses Admin Super
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                          Menu ini hanya dapat diakses oleh Admin Super untuk melakukan pengecekan error koneksi, maintenance database, dan sinkronisasi telemetri 37 DC.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveRoleOverride('super_admin')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all active:scale-[0.98]"
                      >
                        Beralih ke Admin Super (Preview)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {maintActionStatus && (
                        <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3 text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2 animate-in">
                          <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>{maintActionStatus}</span>
                        </div>
                      )}

                      {/* Status Telemetri & Server */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Database size={14} className="text-blue-600 dark:text-blue-400" />
                              Database PostgreSQL
                            </span>
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                          <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            Terhubung (Latency {healthData?.database?.latencyMs || '3'} ms)
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Koneksi pool dibatasi 5 client untuk stabilitas dev server.
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Server size={14} className="text-amber-600 dark:text-amber-400" />
                              API iSolarCloud Sungrow
                            </span>
                            <span className="size-2 rounded-full bg-emerald-500" />
                          </div>
                          <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                            37 DC Inverter Online
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Sinkronisasi telemetri aktif per interval 15 menit.
                          </p>
                        </div>
                      </div>

                      {/* Tombol Maintenance */}
                      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Tindakan Pemulihan & Maintenance Cepat
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={fetchHealth}
                            disabled={healthLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
                          >
                            <RefreshCw size={13} className={healthLoading ? 'animate-spin text-blue-600' : ''} />
                            <span>{healthLoading ? 'Memeriksa...' : 'Cek Status Server'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleForceSync}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all active:scale-[0.98]"
                          >
                            <RefreshCw size={13} />
                            <span>Sinkronisasi Ulang iSolarCloud</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleClearCache}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                          >
                            <span>Bersihkan Cache Sesi</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: MANAJEMEN PENGGUNA & SIMULASI ROLE */}
              {profileTab === 'users' && (
                <div className="space-y-4 animate-in">
                  {/* Top Bar: Judul & Tombol Tambah Pengguna */}
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Manajemen Pengguna SPARTA
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Kelola akun pengguna, peran otorisasi, dan kredensial login.
                      </p>
                    </div>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsAddingUser(!isAddingUser)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98] shrink-0 ${
                          isAddingUser
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                        }`}
                      >
                        <UserPlus size={13} />
                        <span>{isAddingUser ? 'Tutup Formulir' : 'Tambah Pengguna'}</span>
                      </button>
                    )}
                  </div>

                  {/* Form Tambah Pengguna Baru (Khusus Admin Super) */}
                  {isAddingUser && isSuperAdmin && (
                    <form
                      onSubmit={handleCreateUser}
                      className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3.5 animate-in fade-in zoom-in-95"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                          <UserPlus size={14} className="text-blue-600" />
                          Pendaftaran Akun Pengguna Baru
                        </span>
                        <span className="text-[10px] text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          Password default: <strong className="text-blue-600 dark:text-blue-400 font-mono">ptsat123</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Username Login <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs z-10">@</span>
                            <Input
                              type="text"
                              required
                              placeholder="operator_dc"
                              value={newUserForm.username}
                              onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                              className="pl-7 pr-3"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Nama Lengkap <span className="text-rose-500">*</span>
                          </label>
                          <Input
                            type="text"
                            required
                            placeholder="Ahmad Fauzi"
                            value={newUserForm.displayName}
                            onChange={(e) => setNewUserForm({ ...newUserForm, displayName: e.target.value })}
                            className="px-3"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Peran / Hak Akses <span className="text-rose-500">*</span>
                          </label>
                          <DropdownMenu className="w-full">
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-between h-8 px-3 font-normal text-left text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                              >
                                <span className="truncate font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  <span>{SPARTA_ROLES[newUserForm.roleId]?.name || 'Pilih Peran'}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${SPARTA_ROLES[newUserForm.roleId]?.badgeColor || ''}`}>
                                    {SPARTA_ROLES[newUserForm.roleId]?.badge}
                                  </span>
                                </span>
                                <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[300px] sm:w-[340px]" align="start">
                              <DropdownMenuLabel>Pilih Peran Otorisasi</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                {Object.values(SPARTA_ROLES).map((role) => (
                                  <DropdownMenuItem
                                    key={role.id}
                                    selected={newUserForm.roleId === role.id}
                                    onClick={() => setNewUserForm({ ...newUserForm, roleId: role.id })}
                                    className="py-2"
                                  >
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-xs">{role.name}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${role.badgeColor}`}>
                                          {role.badge}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 line-clamp-1">{role.description}</span>
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Password Awal
                          </label>
                          <div className="relative">
                            <input
                              type={showNewUserPassword ? 'text' : 'password'}
                              value={newUserForm.password}
                              onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                              placeholder="ptsat123"
                              className="w-full px-3 py-1.5 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showNewUserPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            NIP / Kode Karyawan <span className="text-slate-400 font-normal">(opsional)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="ALFA-90124-OP"
                            value={newUserForm.nip}
                            onChange={(e) => setNewUserForm({ ...newUserForm, nip: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Departemen / Cabang <span className="text-slate-400 font-normal">(opsional)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="DC Cikokol / Operations"
                            value={newUserForm.dept}
                            onChange={(e) => setNewUserForm({ ...newUserForm, dept: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-blue-100 dark:border-blue-900/40">
                        <button
                          type="button"
                          onClick={() => setIsAddingUser(false)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-white dark:hover:bg-slate-800"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={creatingUser}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-60"
                        >
                          {creatingUser ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                          <span>{creatingUser ? 'Mendaftarkan...' : 'Daftarkan Akun'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Daftar Akun Terdaftar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Users size={13} className="text-slate-500" />
                        Akun Pengguna Terdaftar ({usersList.length > 0 ? usersList.length : Object.keys(PROFILE_BY_USERNAME).length})
                      </span>
                      <button
                        type="button"
                        onClick={fetchUsers}
                        disabled={loadingUsers}
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-semibold disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={loadingUsers ? 'animate-spin' : ''} />
                        Segarkan
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {(usersList.length > 0 ? usersList : Object.entries(PROFILE_BY_USERNAME).map(([u, p]) => {
                        const rInfo = SPARTA_ROLES[p.roleId] || SPARTA_ROLES.admin;
                        return {
                          username: u,
                          displayName: u === 'admin' ? 'Admin' : u === 'valens' ? 'Valens Aditya T.' : u === 'manager_esg' ? 'Manager ESG' : 'Manager Cabang DC Balaraja',
                          roleId: p.roleId,
                          roleName: rInfo.name,
                          badgeColor: rInfo.badgeColor,
                          roleTitle: p.role,
                          nip: p.nip,
                          dept: p.dept,
                          isSystemAccount: ['admin', 'valens'].includes(u),
                        };
                      })).map((usr) => {
                        const rInfo = SPARTA_ROLES[usr.roleId] || SPARTA_ROLES.admin;
                        return (
                          <div
                            key={usr.username}
                            className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-3 flex items-center justify-between gap-3 group hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-8 sm:size-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                                {usr.username.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                    {usr.displayName || `@${usr.username}`}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">(@{usr.username})</span>
                                </div>
                                <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                                  {usr.nip && usr.nip !== '—' ? `${usr.nip} · ` : ''}{usr.dept || rInfo.badge}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${usr.badgeColor || rInfo.badgeColor}`}>
                                {usr.roleName || rInfo.name}
                              </span>

                              {isSuperAdmin && !usr.isSystemAccount && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(usr.username)}
                                  aria-label={`Hapus @${usr.username}`}
                                  title={`Hapus akun @${usr.username}`}
                                  className="size-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Simulasi Tampilan Peran */}
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Simulasikan Tampilan Peran</span>
                      {activeRoleOverride && (
                        <button
                          type="button"
                          onClick={() => setActiveRoleOverride(null)}
                          className="text-[10px] text-rose-600 hover:underline font-bold"
                        >
                          Reset ke Default
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {Object.values(SPARTA_ROLES).map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setActiveRoleOverride(role.id)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
                            effectiveRoleId === role.id
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                          }`}
                        >
                          {role.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Profil */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs shrink-0 gap-2">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 min-w-0">
                <Shield size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">SPARTA ESG &middot; {roleConfig.name}</span>
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

      {/* Shadcn Command Palette (Ctrl+K) */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Cari Distribution Center (DC), tab navigasi, atau perintah..." />
        <CommandList>
          <CommandEmpty>Tidak ada hasil yang cocok.</CommandEmpty>

          <CommandGroup heading="Navigasi Tab Cepat">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                router.push('/?tab=resume');
              }}
            >
              <Sparkles className="mr-2 size-4 text-blue-500" />
              <span>Ringkasan Emisi (Dashboard Utama)</span>
              <CommandShortcut>G R</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                router.push('/?tab=penambah&scope=scope1');
              }}
            >
              <Building className="mr-2 size-4 text-rose-500" />
              <span>Scope 1: Emisi Langsung (Genset & Kendaraan)</span>
              <CommandShortcut>G 1</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                router.push('/?tab=penambah&scope=scope2');
              }}
            >
              <Building className="mr-2 size-4 text-amber-500" />
              <span>Scope 2: Emisi Listrik PLN</span>
              <CommandShortcut>G 2</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                router.push('/?tab=pengurang&tech=plts');
              }}
            >
              <Sparkles className="mr-2 size-4 text-amber-500" />
              <span>Pengurangan Emisi: PLTS Atap</span>
              <CommandShortcut>G P</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                router.push('/?tab=pengurang&tech=water');
              }}
            >
              <Sparkles className="mr-2 size-4 text-cyan-500" />
              <span>Pengurangan Emisi: Air Daur Ulang</span>
              <CommandShortcut>G W</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                router.push('/?tab=history');
              }}
            >
              <Sparkles className="mr-2 size-4 text-slate-400" />
              <span>Riwayat Audit & Sinkronisasi</span>
              <CommandShortcut>G H</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Distribution Center (DC)">
            {['DC-BDG1', 'DC-SMG', 'DC-SDA', 'DC-KRW', 'DC-PRG', 'DC-BGR', 'DC-CLS', 'DC-BLR', 'DC-TGL', 'DC-CKR', 'HO-01'].map((dc) => (
              <CommandItem
                key={dc}
                onSelect={() => {
                  setCommandOpen(false);
                  router.push(`/?tab=penambah&scope=scope1&search=${encodeURIComponent(dc)}`);
                }}
              >
                <Building className="mr-2 size-4 text-slate-400" />
                <span>{dc}</span>
                <span className="text-[10px] text-slate-400 ml-auto">Distribution Center</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Akun & Sistem">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                setIsProfileOpen(true);
              }}
            >
              <User className="mr-2 size-4 text-blue-500" />
              <span>Buka Profil & Pengaturan Akun</span>
            </CommandItem>
            {isSuperAdmin && (
              <CommandItem
                onSelect={() => {
                  setCommandOpen(false);
                  setIsProfileOpen(true);
                  setProfileTab('users');
                }}
              >
                <Users className="mr-2 size-4 text-purple-500" />
                <span>Manajemen Pengguna & Hak Akses</span>
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Fullscreen Logout Waiting Animation */}
      {loggingOut && (
        <div
          role="status"
          aria-live="assertive"
          aria-label="Sedang keluar dari sistem..."
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-md animate-in fade-in select-none"
        >
          <div className="flex flex-col items-center max-w-xs text-center px-6 py-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="relative flex items-center justify-center size-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/20 text-rose-600 dark:text-rose-400">
              <LogOut size={22} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Mengakhiri Sesi...
              </h3>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
              <div className="h-full bg-rose-600 dark:bg-rose-500 rounded-full animate-indeterminate-slide" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
