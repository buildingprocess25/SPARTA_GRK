'use client';

/**
 * Reusable pill/segmented switcher (template originating from the Scope 1
 * Genset/Kendaraan toggle). Use this instead of hand-rolling a new tab-pill
 * group so every sub-view switcher in the app looks and behaves the same.
 *
 * options: [{ value, label, icon?: LucideIcon, activeIconClassName?: string,
 *              inactiveIconClassName?: string, hidden?: boolean }]
 */
export default function SegmentedTabs({ value, onChange, options, className = '', fullWidthOnMobile = true }) {
  const visibleOptions = options.filter(opt => !opt.hidden);

  return (
    <div className={`inline-flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl gap-1 ${fullWidthOnMobile ? 'w-full sm:w-auto' : ''} ${className}`}>
      {visibleOptions.map(opt => {
        const isActive = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.98] ${fullWidthOnMobile ? 'flex-1 sm:flex-initial' : ''} ${
              isActive
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {Icon && (
              <Icon
                size={14}
                className={isActive
                  ? (opt.activeIconClassName || 'text-rose-500 dark:text-rose-400')
                  : (opt.inactiveIconClassName || 'text-slate-500 dark:text-slate-400')}
              />
            )}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
