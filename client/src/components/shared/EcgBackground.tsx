export function EcgBackground() {
  // Real Lead II ECG waveform across 1440px width (4 cycles of 360px each)
  const ecgPath = `
    M 0 60
    L 80 60
    Q 95 60 100 52
    Q 105 44 110 52
    Q 115 60 120 60
    L 145 60
    L 155 68
    L 168 12
    L 182 88
    L 194 60
    L 215 60
    Q 230 60 238 48
    Q 246 36 254 48
    Q 262 60 270 60
    L 440 60
    Q 455 60 460 52
    Q 465 44 470 52
    Q 475 60 480 60
    L 505 60
    L 515 68
    L 528 12
    L 542 88
    L 554 60
    L 575 60
    Q 590 60 598 48
    Q 606 36 614 48
    Q 622 60 630 60
    L 800 60
    Q 815 60 820 52
    Q 825 44 830 52
    Q 835 60 840 60
    L 865 60
    L 875 68
    L 888 12
    L 902 88
    L 914 60
    L 935 60
    Q 950 60 958 48
    Q 966 36 974 48
    Q 982 60 990 60
    L 1160 60
    Q 1175 60 1180 52
    Q 1185 44 1190 52
    Q 1195 60 1200 60
    L 1225 60
    L 1235 68
    L 1248 12
    L 1262 88
    L 1274 60
    L 1295 60
    Q 1310 60 1318 48
    Q 1326 36 1334 48
    Q 1342 60 1350 60
    L 1440 60
  `;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" aria-hidden="true">
      {/* Background radial gradients for serene depth */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-gradient-to-b from-emerald-200/40 via-emerald-100/20 to-transparent blur-3xl rounded-full" />
      <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-emerald-100/50 blur-3xl rounded-full" />
      <div className="absolute bottom-10 -right-28 w-[450px] h-[450px] bg-amber-100/40 blur-3xl rounded-full" />

      {/* Medical Electrocardiogram Grid Pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-70" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* 20px fine medical grid */}
          <pattern id="ecg-small-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#10b981" strokeWidth="0.5" strokeOpacity="0.09" />
          </pattern>
          {/* 100px major medical grid */}
          <pattern id="ecg-grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#ecg-small-grid)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#10b981" strokeWidth="1" strokeOpacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ecg-grid)" />
      </svg>

      {/* Subtle Clinical Calibration Annotations on Canvas */}
      <div className="hidden lg:flex justify-between items-center absolute top-6 left-8 right-8 text-[10px] font-mono text-emerald-800/40 tracking-wider">
        <span>LEAD II • SENSITIVITY 1.0 • ECG SYNC 100%</span>
        <span>HR: 72 BPM • ST-SEG: 0.02mV • QTc: 412ms</span>
      </div>
      <div className="hidden lg:flex justify-between items-center absolute bottom-6 left-8 right-8 text-[10px] font-mono text-emerald-800/40 tracking-wider">
        <span>CAL: 1mV / 10mm • SWEEP: 25mm/s</span>
        <span>DICOM-ECG &amp; MODALITY WORKLIST READY</span>
      </div>

      {/* Primary Animated Heartbeat Waveform (Center Section) */}
      <div className="absolute top-[26%] left-0 right-0 w-full flex items-center justify-center opacity-90">
        <svg
          viewBox="0 0 1440 120"
          className="w-full h-24 md:h-28 text-emerald-500 overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="ecg-glow-main" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Linear sweep gradient for live heartbeat sweep effect */}
            <linearGradient id="ecg-pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="42%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="48%" stopColor="#059669" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#34d399" stopOpacity="1" />
              <stop offset="52%" stopColor="#059669" stopOpacity="0.85" />
              <stop offset="58%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
            </linearGradient>

            {/* Mask to softly fade edges left and right */}
            <linearGradient id="edge-fade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#000" stopOpacity="0" />
              <stop offset="12%" stopColor="#fff" stopOpacity="1" />
              <stop offset="88%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </linearGradient>

            <mask id="waveform-mask">
              <rect width="1440" height="120" fill="url(#edge-fade)" />
            </mask>
          </defs>

          <g mask="url(#waveform-mask)">
            {/* Ambient baseline pulse trace */}
            <path
              d={ecgPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeOpacity="0.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Glowing moving pulse trace */}
            <path
              d={ecgPath}
              fill="none"
              stroke="url(#ecg-pulse-gradient)"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#ecg-glow-main)"
              className="animate-pulse"
            />
          </g>
        </svg>
      </div>

      {/* Secondary Ambient Lower Waveform */}
      <div className="absolute bottom-[16%] left-0 right-0 w-full flex items-center justify-center opacity-45">
        <svg
          viewBox="0 0 1440 120"
          className="w-full h-16 md:h-20 text-emerald-400 overflow-visible"
          preserveAspectRatio="none"
        >
          <g mask="url(#waveform-mask)">
            <path
              d={ecgPath}
              fill="none"
              stroke="#059669"
              strokeWidth="1.5"
              strokeOpacity="0.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
