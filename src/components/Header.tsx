'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, CheckCircle2, X, Shield, Building2, Phone, BadgeCheck, Menu, LogOut, AlertCircle, PanelLeftClose, PanelLeftOpen, Wrench, Users, Cpu } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getProfileFor, getInitials, SPARTA_ROLES, generateInitialPassword } from '@/lib/profileMeta';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { dialogPresets } from '@/lib/dialog-presets';
import ProfileUsersTab from './header/ProfileUsersTab';
import ProfileMaintenanceTab from './header/ProfileMaintenanceTab';
import ProfileRolesTab from './header/ProfileRolesTab';
import ProfileAccountTab from './header/ProfileAccountTab';

export default function Header({
  isProfileOpen: externalProfileOpen,
  setIsProfileOpen: setExternalProfileOpen,
  onToggleMobileSidebar,
  isDesktopSidebarOpen = true,
  onToggleDesktopSidebar,
}: { isProfileOpen?: any; setIsProfileOpen?: any; onToggleMobileSidebar?: any; isDesktopSidebarOpen?: boolean; onToggleDesktopSidebar?: any }) {
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
    let message;
    try {
      const res = await fetch('/api/isolar', { method: 'POST', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      const sync = json?.syncResult;
      // The route answers 200 even when the vendor call failed or the manual cooldown skipped it, so read syncResult.
      if (!res.ok || json?.success === false) {
        message = `Sinkronisasi ditolak: ${json?.error || `server merespons ${res.status}`}`;
      } else if (sync?.status === 'cooldown_skipped') {
        message = `Baru saja disinkronkan. Coba lagi dalam ${Math.ceil((json.cooldownRemainingMs || 0) / 1000)} detik.`;
      } else if (sync?.status === 'failed') {
        message = `Sinkronisasi gagal: ${sync.error || 'iSolarCloud tidak merespons'}. Data terakhir yang tersimpan tetap ditampilkan.`;
      } else {
        message = 'Sinkronisasi telemetri 37 DC berhasil diperbarui.';
      }
      // fetchHealth clears the status as its first step, so it runs before the result is shown, not after.
      fetchHealth();
    } catch (_) {
      message = 'Sinkronisasi gagal: koneksi ke server terputus.';
    }
    setMaintActionStatus(message);
    setTimeout(() => setMaintActionStatus(null), 6000);
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
  const emptyNewUserForm = () => ({
    username: '',
    displayName: '',
    password: generateInitialPassword(),
    roleId: 'admin',
    nip: '',
    dept: '',
    division: '',
  });
  const [newUserForm, setNewUserForm] = useState(emptyNewUserForm);

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
        setNewUserForm(emptyNewUserForm());
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

          <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
            SPARTA Gas Rumah Kaca
          </span>
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
                      <span className="text-[10px] tabular-nums px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
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
                <ProfileAccountTab
                  currentUser={currentUser}
                  handleResetPassword={handleResetPassword}
                  isChangingPassword={isChangingPassword}
                  passwordState={passwordState}
                  profileData={profileData}
                  roleConfig={roleConfig}
                  setPasswordState={setPasswordState}
                  setShowCurrentPass={setShowCurrentPass}
                  setShowNewPass={setShowNewPass}
                  showCurrentPass={showCurrentPass}
                  showNewPass={showNewPass}
                />
              )}

              {/* TAB 2: HAK AKSES & PERAN */}
              {profileTab === 'roles' && (
                <ProfileRolesTab
                  effectiveRoleId={effectiveRoleId}
                  roleConfig={roleConfig}
                />
              )}

              {/* TAB 3: MAINTENANCE SISTEM (KHUSUS ADMIN SUPER) */}
              {profileTab === 'maintenance' && (
                <ProfileMaintenanceTab
                  fetchHealth={fetchHealth}
                  handleClearCache={handleClearCache}
                  handleForceSync={handleForceSync}
                  healthData={healthData}
                  healthLoading={healthLoading}
                  isSuperAdmin={isSuperAdmin}
                  maintActionStatus={maintActionStatus}
                  setActiveRoleOverride={setActiveRoleOverride}
                />
              )}

              {/* TAB 4: MANAJEMEN PENGGUNA & SIMULASI ROLE */}
              {profileTab === 'users' && (
                <ProfileUsersTab
                  activeRoleOverride={activeRoleOverride}
                  creatingUser={creatingUser}
                  effectiveRoleId={effectiveRoleId}
                  fetchUsers={fetchUsers}
                  handleCreateUser={handleCreateUser}
                  handleDeleteUser={handleDeleteUser}
                  isAddingUser={isAddingUser}
                  isSuperAdmin={isSuperAdmin}
                  loadingUsers={loadingUsers}
                  newUserForm={newUserForm}
                  setActiveRoleOverride={setActiveRoleOverride}
                  setIsAddingUser={setIsAddingUser}
                  setNewUserForm={setNewUserForm}
                  setShowNewUserPassword={setShowNewUserPassword}
                  showNewUserPassword={showNewUserPassword}
                  usersList={usersList}
                />
              )}
            </div>

            {/* Footer Profil */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs shrink-0 gap-2">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 min-w-0">
                <Shield size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">SPARTA Gas Rumah Kaca &middot; {roleConfig.name}</span>
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
