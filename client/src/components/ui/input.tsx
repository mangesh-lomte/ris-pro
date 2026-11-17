import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'flex h-9 w-full rounded-full border border-slate-200/80 bg-[#f4f7f5] hover:bg-[#edf2ee] focus:bg-white px-3.5 py-1.5 text-xs text-slate-800',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#f4f7f5]',
            'transition-colors',
            error && 'border-rose-400 focus:ring-rose-500',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p role="alert" className="mt-1 text-[11px] text-rose-600 font-bold px-2">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
