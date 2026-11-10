import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info' | 'cyan';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default:     'bg-[#33398A] text-white',
    secondary:   'bg-[#F3F6FC] text-[#64748B] border border-[#DCE2EC]',
    outline:     'text-[#15233B] border border-[#DCE2EC] bg-white',
    success:     'bg-emerald-50 text-[#15966A] border border-emerald-200',
    warning:     'bg-amber-50 text-[#D97706] border border-amber-200',
    destructive: 'bg-rose-50 text-[#D92D4C] border border-rose-200',
    info:        'bg-blue-50 text-[#2563B8] border border-blue-200',
    cyan:        'bg-sky-50 text-[#0284C7] border border-sky-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide transition-colors leading-none',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
