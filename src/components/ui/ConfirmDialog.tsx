'use client';

import { useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import BaseModal from './BaseModal';
import { Button } from '@/components/ui/button';

const VARIANTS = {
  danger: { Icon: ShieldAlert, icon: 'text-rose-600 dark:text-rose-400', buttonVariant: 'destructive' },
  warning: { Icon: AlertTriangle, icon: 'text-amber-600 dark:text-amber-400', buttonVariant: 'default' },
  info: { Icon: Info, icon: 'text-blue-600 dark:text-blue-400', buttonVariant: 'default' },
  success: { Icon: CheckCircle2, icon: 'text-emerald-600 dark:text-emerald-400', buttonVariant: 'success' },
};

export default function ConfirmDialog({ open, options = {}, onConfirm, onCancel, loading = false }: { open?: any; options?: any; onConfirm?: any; onCancel?: any; loading?: boolean }) {
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
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            {options.cancelLabel || 'Batal'}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={variant.buttonVariant}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Memproses...' : (options.confirmLabel || 'Konfirmasi')}
          </Button>
        </>
      )}
    >
      {options.details?.length > 0 && (
        <div className="px-5 py-4 sm:px-6">
          <ul className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-700 dark:text-slate-300">
            {options.details.map((detail) => (
              <li key={detail} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BaseModal>
  );
}
