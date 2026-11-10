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
        className="fixed inset-0 bg-[#172554]/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal Card */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full rounded-2xl bg-white shadow-2xl border border-[#DCE2EC] z-10 my-8 overflow-hidden animate-in zoom-in-95 duration-150 outline-none',
          maxWidthClasses[maxWidth],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  children,
  className,
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-[#DCE2EC] bg-[#F3F6FC]/70 px-6 py-4',
        className
      )}
    >
      <div className="space-y-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="rounded-lg p-1.5 text-[#64748B] hover:bg-slate-200/60 hover:text-[#15233B] transition"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('text-base font-bold text-[#15233B] leading-none', className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('text-xs text-[#64748B] mt-1', className)}>
      {children}
    </p>
  );
}

export function DialogContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('p-6 max-h-[75vh] overflow-y-auto thin-scroll', className)}>{children}</div>;
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 border-t border-[#DCE2EC] bg-[#F3F6FC]/50 px-6 py-3.5',
        className
      )}
    >
      {children}
    </div>
  );
}
