'use client';

import * as React from 'react';

export function Card({
  className = '',
  size = 'default',
  children,
  ...props
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={`group/card rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 lg:p-5 shadow-2xs dark:shadow-none transition-all duration-200 print:break-inside-avoid ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}) {
  return (
    <div
      data-slot="card-header"
      className={`flex flex-col space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800/80 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = '',
  children,
  ...props
}) {
  return (
    <h3
      data-slot="card-title"
      className={`text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = '',
  children,
  ...props
}) {
  return (
    <p
      data-slot="card-description"
      className={`text-xs text-slate-500 dark:text-slate-400 leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardAction({
  className = '',
  children,
  ...props
}) {
  return (
    <div
      data-slot="card-action"
      className={`flex items-center gap-2 self-start sm:self-auto shrink-0 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({
  className = '',
  children,
  ...props
}) {
  return (
    <div
      data-slot="card-content"
      className={`pt-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  className = '',
  children,
  ...props
}) {
  return (
    <div
      data-slot="card-footer"
      className={`flex items-center pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
