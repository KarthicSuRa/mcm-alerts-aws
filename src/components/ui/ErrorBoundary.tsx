import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  
  private handleTryAgain = () => {
    this.setState({ hasError: false });
    // For more complex state, a full reload might be safer
    // window.location.reload(); 
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card p-6 rounded-xl border border-border text-center flex flex-col items-center justify-center h-full">
          <Icon name="alert" className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Something went wrong.</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            An error occurred in this component.
          </p>
          <button
            onClick={this.handleTryAgain}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
