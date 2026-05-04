import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Nexus: Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path || 'unknown path'}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] p-10 max-w-xl w-full text-center shadow-2xl shadow-red-500/10">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-8 mx-auto border border-red-500/20">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            
            <h2 className="text-2xl font-black italic tracking-tighter mb-4 text-white">System <span className="text-red-500">Interruption</span></h2>
            
            <div className="bg-black/40 rounded-2xl p-6 mb-8 text-left border border-white/5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Error Details</p>
              <p className="text-sm text-slate-300 font-mono break-words leading-relaxed">
                {errorMessage}
              </p>
              {isFirestoreError && (
                <p className="text-[10px] text-red-400 mt-4 italic font-bold">
                  Security rules or configuration might be preventing this action.
                </p>
              )}
            </div>

            <button 
              onClick={this.handleReset}
              className="w-full py-4 bg-white text-black hover:bg-slate-200 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <RotateCcw size={18} />
              Restart Nexus Justice
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
