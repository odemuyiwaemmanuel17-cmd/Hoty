import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
  /** Called when a crash is caught, for logging/telemetry. */
  onError?: (error: Error) => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Hot&Appetizing] render error:', error, info.componentStack)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.error) return this.props.fallback
    return this.props.children
  }
}
