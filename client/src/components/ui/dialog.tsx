import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
}

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  maxWidth = 'lg',
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    if (open) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      dialogRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    full: 'max-w-[96vw]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative z-50 w-full overflow-hidden rounded-3xl border border-[#dce6e0] bg-white shadow-soft transition-all duration-200 outline-none',
          maxWidthClasses[maxWidth],
          className
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100/80 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export function DialogHeader({
  className,
  onClose,
  ...props
}: DialogHeaderProps) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-5 border-b border-slate-100 bg-[#f8faf9]', className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-base sm:text-lg font-extrabold tracking-tight text-slate-900', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-xs text-slate-500 font-medium', className)}
      {...props}
    />
  );
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export function DialogContent({
  className,
  onClose,
  ...props
}: DialogContentProps) {
  return <div className={cn('p-5 overflow-y-auto max-h-[75vh]', className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-[#f8faf9] rounded-b-3xl', className)}
      {...props}
    />
  );
}
