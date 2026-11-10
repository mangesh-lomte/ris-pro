import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { searchDashboardGlobal } from '../../services/dashboardService';
import { DashboardSearchResultItem } from '../../types';
import { Link } from 'react-router-dom';

export function DashboardSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DashboardSearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await searchDashboardGlobal(query.trim());
        if (!cancelled) {
          setResults(data);
          setIsOpen(true);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setError('Unable to search clinical records.');
          setIsOpen(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, retryNonce]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patient, phone, MRN, or accession..."
          className="w-full pl-9 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#227DA5]/20 focus:border-[#227DA5] shadow-2xs transition-all"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#174A70] animate-spin" />
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
          {error ? (
            <div role="alert" className="p-3.5 text-center text-xs text-rose-700">
              <div className="flex items-center justify-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {error}
              </div>
              <button
                type="button"
                onClick={() => setRetryNonce((value) => value + 1)}
                className="mt-2 inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 font-semibold hover:bg-rose-100"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="p-3.5 text-center text-xs text-slate-500">
              No matching patients or accession numbers found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Matching Clinical Records ({results.length})
              </div>
              {results.map((item, idx) => (
                <Link
                  key={idx}
                  to={item.targetUrl}
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 hover:bg-slate-50/80 flex items-center justify-between gap-3 transition-colors block"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900">{item.patientName}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                        {item.patientId}
                      </span>
                      {item.phone && (
                        <span className="text-[10px] text-slate-400">({item.phone})</span>
                      )}
                    </div>
                    {item.accessionNumber && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono font-medium text-[#174A70]">{item.accessionNumber}</span>
                        {item.examinationName && ` • ${item.examinationName}`}
                        {item.status && ` • ${item.status}`}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

