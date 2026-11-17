import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info' | 'cyan' | 'neutral';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default:     'bg-slate-900 text-white',
    secondary:   'bg-[#f0f4f1] text-slate-700 border border-slate-200/60',
    outline:     'text-slate-800 border border-[#dce6e0] bg-white',
    neutral:     'bg-[#f4f7f5] text-slate-600 border border-slate-200/60',
    success:     'bg-emerald-100/80 text-emerald-800 border border-emerald-200/60',
    warning:     'bg-amber-100 text-amber-800 border border-amber-200/60',
    destructive: 'bg-rose-100 text-rose-800 border border-rose-200/60 font-bold',
    info:        'bg-sky-100 text-sky-800 border border-sky-200/60',
    cyan:        'bg-indigo-100 text-indigo-800 border border-indigo-200/60',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors leading-none',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
