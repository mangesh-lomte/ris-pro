import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info';
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  const variants = {
    default: 'bg-slate-50 border-slate-200 text-slate-800',
    destructive: 'bg-rose-50 border-rose-200 text-rose-800 [&>svg]:text-rose-600',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 [&>svg]:text-emerald-600',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 [&>svg]:text-amber-600',
    info: 'bg-cyan-50 border-cyan-200 text-cyan-800 [&>svg]:text-cyan-600',
  };

  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-xs leading-relaxed opacity-90', className)} {...props} />;
}
