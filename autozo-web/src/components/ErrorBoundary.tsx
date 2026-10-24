'use client';

import React from 'react';
import { Alert, Button } from './ui';

/**
 * Keeps one bad section from taking the whole screen down, and — unlike a
 * blank page — tells us what actually broke. Only client render errors land
 * here; network failures are handled where the request is made.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Surfaces in the browser console with the component stack attached.
    console.error('[Bingoor] render error', error, info.componentStack);
  }

  render() {
    if (this.state.message === null) return this.props.children;

    return (
      <div className="page" style={{ paddingTop: 24, maxWidth: 620 }}>
        <Alert tone="bad">
          {this.props.label ? `${this.props.label}: ` : ''}
          {this.state.message}
        </Alert>
        <p className="body-sm" style={{ marginBottom: 16 }}>
          We could not display this section. The rest of the site is working normally.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button icon="repeat" onClick={() => this.setState({ message: null })}>
            Try again
          </Button>
          <a href="/categories" className="btn btn-md btn-outline">
            Browse categories
          </a>
        </div>
      </div>
    );
  }
}
