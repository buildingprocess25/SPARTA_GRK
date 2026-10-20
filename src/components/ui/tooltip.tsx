'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const TooltipContext = React.createContext(null);

export function TooltipProvider({ children, delayDuration: _delayDuration = 200 }: { children?: any; delayDuration?: number }) {
  return <>{children}</>;
}

export function Tooltip({
  children,
  open: controlledOpen,
  onOpenChange,
}: { children?: any; open?: any; onOpenChange?: any }) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const triggerRef = React.useRef(null);
  const timeoutRef = React.useRef(null);

  const setOpen = React.useCallback(
    (val) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (!isControlled) setInternalOpen(val);
      if (onOpenChange) onOpenChange(val);
    },
    [isControlled, onOpenChange]
  );

  return (
    <TooltipContext.Provider value={{ isOpen, setOpen, triggerRef, timeoutRef }}>
      {children}
    </TooltipContext.Provider>
  );
}

export const TooltipTrigger = React.forwardRef<any, { [key: string]: any } & { asChild?: boolean; children?: any; className?: string; [key: string]: any }>(function TooltipTrigger(
  { asChild = false, children, className = '', ...props },
  forwardedRef
) {
  const context = React.useContext(TooltipContext);
  const triggerRef = context?.triggerRef;

  const handleRef = React.useCallback(
    (node) => {
      if (triggerRef) triggerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [triggerRef, forwardedRef]
  );

  const handleMouseEnter = () => context?.setOpen(true);
  const handleMouseLeave = () => context?.setOpen(false);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: handleRef,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleMouseEnter,
      onBlur: handleMouseLeave,
      ...props,
    });
  }

  return (
    <button
      ref={handleRef}
      type="button"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
});

export const TooltipContent = React.forwardRef<React.ElementRef<'div'>, React.ComponentPropsWithoutRef<'div'> & { className?: string; sideOffset?: number; children?: any; [key: string]: any }>(function TooltipContent(
  { className = '', sideOffset = 4, children, ...props },
  ref
) {
  const context = React.useContext(TooltipContext);
  const triggerRef = context?.triggerRef;

  const [mounted, setMounted] = React.useState(false);
  const [coords, setCoords] = React.useState(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useLayoutEffect(() => {
    if (!context?.isOpen || !triggerRef?.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = rect.left + rect.width / 2;

    setCoords({
      top: rect.bottom + sideOffset,
      left,
    });
  }, [context?.isOpen, triggerRef, sideOffset]);

  if (!context?.isOpen || !mounted || !coords) return null;

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 99999,
      }}
      className={cn(
        'max-w-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-100 dark:text-slate-200 shadow-md animate-in fade-in-0 zoom-in-95 duration-100 select-none pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </div>,
    document.body
  );
});

export default Tooltip;
