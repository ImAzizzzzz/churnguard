import { Component } from 'react'

/**
 * App-wide error boundary. Without this, any render error in a page white-screens
 * the whole app. Here we catch it and show a recoverable fallback.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface in the console for debugging; could be wired to a logging service.
    console.error('Unhandled UI error:', error, info)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-md text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-modal p-8">
          <div className="text-4xl mb-3">😵</div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            The page hit an unexpected error. Reloading usually fixes it. If it keeps happening,
            let your administrator know.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 text-left text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-lg p-3 overflow-auto max-h-40">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
          <button onClick={this.handleReload}
            className="mt-5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
