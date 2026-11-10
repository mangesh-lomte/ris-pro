import * as React from 'react';
import { cn } from '../../lib/utils';

/** Wrap in a div that allows horizontal scroll only when the table overflows — page-level overflow stays clean */
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-scroll-container thin-scroll relative w-full overflow-x-auto rounded-lg border border-[#DCE2EC] bg-white shadow-2xs">
      <table className={cn('w-full caption-bottom text-xs', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b border-[#DCE2EC] bg-[#F3F6FC]', className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0 divide-y divide-[#F1F5F9]', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-[#F8FAFC] data-[state=selected]:bg-[#E8EDF9]',
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
        'h-9 px-3.5 text-left align-middle font-bold text-[#64748B] text-[11px] uppercase tracking-wider whitespace-nowrap [&:has([role=checkbox])]:pr-0',
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
        'px-3.5 py-2.5 align-middle text-xs text-[#15233B] [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
}
