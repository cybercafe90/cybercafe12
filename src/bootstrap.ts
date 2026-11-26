// Start the customer application immediately. Service-worker registration and
// updates are progressive enhancements and must never block the first render.
import './main.tsx'

function prepareServiceWorkerInBackground() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  void navigator.serviceWorker.register('/sw.js?revision=4', {
    updateViaCache: 'none',
  }).then((registration) => {
    // Ask the browser to check for updates without holding up application startup.
    void registration.update().catch((error: unknown) => {
      console.warn('Background service-worker update failed:', error)
    })
  }).catch((error: unknown) => {
    console.warn('Service-worker registration failed; the website remains available:', error)
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', prepareServiceWorkerInBackground, { once: true })
}
