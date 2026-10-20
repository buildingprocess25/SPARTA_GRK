'use client';

import { Check } from 'lucide-react';
import { SPARTA_ROLES } from '@/lib/profileMeta';

export default function ProfileRolesTab({
  effectiveRoleId,
  roleConfig,
}) {
  return (
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
  );
}
