// ============================================================
// RetailNexus — Error Boundary
// ============================================================

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
          <div className="rounded-full bg-red-100 p-4">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-gray-900">
            Algo deu errado
          </h1>
          <p className="mt-2 max-w-md text-sm text-gray-500">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          {this.state.error && (
            <pre className="mt-4 max-w-lg overflow-auto rounded-lg bg-gray-100 p-3 text-left text-xs text-gray-600">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-6 flex gap-3">
            <button
              onClick={this.handleRetry}
              className="btn-primary"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="btn-secondary"
            >
              Ir para Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
