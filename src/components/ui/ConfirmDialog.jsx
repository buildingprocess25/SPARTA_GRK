'use client';

import { useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import BaseModal from './BaseModal';

const VARIANTS = {
  danger: { Icon: ShieldAlert, icon: 'text-rose-600', button: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500' },
  warning: { Icon: AlertTriangle, icon: 'text-amber-600', button: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500' },
  info: { Icon: Info, icon: 'text-blue-600', button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' },
  success: { Icon: CheckCircle2, icon: 'text-emerald-600', button: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500' },
};

export default function ConfirmDialog({ open, options = {}, onConfirm, onCancel, loading = false }) {
  const variant = VARIANTS[options.variant] || VARIANTS.info;
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const Icon = options.icon || variant.Icon;

  return (
    <BaseModal
      open={open}
      onClose={onCancel}
      title={options.title}
      subtitle={options.description}
      icon={<Icon size={21} className={variant.icon} />}
      size="sm"
      loading={loading}
      initialFocusRef={options.variant === 'danger' ? cancelRef : confirmRef}
      footer={(
        <>
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50">
            {options.cancelLabel || 'Batal'}
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={loading} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${variant.button}`}>
            {loading ? 'Memproses...' : (options.confirmLabel || 'Konfirmasi')}
          </button>
        </>
      )}
    >
      {options.details?.length > 0 && (
        <div className="px-5 py-4 sm:px-6">
          <ul className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {options.details.map((detail) => <li key={detail} className="flex gap-2"><span aria-hidden="true">•</span><span>{detail}</span></li>)}
          </ul>
        </div>
      )}
    </BaseModal>
  );
}
