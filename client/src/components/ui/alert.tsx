import * as React from 'react';
import { cn } from '../../lib/utils';

export function Alert({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'destructive' | 'warning' | 'success' | 'info';
}) {
  const variants = {
    default:     'bg-[#F3F6FC] border-[#DCE2EC] text-[#15233B]',
    destructive: 'bg-rose-50/80 border-rose-200 text-[#D92D4C]',
    warning:     'bg-amber-50/80 border-amber-200 text-[#D97706]',
    success:     'bg-emerald-50/80 border-emerald-200 text-[#15966A]',
    info:        'bg-blue-50/80 border-blue-200 text-[#2563B8]',
  };
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-xl border px-4 py-3 text-xs shadow-2xs',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('font-bold leading-none tracking-tight mb-1 text-sm', className)} {...props} />
  );
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs opacity-90 leading-relaxed', className)} {...props} />;
}
