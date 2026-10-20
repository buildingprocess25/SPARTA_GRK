import React from 'react';

export default function ChartWrapper({ title, icon: Icon, children }) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none p-[20px] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] dark:hover:shadow-none">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"><Icon size={16} /></div>}
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      </div>
      <div className="flex-1 w-full min-h-[300px]">
        {children}
      </div>
    </div>
  );
}
