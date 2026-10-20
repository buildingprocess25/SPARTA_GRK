'use client';

import { ChevronDown, Eye, EyeOff, LoaderCircle, Users, RefreshCw, Check, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { SPARTA_ROLES, PROFILE_BY_USERNAME } from '@/lib/profileMeta';

export default function ProfileUsersTab({
  activeRoleOverride,
  creatingUser,
  effectiveRoleId,
  fetchUsers,
  handleCreateUser,
  handleDeleteUser,
  isAddingUser,
  isSuperAdmin,
  loadingUsers,
  newUserForm,
  setActiveRoleOverride,
  setIsAddingUser,
  setNewUserForm,
  setShowNewUserPassword,
  showNewUserPassword,
  usersList,
}: { activeRoleOverride?: any; creatingUser?: any; effectiveRoleId?: any; fetchUsers?: any; handleCreateUser?: any; handleDeleteUser?: any; isAddingUser?: any; isSuperAdmin?: any; loadingUsers?: any; newUserForm?: any; setActiveRoleOverride?: any; setIsAddingUser?: any; setNewUserForm?: any; setShowNewUserPassword?: any; showNewUserPassword?: any; usersList?: any }) {
  return (
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
              Password default: <strong className="text-blue-600 dark:text-blue-400 tabular-nums">ptsat123</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Username Login <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 tabular-nums text-xs z-10">@</span>
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
                      <span className="text-[10px] text-slate-400 tabular-nums">(@{usr.username})</span>
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
  );
}
