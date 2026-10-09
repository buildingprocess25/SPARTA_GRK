'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Info, X, Calculator, Database, AlertCircle, HelpCircle } from 'lucide-react';
import { getMetricExplanation } from '@/data/metricExplanations';

export default function MetricInfoIcon({
  infoKey,
  overrideInfo = null,
  placement = 'auto',
  className = '',
  size = 14,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [effectivePlacement, setEffectivePlacement] = useState('bottom-right');
  const [adjustedStyle, setAdjustedStyle] = useState({});
  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const info = overrideInfo || getMetricExplanation(infoKey);

  // Hitung penempatan terbaik (kiri vs kanan) berdasarkan ruang nyata di kontainer utama
  const calculatePlacement = useCallback(() => {
    if (!containerRef.current) return 'bottom-right';

    const trigger = containerRef.current.getBoundingClientRect();
    const mainEl = containerRef.current.closest('main') || document.querySelector('main');
    const mainRect = mainEl
      ? mainEl.getBoundingClientRect()
      : { left: 16, right: window.innerWidth - 16 };

    const minAllowedLeft = Math.max(16, mainRect.left + 8);
    const maxAllowedRight = Math.min(window.innerWidth - 16, mainRect.right - 8);

    const popoverWidth = 352;
    const spaceToLeft = trigger.right - minAllowedLeft;
    const spaceToRight = maxAllowedRight - trigger.left;

    if (placement === 'bottom-left') return 'bottom-left';
    if (placement === 'bottom-right') return 'bottom-right';

    // Auto placement:
    // Jika card/icon berada di sisi kiri dan ruang ke kiri < lebar popover,
    // maka wajib buka ke arah kanan (bottom-left) agar tidak tertabrak/terpotong sidebar
    if (spaceToLeft < popoverWidth) {
      return 'bottom-left';
    }
    // Jika di sisi kanan dan ruang ke kanan < lebar popover, buka ke arah kiri (bottom-right)
    if (spaceToRight < popoverWidth) {
      return 'bottom-right';
    }

    return 'bottom-right';
  }, [placement]);

  // Saat dibuka atau di-resize, sesuaikan placement dan clamp batas agar tidak terpotong
  useEffect(() => {
    if (!isOpen) {
      setAdjustedStyle({});
      return;
    }

    const nextPlacement = calculatePlacement();
    setEffectivePlacement(nextPlacement);

    const checkBoundaries = () => {
      if (!popoverRef.current || !containerRef.current) return;
      const rect = popoverRef.current.getBoundingClientRect();
      const mainEl = containerRef.current.closest('main') || document.querySelector('main');
      const mainRect = mainEl
        ? mainEl.getBoundingClientRect()
        : { left: 16, right: window.innerWidth - 16 };

      const minAllowedLeft = Math.max(16, mainRect.left + 8);
      const maxAllowedRight = Math.min(window.innerWidth - 16, mainRect.right - 8);

      let shiftX = 0;
      if (rect.left < minAllowedLeft) {
        shiftX = minAllowedLeft - rect.left;
      } else if (rect.right > maxAllowedRight) {
        shiftX = maxAllowedRight - rect.right;
      }

      setAdjustedStyle(shiftX !== 0 ? { transform: `translateX(${shiftX}px)` } : {});
    };

    const animId = requestAnimationFrame(checkBoundaries);
    window.addEventListener('resize', checkBoundaries);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', checkBoundaries);
    };
  }, [isOpen, calculatePlacement]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsOpen((prev) => !prev);
  };

  if (!info) return null;

  const isLeft = effectivePlacement === 'bottom-left';
  const placementClass = isLeft ? 'left-0 top-full' : 'right-0 top-full';
  const transformOrigin = isLeft ? 'top left' : 'top right';

  return (
    <div
      ref={containerRef}
      data-popover-open={isOpen ? 'true' : 'false'}
      className={`relative inline-flex items-center justify-center ${isOpen ? 'z-[100]' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Informasi metrik ${info.title}`}
        aria-expanded={isOpen}
        className={`p-1 rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isOpen
            ? 'bg-blue-100 text-blue-700 shadow-xs'
            : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
        }`}
        title={`Klik / hover untuk melihat rumus & sumber data ${info.title}`}
      >
        <Info size={size} strokeWidth={2.2} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={info.title}
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${placementClass} mt-2 w-72 sm:w-80 max-w-[92vw] max-h-[min(480px,80vh)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl p-3.5 sm:p-4 z-[100] text-left animate-in fade-in zoom-in-95 duration-150 select-text`}
          style={{ transformOrigin, ...adjustedStyle }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="size-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <HelpCircle size={14} />
              </span>
              <h4 className="font-bold text-xs text-slate-900 tracking-tight">
                {info.title}
              </h4>
              {info.badge && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                  {info.badge}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors shrink-0"
              title="Tutup informasi"
            >
              <X size={13} />
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            {/* 1. Definisi */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                1. Definisi Metrik
              </span>
              <p className="text-slate-700 leading-relaxed text-[11px]">
                {info.definition}
              </p>
            </div>

            {/* 2. Rumus Perhitungan */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1 mb-1">
                <Calculator size={11} />
                2. Rumus Perhitungan
              </span>
              <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-2 font-mono text-[11px] text-blue-900 leading-snug">
                {info.formula}
              </div>
            </div>

            {/* 3. Sumber Data */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                <Database size={11} />
                3. Sumber Data
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {info.source}
              </p>
            </div>

            {/* 4. Kenapa Angka Bisa Berbeda? */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1 mb-1">
                <AlertCircle size={11} />
                4. Alasan Angka Bisa Berbeda
              </span>
              <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-2 text-amber-900 text-[11px] leading-relaxed">
                {info.varianceReason}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
