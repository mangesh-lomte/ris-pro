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
            'flex h-9 w-full rounded-lg border border-[#DCE2EC] bg-white px-3 py-1.5 text-xs text-[#15233B]',
            'placeholder:text-[#94A3B8]',
            'focus:outline-none focus:ring-2 focus:ring-[#33398A]/20 focus:border-[#33398A]',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#F3F6FC]',
            'transition-colors',
            error && 'border-[#D92D4C] focus:ring-[#D92D4C]/20 focus:border-[#D92D4C]',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-[#D92D4C] font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
