type PostHogClient = {
  init: (token: string, options: Record<string, unknown>) => void
  capture: (event: string, properties?: Record<string, string>) => void
}

type PostHogQueue = PostHogClient & {
  _i?: unknown[][]
  push: (...args: unknown[]) => number
}

declare global {
  interface Window {
    posthog?: PostHogQueue
  }
}

let analyticsStarted = false

/**
 * Loads PostHog only when both public build-time settings are present.
 * No form values, names, email addresses, phone numbers, or document data
 * are captured. Session replay and automatic DOM capture remain disabled.
 */
export function initializeAnalytics() {
  if (analyticsStarted || typeof window === 'undefined') return

  const token = import.meta.env.VITE_POSTHOG_KEY
  const apiHost = import.meta.env.VITE_POSTHOG_HOST

  if (!token || !apiHost) {
    if (import.meta.env.DEV) {
      console.info('PostHog analytics is not configured for this build.')
    }
    return
  }

  analyticsStarted = true

  // PostHog's supported snippet queue records init/capture calls until
  // the regional SDK bundle has loaded.
  const queue = [] as unknown as PostHogQueue
  queue._i = []
  queue.push = Array.prototype.push.bind(queue) as PostHogQueue['push']
  queue.init = (projectToken, options) => {
    queue._i?.push([projectToken, options])
  }
  queue.capture = (event, properties) => {
    queue.push(['capture', event, properties])
  }
  window.posthog = queue

  const assetHost = apiHost.replace(/\.i\.posthog\.com\/?$/, '-assets.i.posthog.com')
  const script = document.createElement('script')
  script.src = `${assetHost}/static/array.js`
  script.async = true
  script.crossOrigin = 'anonymous'
  script.onerror = () => {
    analyticsStarted = false
    console.warn('PostHog analytics script could not be loaded.')
  }

  queue.init(token, {
    api_host: apiHost,
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
    respect_dnt: true,
  })

  // Record form completion only. Never inspect or send submitted field values.
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return
      queue.capture('form_submitted', {
        form_id: form.id || 'unnamed',
        form_name: form.getAttribute('name') || 'unnamed',
      })
    },
    true,
  )

  document.head.appendChild(script)
}
