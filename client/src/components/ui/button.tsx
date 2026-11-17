import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'clinical';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const variants = {
      default:     'bg-slate-900 text-white hover:bg-slate-800 shadow-xs active:bg-slate-950',
      secondary:   'bg-[#f0f4f1] text-slate-800 hover:bg-slate-200 border border-transparent',
      outline:     'border border-[#dce6e0] bg-white text-slate-800 hover:bg-[#f4f8f5] shadow-xs',
      ghost:       'text-slate-600 hover:bg-[#f0f4f1] hover:text-slate-900',
      destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs',
      clinical:    'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs',
    };

    const sizes = {
      sm:   'h-7 px-3 text-xs rounded-full font-medium',
      md:   'h-8 px-4 text-xs rounded-full font-bold',
      lg:   'h-9 px-5 text-sm rounded-full font-bold',
      icon: 'h-8 w-8 rounded-full justify-center p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-1.5">
            <svg
              className="animate-spin h-3.5 w-3.5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Processing…</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
