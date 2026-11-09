// Update the service worker before loading the React application. Older
// releases cached JavaScript bundles; doing this first breaks the stale-cache
// cycle before any application chunks are requested.
async function prepareServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.register('/sw.js?revision=3', {
      updateViaCache: 'none',
    })

    await Promise.race([
      registration.update(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 6000)),
    ])

    const worker = registration.installing ?? registration.waiting
    if (worker) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          if (worker.state === 'activated' || worker.state === 'redundant') {
            window.clearTimeout(timeout)
            resolve()
          }
        }
        const timeout = window.setTimeout(resolve, 7000)
        worker.addEventListener('statechange', finish)
        finish()
      })
    }
  } catch (error) {
    // A service-worker update is an enhancement, never a reason to block the site.
    console.warn('PWA recovery update was unavailable; continuing with the website.', error)
  }
}

await prepareServiceWorker()
await import('./main.tsx')
