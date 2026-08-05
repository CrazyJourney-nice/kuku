"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    window.dispatchEvent(
      new CustomEvent("kuku:frontend-error", {
        detail: {
          message: error.message,
          componentStack: info.componentStack?.slice(0, 800),
        },
      }),
    );
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="fatal-view" role="alert">
        <div className="fatal-view__mark" aria-hidden="true">!</div>
        <p className="eyebrow">KUKU COFFEE</p>
        <h1>页面需要重新整理一下</h1>
        <p>你的制作订单会被安全保留。请点击下方按钮恢复界面。</p>
        <button
          type="button"
          className="button button--primary"
          onClick={() => window.location.reload()}
        >
          恢复界面
        </button>
      </main>
    );
  }
}
