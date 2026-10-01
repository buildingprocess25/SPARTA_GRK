'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck, User, Mail, KeyRound, CheckCircle2,
  X, ChevronDown, Lock, Shield, Sparkles, Building2,
  Phone, BadgeCheck, Eye, EyeOff, Send, Menu, Sun, Moon
} from 'lucide-react';

export default function Header({ isProfileOpen: externalProfileOpen, setIsProfileOpen: setExternalProfileOpen, onToggleMobileSidebar }) {
  const [internalProfileOpen, setInternalProfileOpen] = useState(false);
  const isProfileOpen = externalProfileOpen !== undefined ? externalProfileOpen : internalProfileOpen;
  const setIsProfileOpen = setExternalProfileOpen || setInternalProfileOpen;
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [profileData] = useState({
    name: 'Valens Aditya T.',
    username: 'valens.aditya',
    email: 'valens.aditya@alfamart.co.id',
    nip: 'ALFA-78921-EN',
    role: 'Energy & Sustainability Specialist',
    dept: 'Dept. Energy Management & ESG',
    division: 'Operation & Property Division',
    headOffice: 'Alfa Tower lt. 19, Tangerang',
    phone: '+62 812-9876-5432',
    joinYear: '2022',
  });

  const [passwordState, setPasswordState] = useState({
    currentPass: '',
    newPass: '',
    confirmPass: '',
  });

  const [notification, setNotification] = useState(null);
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

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    showNotification('Perubahan password belum tersedia karena autentikasi belum terhubung.');
  };

  const handleCheckEmail = () => {
    showNotification('Verifikasi email belum tersedia karena autentikasi belum terhubung.');
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 h-16 bg-white border-b border-slate-100 shadow-xs">
        {/* KIRI: Hamburger Menu untuk HP, Nama & Badge ESG */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden size-11 -ml-2 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            onClick={onToggleMobileSidebar}
            aria-label="Buka Navigasi Menu"
            title="Menu Navigasi"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2.5">
            <h1 className="max-w-[9rem] truncate text-sm sm:max-w-none sm:text-base font-bold text-slate-900 tracking-tight">
              VALENS ADITYA T.
            </h1>
            <span className="hidden lg:inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100">
              Sustainability ESG
            </span>
          </div>
        </div>

        {/* KANAN: System Live indicator */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">System Live</span>
          </div>
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
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Profil dengan Gradient Card & Avatar Badge */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shrink-0">
              <button
                ref={modalCloseRef}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
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
                    <h3 className="text-lg font-bold text-white truncate">{profileData.name}</h3>
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
              <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-emerald-800 animate-in">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{notification}</span>
              </div>
            )}

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* 1. INFORMASI AKUN & IDENTITAS */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase">
                    <User size={15} className="text-emerald-600" />
                    <span>Identitas Akun Alfamart</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">{profileData.nip}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Username</span>
                    <span className="font-mono font-bold text-emerald-700">@{profileData.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Departemen</span>
                    <span className="font-semibold text-slate-900">{profileData.dept}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Divisi</span>
                    <span className="text-slate-800">{profileData.division}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Bergabung Sejak</span>
                    <span className="font-mono text-slate-800">{profileData.joinYear}</span>
                  </div>
                </div>
              </div>

              {/* 2. CHECK EMAIL TERDAFTAR */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase">
                    <Mail size={15} className="text-blue-600" />
                    <span>Check Email Terdaftar</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
                    <BadgeCheck size={11} />
                    Corporate SSO
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-900 block truncate">{profileData.email}</span>
                    <span className="text-[11px] text-slate-500 block">Terhubung dengan sistem SSO & laporan emisi</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold shrink-0 disabled:opacity-70"
                    onClick={handleCheckEmail}
                    disabled
                  >
                    <Send size={12} />
                    <span>Belum tersedia</span>
                  </button>
                </div>
              </div>

              {/* 3. RESET PASSWORD */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase">
                    <KeyRound size={15} className="text-amber-600" />
                    <span>Reset Password Akun</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Enkripsi 256-bit</span>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-3">
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                    Fitur ini menunggu integrasi autentikasi. Jangan masukkan password akun asli.
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Password Saat Ini</label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        placeholder="Masukkan password lama"
                        value={passwordState.currentPass}
                        onChange={(e) => setPasswordState({ ...passwordState, currentPass: e.target.value })}
                        disabled
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 pr-9 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                      >
                        {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Password Baru</label>
                      <div className="relative">
                        <input
                          type={showNewPass ? 'text' : 'password'}
                          placeholder="Min. 8 karakter"
                          value={passwordState.newPass}
                          onChange={(e) => setPasswordState({ ...passwordState, newPass: e.target.value })}
                          disabled
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 pr-8 text-xs focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          onClick={() => setShowNewPass(!showNewPass)}
                        >
                          {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Konfirmasi</label>
                      <input
                        type="password"
                        placeholder="Ulangi password"
                        value={passwordState.confirmPass}
                        onChange={(e) => setPasswordState({ ...passwordState, confirmPass: e.target.value })}
                        disabled
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled
                      className="w-full inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-slate-300 text-slate-600 text-xs font-semibold py-2 cursor-not-allowed"
                    >
                      <Lock size={13} />
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Footer Profil */}
            <div className="border-t border-slate-100 px-6 py-3.5 bg-slate-50 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 flex items-center gap-1">
                <Shield size={13} className="text-emerald-600" />
                Terlindungi SPARTA Protocol
              </span>
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-700 font-semibold transition-colors"
                onClick={() => setIsProfileOpen(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
