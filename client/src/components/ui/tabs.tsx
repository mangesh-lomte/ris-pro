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

/** Line variant: sits on top of a border-b. Pills variant: rounded pill selector */
export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex items-center gap-1', className)}
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

  const isActive = context.activeTab === value;
  const isPills = context.variant === 'pills';

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      id={`tab-${value}`}
      value={value}
      data-value={value}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => context.setActiveTab(value)}
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold transition-all cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#33398A] focus-visible:ring-inset',
        'disabled:pointer-events-none disabled:opacity-50',

        // Line variant (underline tab bar)
        !isPills && [
          'relative px-4 py-2.5',
          isActive
            ? 'text-[#33398A] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#33398A] after:rounded-t'
            : 'text-[#64748B] hover:text-[#15233B] hover:bg-[#F3F6FC]',
        ],

        // Pills variant (segment control)
        isPills && [
          'px-3.5 py-1.5 rounded-lg',
          isActive
            ? 'bg-white text-[#33398A] shadow-xs font-bold border border-[#DCE2EC]'
            : 'text-[#64748B] hover:text-[#15233B] hover:bg-slate-200/50',
        ],

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
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={cn('mt-4 focus-visible:outline-none', className)}
      {...props}
    >
      {children}
    </div>
  );
}
