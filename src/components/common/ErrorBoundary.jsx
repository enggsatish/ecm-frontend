import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Generic error boundary.
 * Catches render/lifecycle errors in the subtree and shows a fallback UI
 * instead of a blank page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <DocumentTable />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Custom message</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex flex-col items-center justify-center rounded-xl
                      border border-red-100 bg-red-50 py-16 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center
                        rounded-full bg-red-100 mb-4">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <p className="text-sm font-semibold text-gray-800 mb-1">
          Something went wrong
        </p>
        <p className="text-xs text-gray-500 mb-4 max-w-xs">
          {this.state.error?.message ?? 'An unexpected error occurred'}
        </p>
        <button
          onClick={this.reset}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200
                     bg-white px-4 py-2 text-xs font-medium text-red-600
                     hover:bg-red-50 transition-colors"
        >
          <RefreshCw size={13} />
          Try again
        </button>
      </div>
    )
  }
}