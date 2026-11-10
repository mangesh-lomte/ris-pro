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
      default:     'bg-[#33398A] text-white hover:bg-[#282D6E] shadow-xs active:scale-[0.99]',
      secondary:   'bg-[#F3F6FC] text-[#15233B] hover:bg-[#E8EDF9] border border-[#DCE2EC]',
      outline:     'border border-[#DCE2EC] bg-white text-[#15233B] hover:bg-[#F3F6FC] shadow-xs',
      ghost:       'text-[#64748B] hover:bg-[#F3F6FC] hover:text-[#15233B]',
      destructive: 'bg-[#D92D4C] text-white hover:bg-[#B91C36] shadow-xs',
      clinical:    'bg-[#33398A] text-white hover:bg-[#282D6E] shadow-xs active:scale-[0.99]',
    };

    const sizes = {
      sm:   'h-7 px-3 text-xs rounded-md',
      md:   'h-8 px-3.5 text-xs rounded-lg font-semibold',
      lg:   'h-10 px-5 text-sm rounded-lg font-semibold',
      icon: 'h-8 w-8 rounded-lg justify-center p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#33398A] focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
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
