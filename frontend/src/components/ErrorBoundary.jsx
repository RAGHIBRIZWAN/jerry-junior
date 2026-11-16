import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream p-6 text-center">
        <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
        <p className="max-w-sm text-gray-600">Sorry about that. Please reload the page. Your bag is saved.</p>
        <div className="flex gap-3">
          <button className="btn btn-dark" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a className="btn btn-light" href="/">
            Go home
          </a>
        </div>
      </div>
    );
  }
}
