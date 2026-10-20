'use client';

import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 outline-none select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950',
  {
    variants: {
      variant: {
        default:
          'bg-[#005697] hover:bg-[#004880] text-white shadow-2xs',
        secondary:
          'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 shadow-2xs',
        outline:
          'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 shadow-2xs',
        ghost:
          'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100',
        destructive:
          'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs',
        danger:
          'border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 shadow-2xs',
        success:
          'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs',
        link:
          'text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 text-xs rounded-xl gap-2',
        sm: 'h-8 px-3 text-xs rounded-xl gap-1.5',
        lg: 'h-10 px-5 text-sm rounded-xl gap-2.5',
        icon: 'size-8 rounded-lg p-0',
        'icon-sm': 'size-7 rounded-lg p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export const Button = React.forwardRef<React.ElementRef<'button'>, React.ComponentPropsWithoutRef<'button'> & { className?: string; variant?: string; size?: string; asChild?: boolean; children?: any; type?: string; [key: string]: any }>(function Button(
  {
    className = '',
    variant = 'default',
    size = 'default',
    asChild = false,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref,
      className: cn(buttonVariants({ variant, size, className }), (children.props as { className?: string }).className),
      ...props,
    });
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
