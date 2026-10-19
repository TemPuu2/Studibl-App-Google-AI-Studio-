import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Robust, visually polished React Error Boundary with user recovery options.
 * Captures asynchronous render exceptions or state corruption gracefully,
 * preventing a complete application crash.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled exception:', error, errorInfo);
  }

  private handleRetry = () => {
    // Clear state or local storage if needed, then trigger reset action
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
    // Reload state if necessary
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#090909] select-none animate-in fade-in duration-300 min-h-[400px]">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500/15 blur-xl rounded-full" />
            <div className="relative w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400">
              <AlertTriangle size={28} />
            </div>
          </div>
          
          <h2 className="text-lg font-black text-white/95 mb-2 tracking-tight">
            {this.props.fallbackTitle || 'A Cognitive Fault Occurred'}
          </h2>
          
          <p className="text-zinc-400 text-xs max-w-sm leading-relaxed mb-6 font-medium">
            We encountered an exception while retrieving this view. This may be due to cached data discrepancies or an unresolved route parameter.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-primary text-black hover:opacity-90 transition-all flex items-center gap-2 justify-center"
            >
              <RefreshCw size={12} /> Clear Cache & Retry
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-white/5 text-white/60 hover:text-white transition-all border border-white/5 flex items-center gap-2 justify-center"
            >
              <Home size={12} /> Return Home
            </button>
          </div>

          {this.state.error && (
            <div className="mt-8 text-left w-full max-w-md">
              <p className="text-[8px] font-mono font-bold text-white/20 uppercase tracking-widest mb-1.5 ml-1">Debug Stack Trace</p>
              <pre className="p-3 bg-red-500/[0.02] border border-red-500/10 rounded-xl overflow-x-auto text-[8px] text-red-400/80 font-mono select-text max-h-32 scrollbar-hide">
                {this.state.error.toString()}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
