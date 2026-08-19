"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { LuAlertTriangle, LuRotateCcw, LuChevronDown, LuChevronUp, LuTerminal } from "react-icons/lu";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export default class VStudioErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("VStudioErrorBoundary caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative flex h-full w-full flex-col items-center justify-center bg-[var(--bg-canvas,#0f172a)] p-6 text-[var(--text-main,#f8fafc)]">
          <div className="flex max-w-md flex-col items-center rounded-2xl border border-red-500/30 bg-slate-900/90 p-6 text-center shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400 ring-8 ring-red-500/5">
              <LuAlertTriangle className="h-7 w-7" />
            </div>

            <h3 className="mb-1 text-lg font-bold tracking-tight text-white">
              {this.props.fallbackTitle || "Viewport Error Encountered"}
            </h3>

            <p className="mb-6 text-xs text-slate-400">
              An unexpected render or WebGL issue occurred in this component. You can reload the viewport to recover state safely.
            </p>

            <div className="flex w-full items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-yellow-400 active:scale-95 shadow-lg shadow-yellow-500/20"
              >
                <LuRotateCcw className="h-3.5 w-3.5" />
                Reload Viewport
              </button>

              <button
                type="button"
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
              >
                <LuTerminal className="h-3.5 w-3.5" />
                <span>Logs</span>
                {this.state.showDetails ? (
                  <LuChevronUp className="h-3 w-3" />
                ) : (
                  <LuChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>

            {this.state.showDetails && (
              <div className="mt-4 max-h-48 w-full overflow-auto rounded-lg border border-slate-800 bg-black/60 p-3 text-left font-mono text-[10px] text-red-300">
                <div className="font-bold text-red-400">
                  {this.state.error?.name}: {this.state.error?.message}
                </div>
                {this.state.error?.stack && (
                  <pre className="mt-2 whitespace-pre-wrap opacity-80">
                    {this.state.error.stack}
                  </pre>
                )}
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 border-t border-slate-800 pt-2 text-slate-500">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
