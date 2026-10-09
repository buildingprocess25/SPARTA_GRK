'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, X } from 'lucide-react';
import { dialogPresets } from '@/lib/dialog-presets';
import { useConfirmContext } from './ConfirmContext';

const SIZE_CLASSES = {
  sm: 'max-w-[420px]',
  md: 'max-w-[680px]',
  lg: 'max-w-[840px]',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let bodyLockCount = 0;
let originalBodyOverflow = '';
const openModalStack = [];

export default function BaseModal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  size = 'md',
  footer,
  dirty = false,
  loading = false,
  children,
  initialFocusRef,
}) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const modalId = useId();
  const confirm = useConfirmContext();

  useEffect(() => setMounted(true), []);

  const requestClose = useCallback(async () => {
    if (loading) return;
    if (dirty) {
      if (!confirm) return;
      const shouldClose = await confirm(dialogPresets.keluarTanpaSimpan);
      if (!shouldClose) return;
    }
    onClose?.();
  }, [confirm, dirty, loading, onClose]);
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (!open || !mounted) return undefined;
    previouslyFocusedRef.current = document.activeElement;
    if (bodyLockCount === 0) originalBodyOverflow = document.body.style.overflow;
    bodyLockCount += 1;
    openModalStack.push(modalId);
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const target = initialFocusRef?.current
        || dialogRef.current?.querySelector(FOCUSABLE_SELECTOR)
        || dialogRef.current;
      target?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (openModalStack.at(-1) !== modalId) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        requestCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      const stackIndex = openModalStack.lastIndexOf(modalId);
      if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
      bodyLockCount = Math.max(0, bodyLockCount - 1);
      if (bodyLockCount === 0) document.body.style.overflow = originalBodyOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [initialFocusRef, modalId, mounted, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descriptionId : undefined}
        aria-busy={loading || undefined}
        tabIndex={-1}
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xl outline-none animate-in zoom-in-95 duration-200 ${SIZE_CLASSES[size] || SIZE_CLASSES.md}`}
      >
        <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={titleId} className="text-lg font-bold leading-tight text-slate-900 dark:text-slate-100">{title}</h2>
                {badge && <span className="rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300">{badge}</span>}
              </div>
              {subtitle && <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={loading}
            aria-label="Tutup dialog"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <LoaderCircle size={18} className="animate-spin" /> : <X size={18} />}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && (
          <footer className="sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
