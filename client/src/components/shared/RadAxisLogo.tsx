interface RadAxisLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDescriptor?: boolean;
  fullImage?: boolean;
  className?: string;
}

export function RadAxisLogo({
  variant = 'dark',
  size = 'md',
  showDescriptor = false,
  fullImage = false,
  className = '',
}: RadAxisLogoProps) {
  const isLight = variant === 'light';

  const iconSizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
    xl: 'h-14 w-14',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  const badgeSizes = {
    sm: 'text-[9px] px-1 py-0.2',
    md: 'text-[10px] px-1.5 py-0.5',
    lg: 'text-xs px-2 py-0.5',
    xl: 'text-xs px-2.5 py-1',
  };

  if (fullImage) {
    const fullSizes = {
      sm: 'h-8',
      md: 'h-10',
      lg: 'h-14',
      xl: 'h-20',
    };
    return (
      <div className={`flex items-center select-none ${className}`}>
        <img
          src="/radaxis-logo.png"
          alt="RadAxis — Radiology Information System"
          className={`${fullSizes[size]} object-contain filter drop-shadow-sm`}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Approved Precision Radiology Symbol */}
      <div
        className={`relative flex items-center justify-center shrink-0 rounded-lg overflow-hidden transition-transform ${iconSizes[size]} ${
          isLight
            ? 'bg-[#0b1329]/80 ring-1 ring-white/15 shadow-sm'
            : 'bg-[#0f172a] shadow-xs'
        }`}
      >
        <img
          src="/radaxis-symbol.png"
          alt="RadAxis"
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            // Fallback to high-contrast SVG if image fails to load
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      </div>

      {/* Brand Wordmark & Descriptor */}
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-extrabold tracking-tight ${textSizes[size]} ${
              isLight ? 'text-white' : 'text-[#15233B]'
            }`}
          >
            Rad<span className={isLight ? 'text-[#38BDF8]' : 'text-[#33398A]'}>Axis</span>
          </span>
          <span
            className={`font-bold tracking-wider rounded font-mono ${badgeSizes[size]} ${
              isLight
                ? 'bg-blue-500/20 text-sky-200 border border-sky-400/30'
                : 'bg-[#F3F6FC] text-[#33398A] border border-[#DCE2EC]'
            }`}
          >
            RIS
          </span>
        </div>
        {showDescriptor && (
          <span
            className={`text-[10px] font-medium tracking-wider uppercase mt-1 ${
              isLight ? 'text-slate-400' : 'text-[#64748B]'
            }`}
          >
            Radiology Information System
          </span>
        )}
      </div>
    </div>
  );
}
export default RadAxisLogo;
