import { Component, StrictMode, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeAnalytics } from './analytics'

type ErrorBoundaryState = { hasError: boolean }

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const root = document.getElementById('root')
    if (root) root.dataset.appBooting = 'false'
    console.error("BABA'S CYBER CAFE application render failed:", error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeContent: 'center',
            gap: '16px',
            padding: '32px 20px',
            background: '#f7f6f1',
            color: '#171713',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          <div>
            <p style={{ margin: '0 0 8px', color: '#92713a', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em' }}>
              BABA'S CYBER CAFE
            </p>
            <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(24px, 5vw, 36px)' }}>
              We’re fixing a temporary problem
            </h1>
            <p style={{ maxWidth: '460px', margin: '0 auto', lineHeight: 1.6, color: '#5c5a52' }}>
              The page could not be displayed. Your submitted information has not been changed by this error.
              Please reload the website or try again shortly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              justifySelf: 'center',
              minHeight: '44px',
              padding: '0 22px',
              border: '0',
              borderRadius: '4px',
              color: '#fff',
              background: '#171713',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload website
          </button>
        </main>
      )
    }

    return this.props.children
  }
}

// eslint-disable-next-line react-refresh/only-export-components
function StartupComplete({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.getElementById('root')
    if (root) root.dataset.appBooting = 'false'
  }, [])
  return children
}

// Analytics must never prevent the customer website from starting.
try {
  initializeAnalytics()
} catch (error) {
  console.warn('Analytics initialization failed:', error)
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('The application root element #root is missing from index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <StartupComplete>
        <App />
      </StartupComplete>
    </AppErrorBoundary>
  </StrictMode>,
)
