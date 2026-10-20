'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Check } from 'lucide-react';

const DropdownContext = createContext(null);
const DropdownSubContext = createContext(null);

export function DropdownMenu({
  children,
  open: controlledOpen,
  onOpenChange,
  className = '',
  placement = 'bottom-start',
  ...props
}: { children?: any; open?: any; onOpenChange?: any; className?: string; placement?: string; [key: string]: any }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (val) => {
      if (!isControlled) setInternalOpen(val);
      if (onOpenChange) onOpenChange(val);
    },
    [isControlled, onOpenChange]
  );

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inContainer = containerRef.current && containerRef.current.contains(e.target);
      const inContent = contentRef.current && contentRef.current.contains(e.target);
      if (!inTrigger && !inContainer && !inContent) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setOpen, placement, triggerRef, contentRef }}>
      <div
        ref={containerRef}
        className={`relative inline-block text-left ${className}`}
        {...props}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export const DropdownMenuTrigger = React.forwardRef<any, { [key: string]: any } & { asChild?: boolean; children?: any; className?: string; [key: string]: any }>(function DropdownMenuTrigger(
  { asChild = false, children, className = '', ...props },
  forwardedRef
) {
  const context = useContext(DropdownContext);
  const isOpen = context?.isOpen || false;
  const setOpen = context?.setOpen || (() => {});
  const triggerRef = context?.triggerRef;

  const handleClick = (e) => {
    e.stopPropagation();
    setOpen(!isOpen);
  };

  const handleRef = React.useCallback(
    (node) => {
      if (triggerRef) triggerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [triggerRef, forwardedRef]
  );

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: handleRef,
      onClick: handleClick,
      'aria-expanded': isOpen,
      'aria-haspopup': 'menu',
      ...props,
    });
  }

  return (
    <button
      ref={handleRef}
      type="button"
      onClick={handleClick}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      className={className}
      {...props}
    >
      {children}
    </button>
  );
});

export const DropdownMenuContent = React.forwardRef<any, { [key: string]: any } & { className?: string; align?: string; children?: any; [key: string]: any }>(function DropdownMenuContent(
  { className = '', align = 'start', children, ...props },
  forwardedRef
) {
  const context = useContext(DropdownContext);
  const isOpen = context?.isOpen || false;
  const triggerRef = context?.triggerRef;
  const contentRef = context?.contentRef;

  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef?.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = 280;
    const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let top = openUpwards ? undefined : Math.round(rect.bottom + 4);
    let bottom = openUpwards ? Math.round(viewportHeight - rect.top + 4) : undefined;

    let left = align === 'end' ? Math.round(rect.right - 280) : Math.round(rect.left);
    if (left + 280 > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - 288);
    }
    if (left < 8) {
      left = 8;
    }

    setCoords({
      top,
      bottom,
      left,
    });
  }, [triggerRef, align]);

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const handleRef = React.useCallback(
    (node) => {
      if (contentRef) contentRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [contentRef, forwardedRef]
  );

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      ref={handleRef}
      role="menu"
      tabIndex={-1}
      style={{
        position: 'fixed',
        top: coords?.top !== undefined ? `${coords.top}px` : undefined,
        bottom: coords?.bottom !== undefined ? `${coords.bottom}px` : undefined,
        left: coords?.left !== undefined ? `${coords.left}px` : undefined,
        zIndex: 99999,
      }}
      className={`min-w-[8rem] overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-950 dark:text-slate-50 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100 ${className}`}
      {...props}
    >
      {children}
    </div>,
    document.body
  );
});

export function DropdownMenuGroup({ children, className = '', ...props }: { children?: any; className?: string; [key: string]: any }) {
  return (
    <div role="group" className={`p-0.5 space-y-0.5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export const DropdownMenuItem = React.forwardRef<React.ElementRef<'button'>, React.ComponentPropsWithoutRef<'button'> & { className?: string; inset?: boolean; disabled?: boolean; isDisabled?: boolean; selected?: boolean; children?: any; onClick?: any; [key: string]: any }>(function DropdownMenuItem(
  {
    className = '',
    inset = false,
    disabled = false,
    isDisabled = false,
    selected = false,
    children,
    onClick,
    ...props
  },
  ref
) {
  const context = useContext(DropdownContext);
  const isItemDisabled = disabled || isDisabled;

  const handleClick = (e) => {
    if (isItemDisabled) {
      e.preventDefault();
      return;
    }
    if (onClick) onClick(e);
    context?.setOpen(false);
  };

  return (
    <button
      ref={ref}
      role="menuitem"
      disabled={isItemDisabled}
      onClick={handleClick}
      className={`relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-colors text-left ${
        isItemDisabled
          ? 'pointer-events-none opacity-40'
          : selected
          ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
      } ${inset ? 'pl-8' : ''} ${className}`}
      {...props}
    >
      {selected && <Check size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
});

export function DropdownMenuLabel({
  className = '',
  inset = false,
  children,
  ...props
}: { className?: string; inset?: boolean; children?: any; [key: string]: any }) {
  return (
    <div
      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${
        inset ? 'pl-8' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className = '', ...props }: { className?: string; [key: string]: any }) {
  return (
    <div
      role="separator"
      className={`-mx-1 my-1 h-px bg-slate-100 dark:bg-slate-800 ${className}`}
      {...props}
    />
  );
}

export function DropdownMenuShortcut({ className = '', children, ...props }: { className?: string; children?: any; [key: string]: any }) {
  return (
    <span
      className={`ml-auto text-[10px] tracking-widest text-slate-400 dark:text-slate-500 font-mono ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function DropdownMenuSub({ children, className = '', ...props }: { children?: any; className?: string; [key: string]: any }) {
  const [subOpen, setSubOpen] = useState(false);
  return (
    <DropdownSubContext.Provider value={{ subOpen, setSubOpen }}>
      <div
        className={`relative ${className}`}
        onMouseEnter={() => setSubOpen(true)}
        onMouseLeave={() => setSubOpen(false)}
        {...props}
      >
        {children}
      </div>
    </DropdownSubContext.Provider>
  );
}

export function DropdownMenuSubTrigger({
  className = '',
  inset = false,
  children,
  ...props
}: { className?: string; inset?: boolean; children?: any; [key: string]: any }) {
  const subContext = useContext(DropdownSubContext);
  return (
    <div
      role="menuitem"
      className={`flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 ${
        inset ? 'pl-8' : ''
      } ${className}`}
      onClick={() => subContext?.setSubOpen(!subContext.subOpen)}
      {...props}
    >
      <span className="flex-1 truncate">{children}</span>
      <ChevronRight size={13} className="text-slate-400 shrink-0" />
    </div>
  );
}

export function DropdownMenuSubContent({ className = '', children, ...props }: { className?: string; children?: any; [key: string]: any }) {
  const subContext = useContext(DropdownSubContext);
  if (!subContext?.subOpen) return null;

  return (
    <div
      role="menu"
      className={`absolute left-full top-0 z-50 ml-1 min-w-[8rem] overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-950 dark:text-slate-50 shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default DropdownMenu;
