import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RadAxis UI ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 bg-white border border-rose-200 rounded-xl shadow-xs text-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-sm font-bold text-slate-900">
                {this.props.fallbackTitle || 'Clinical Workspace Notice'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                A transient rendering error occurred in this clinical view. Your patient session and backend records remain completely intact.
              </p>
              {this.state.error && (
                <pre className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-500 overflow-x-auto max-h-24">
                  {this.state.error.message}
                </pre>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={this.handleReset}
                  className="text-xs bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.location.href = '/dashboard';
                  }}
                  className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
                >
                  <Home className="w-3.5 h-3.5" />
                  Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
