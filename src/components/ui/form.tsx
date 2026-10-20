'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const FormItemContext = React.createContext({});

export function Form({ children, ...props }) {
  return <form {...props}>{children}</form>;
}

export function FormField({ name, render, ...props }) {
  return render({ field: { name, ...props } });
}

export function useFormField() {
  const itemContext = React.useContext(FormItemContext);
  return itemContext || {};
}

export const FormItem = React.forwardRef(function FormItem(
  { className = '', ...props },
  ref
) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn('space-y-1.5', className)} {...props} />
    </FormItemContext.Provider>
  );
});

export const FormLabel = React.forwardRef(function FormLabel(
  { className = '', error, ...props },
  ref
) {
  const { id } = useFormField();

  return (
    <label
      ref={ref}
      htmlFor={id}
      className={cn(
        'text-xs font-semibold leading-none text-slate-700 dark:text-slate-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        error && 'text-rose-500 dark:text-rose-400',
        className
      )}
      {...props}
    />
  );
});

export const FormControl = React.forwardRef(function FormControl(
  { ...props },
  ref
) {
  const { id } = useFormField();
  return <div ref={ref} id={id} {...props} />;
});

export const FormDescription = React.forwardRef(function FormDescription(
  { className = '', ...props },
  ref
) {
  return (
    <p
      ref={ref}
      className={cn('text-[11px] text-slate-500 dark:text-slate-400', className)}
      {...props}
    />
  );
});

export const FormMessage = React.forwardRef(function FormMessage(
  { className = '', children, ...props },
  ref
) {
  if (!children) return null;

  return (
    <p
      ref={ref}
      className={cn('text-[11px] font-medium text-rose-500 dark:text-rose-400 animate-in fade-in-0 duration-100', className)}
      {...props}
    >
      {children}
    </p>
  );
});

export default Form;
