interface RadAxisLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDescriptor?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export function RadAxisLogo({
  variant = 'dark',
  size = 'md',
  showDescriptor = false,
  iconOnly = false,
  className = '',
}: RadAxisLogoProps) {
  const isLight = variant === 'light';

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm font-extrabold',
    lg: 'text-base font-extrabold',
    xl: 'text-lg font-extrabold',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Brand Icon */}
      <div className={`${iconSizes[size]} shrink-0 flex items-center justify-center`}>
        <img
          src="/radaxis-symbol.png"
          alt="RadAxis"
          className="w-full h-full object-contain drop-shadow-xs"
        />
      </div>

      {!iconOnly && (
        <div className="flex flex-col leading-tight">
          <div className={`flex items-center gap-1.5 ${textSizes[size]} tracking-tight ${isLight ? 'text-white' : 'text-slate-900'}`}>
            <span>RADAXIS</span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded-full">
              RIS
            </span>
          </div>
          {showDescriptor && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium">v2.4.1 Production</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
