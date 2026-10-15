'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

const SelectContext = createContext(null);

export function Select({
  value,
  defaultValue,
  onValueChange,
  onChange,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);

  const currentValue = value !== undefined ? value : internalValue;

  const handleSelect = React.useCallback(
    (val) => {
      if (value === undefined) setInternalValue(val);
      if (onValueChange) onValueChange(val);
      if (onChange) onChange({ target: { value: val } });
      setIsOpen(false);
    },
    [value, onValueChange, onChange]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inContainer = containerRef.current && containerRef.current.contains(e.target);
      const inContent = contentRef.current && contentRef.current.contains(e.target);
      if (!inTrigger && !inContainer && !inContent) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <SelectContext.Provider
      value={{
        value: currentValue,
        onSelect: handleSelect,
        isOpen,
        setIsOpen,
        disabled,
        triggerRef,
        contentRef,
      }}
    >
      <div
        ref={containerRef}
        className={`relative inline-block w-full text-left ${className}`}
        {...props}
      >
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export const SelectTrigger = React.forwardRef(function SelectTrigger(
  { className = '', children, id, ...props },
  forwardedRef
) {
  const context = useContext(SelectContext);
  const isOpen = context?.isOpen || false;
  const setIsOpen = context?.setIsOpen || (() => {});
  const disabled = context?.disabled || false;
  const triggerRef = context?.triggerRef;

  const handleRef = React.useCallback(
    (node) => {
      if (triggerRef) triggerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [triggerRef, forwardedRef]
  );

  return (
    <button
      ref={handleRef}
      id={id}
      type="button"
      disabled={disabled}
      onClick={() => !disabled && setIsOpen(!isOpen)}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      className={`flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-2xs transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 select-none ${className}`}
      {...props}
    >
      <span className="truncate flex-1 text-left">{children}</span>
      <ChevronDown
        size={14}
        className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
          isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
        }`}
      />
    </button>
  );
});

export function SelectValue({ placeholder = 'Pilih opsi...', children }) {
  const context = useContext(SelectContext);
  const hasValue = context?.value !== undefined && context?.value !== '' && context?.value !== null;

  if (children) return <span>{children}</span>;

  return (
    <span className={hasValue ? '' : 'text-slate-400 dark:text-slate-500'}>
      {hasValue ? String(context.value) : placeholder}
    </span>
  );
}

export const SelectContent = React.forwardRef(function SelectContent(
  { className = '', children, ...props },
  forwardedRef
) {
  const context = useContext(SelectContext);
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
    const estimatedHeight = 260;
    const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let top = openUpwards ? undefined : Math.round(rect.bottom + 4);
    let bottom = openUpwards ? Math.round(viewportHeight - rect.top + 4) : undefined;

    let left = Math.round(rect.left);
    let width = Math.round(rect.width);

    if (left + width > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - width - 8);
    }
    if (left < 8) {
      left = 8;
    }

    setCoords({
      top,
      bottom,
      left,
      width,
      minWidth: Math.max(width, 160),
      maxWidth: Math.min(viewportWidth - 16, 420),
    });
  }, [triggerRef]);

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
      role="listbox"
      style={{
        position: 'fixed',
        top: coords?.top !== undefined ? `${coords.top}px` : undefined,
        bottom: coords?.bottom !== undefined ? `${coords.bottom}px` : undefined,
        left: coords?.left !== undefined ? `${coords.left}px` : undefined,
        width: coords?.width ? `${coords.width}px` : undefined,
        minWidth: coords?.minWidth ? `${coords.minWidth}px` : undefined,
        maxWidth: coords?.maxWidth ? `${coords.maxWidth}px` : undefined,
        zIndex: 99999,
      }}
      className={`max-h-64 overflow-y-auto rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-950 dark:text-slate-50 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100 ${className}`}
      {...props}
    >
      {children}
    </div>,
    document.body
  );
});

export function SelectGroup({ children, className = '', ...props }) {
  return (
    <div role="group" className={`p-0.5 space-y-0.5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SelectLabel({ children, className = '', ...props }) {
  return (
    <div
      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export const SelectItem = React.forwardRef(function SelectItem(
  { value, children, disabled = false, className = '', ...props },
  ref
) {
  const context = useContext(SelectContext);
  const isSelected = String(context?.value) === String(value);

  const handleClick = (e) => {
    e.preventDefault();
    if (disabled) return;
    context?.onSelect(value, children);
  };

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={handleClick}
      className={`relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-colors ${
        disabled
          ? 'pointer-events-none opacity-40'
          : isSelected
          ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
      } ${className}`}
      {...props}
    >
      <span className="flex-1 truncate">{children}</span>
      {isSelected && <Check size={13} className="shrink-0 text-blue-600 dark:text-blue-400 ml-auto" />}
    </div>
  );
});

export function SelectSeparator({ className = '', ...props }) {
  return (
    <div
      role="separator"
      className={`-mx-1 my-1 h-px bg-slate-100 dark:bg-slate-800 ${className}`}
      {...props}
    />
  );
}

export function CustomSelect({
  value,
  onChange,
  onValueChange,
  options = [],
  placeholder = 'Pilih...',
  disabled = false,
  className = '',
  triggerClassName = '',
  contentClassName = '',
  ariaLabel,
  id,
}) {
  const normalizedOptions = React.useMemo(() => {
    return options.map((opt) => {
      if (opt && typeof opt === 'object' && 'value' in opt) {
        return {
          value: opt.value,
          label: opt.label !== undefined ? opt.label : String(opt.value),
          disabled: !!opt.disabled,
        };
      }
      return {
        value: opt,
        label: String(opt),
        disabled: false,
      };
    });
  }, [options]);

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const handleSelectChange = (val) => {
    if (onValueChange) onValueChange(val);
    if (onChange) onChange({ target: { value: val } });
  };

  return (
    <Select value={value} onValueChange={handleSelectChange} disabled={disabled} className={className}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={triggerClassName}>
        <span className={selectedOption ? 'truncate' : 'text-slate-400 dark:text-slate-500 truncate'}>
          {displayLabel}
        </span>
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        <SelectGroup>
          {normalizedOptions.map((opt) => (
            <SelectItem key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default Select;
