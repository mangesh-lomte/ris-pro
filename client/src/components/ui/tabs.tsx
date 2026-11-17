import * as React from 'react';
import { cn } from '../../lib/utils';

type TabsVariant = 'line' | 'pills';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (id: string) => void;
  variant: TabsVariant;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
  variant = 'line',
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  children: React.ReactNode;
  className?: string;
  variant?: TabsVariant;
}) {
  const [internalTab, setInternalTab] = React.useState(defaultValue || '');
  const activeTab = value !== undefined ? value : internalTab;

  const setActiveTab = (newTab: string) => {
    if (value === undefined) setInternalTab(newTab);
    onValueChange?.(newTab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(TabsContext);
  const isPills = ctx?.variant === 'pills';

  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1',
        isPills ? 'bg-[#f0f4f1] p-1 rounded-full' : 'border-b border-slate-200 w-full',
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const { activeTab, setActiveTab, variant } = context;
  const isSelected = activeTab === value;

  if (variant === 'pills') {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={() => setActiveTab(value)}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900',
          isSelected
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={() => setActiveTab(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900',
        isSelected
          ? 'border-slate-900 text-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={cn('mt-4 focus-visible:outline-none animate-in fade-in-50 duration-150', className)}
      {...props}
    >
      {children}
    </div>
  );
}
