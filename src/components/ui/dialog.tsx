'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DialogContext = React.createContext(null);

export function Dialog({
  open: controlledOpen,
  onOpenChange,
  children,
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = React.useCallback(
    (val) => {
      if (!isControlled) setInternalOpen(val);
      if (onOpenChange) onOpenChange(val);
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogContext.Provider value={{ isOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export const DialogTrigger = React.forwardRef(function DialogTrigger(
  { asChild = false, children, onClick, ...props },
  ref
) {
  const context = React.useContext(DialogContext);

  const handleClick = (e) => {
    context?.setOpen(true);
    if (onClick) onClick(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref,
      onClick: handleClick,
      ...props,
    });
  }

  return (
    <button ref={ref} type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
});

export const DialogContent = React.forwardRef(function DialogContent(
  { className = '', children, ...props },
  ref
) {
  const context = React.useContext(DialogContext);
  const [mounted, setMounted] = React.useState(false);
  const contentRef = React.useRef(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!context?.isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') context.setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [context]);

  if (!context?.isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-150"
        onClick={() => context.setOpen(false)}
      />

      {/* Dialog box */}
      <div
        ref={ref || contentRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-50 w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-slate-950 dark:text-slate-50 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150',
          className
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          onClick={() => context.setOpen(false)}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={16} />
          <span className="sr-only">Tutup</span>
        </button>
      </div>
    </div>,
    document.body
  );
});

export function DialogHeader({ className = '', children, ...props }) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-left mb-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogFooter({ className = '', children, ...props }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 pt-3 border-t border-slate-100 dark:border-slate-800',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogTitle({ className = '', children, ...props }) {
  return (
    <h2
      className={cn('text-base font-bold text-slate-900 dark:text-slate-100 leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({ className = '', children, ...props }) {
  return (
    <p
      className={cn('text-xs text-slate-500 dark:text-slate-400 mt-1', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export default Dialog;
