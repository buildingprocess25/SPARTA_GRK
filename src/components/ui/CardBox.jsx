import React from 'react';

export default function CardBox({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 lg:p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

