import * as React from 'react';
import { cn } from '../../lib/utils';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-scroll-container thin-scroll relative w-full overflow-x-auto rounded-2xl border border-[#dce6e0] bg-white shadow-soft">
      <table className={cn('w-full caption-bottom text-xs text-left border-collapse', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b border-slate-100 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none', className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-slate-100 font-medium text-slate-700', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-slate-50/80 data-[state=selected]:bg-emerald-50/40 group',
        className
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'py-3 px-4 text-left align-middle font-bold text-slate-400 text-[11px] uppercase tracking-wider whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'py-3 px-4 align-middle text-xs text-slate-700 [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption className={cn('mt-4 text-xs text-slate-400', className)} {...props} />
  );
}
