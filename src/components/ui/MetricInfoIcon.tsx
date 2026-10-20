'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info, X, Calculator, Database, AlertCircle, HelpCircle } from 'lucide-react';
import { getMetricExplanation } from '@/data/metricExplanations';

const POPOVER_WIDTH = 320; // matches max-w below; used only to pick left/right placement
const VIEWPORT_MARGIN = 12;

export default function MetricInfoIcon({
  infoKey,
  overrideInfo = null,
  placement = 'auto',
  className = '',
  size = 14,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const info = overrideInfo || getMetricExplanation(infoKey);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Position is computed against the viewport (fixed), independent of any
  // ancestor's overflow/transform - this is what a plain absolute-positioned
  // popover can't guarantee, and was clipping this tooltip at card/body edges
  // on narrow (mobile) viewports.
  const computeCoords = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const preferLeft = placement === 'bottom-left'
      || (placement === 'auto' && rect.left + POPOVER_WIDTH + VIEWPORT_MARGIN > vw);

    let left = preferLeft ? rect.left : rect.right - POPOVER_WIDTH;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), vw - POPOVER_WIDTH - VIEWPORT_MARGIN);

    const top = Math.min(rect.bottom + 8, vh - VIEWPORT_MARGIN);

    return { top, left, triggerBottom: rect.bottom };
  }, [placement]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setCoords(computeCoords());

    const reposition = () => setCoords(computeCoords());
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen, computeCoords]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target)
        && popoverRef.current && !popoverRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setIsOpen(false), 180);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsOpen((prev) => !prev);
  };

  if (!info) return null;

  return (
    <span
      ref={triggerRef}
      data-popover-open={isOpen ? 'true' : 'false'}
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Penjelasan ${info.title}`}
        aria-expanded={isOpen}
        // The 32px hit area keeps the small glyph tappable; the negative margin keeps it from pushing the title apart.
        className={`-m-1.5 inline-flex size-8 items-center justify-center rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isOpen
            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
            : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Info size={size} strokeWidth={2.2} />
      </button>

      {mounted && isOpen && coords && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={info.title}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="fixed w-80 max-w-[calc(100vw-24px)] max-h-[min(480px,80vh)] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-3.5 sm:p-4 z-[100] text-left animate-in fade-in zoom-in-95 duration-150 select-text"
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="size-6 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <HelpCircle size={14} />
              </span>
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 tracking-tight">
                {info.title}
              </h4>
              {info.badge && (
                <span className="text-[10px] tabular-nums font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                  {info.badge}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex size-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Tutup informasi"
            >
              <X size={13} />
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            {info.definition && (
              <div>
                {(info.formula || info.source || info.varianceReason) && (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Artinya</span>
                )}
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                  {info.definition}
                </p>
              </div>
            )}

            {info.formula && (
              <div>
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1 mb-1">
                  <Calculator size={11} aria-hidden="true" />
                  Cara hitung
                </span>
                <div className="bg-blue-50/80 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl p-2 text-[11px] text-blue-900 dark:text-blue-200 leading-snug">
                  {info.formula}
                </div>
              </div>
            )}

            {info.source && (
              <div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1 mb-1">
                  <Database size={11} aria-hidden="true" />
                  Sumber data
                </span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  {info.source}
                </p>
              </div>
            )}

            {info.varianceReason && (
              <div>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1 mb-1">
                  <AlertCircle size={11} aria-hidden="true" />
                  Kenapa angkanya bisa beda
                </span>
                <div className="bg-amber-50/70 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl p-2 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
                  {info.varianceReason}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
