import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

export type MailType = 'application_confirmation' | 'status_update' | 'document_available' | 'customer_enquiry'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export async function sendCustomerEmail(admin: SupabaseClient, details: {
  applicationId: string
  recipient: string
  name: string
  trackingId: string
  service: string
  type: MailType
  status?: string
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  const subject = details.type === 'application_confirmation'
    ? `Enquiry received · ${details.trackingId}`
    : details.type === 'customer_enquiry'
      ? `New customer enquiry · ${details.trackingId}`
      : details.type === 'status_update'
        ? `Application update · ${details.trackingId}`
        : 'A document is available for your application'
  const plainText = details.type === 'application_confirmation'
    ? `Hello ${details.name},\n\nWe received your enquiry for ${details.service}. Your reference is ${details.trackingId}. Keep this reference private and use it with your registered mobile number to check progress.\n\nBABA'S CYBER CAFE\nIndependent application assistance; official decisions are made by the responsible authority.`
    : details.type === 'customer_enquiry'
      ? `A new customer enquiry was received.\n\nCustomer: ${details.name}\nService: ${details.service}\nReference: ${details.trackingId}\n\nOpen the owner dashboard to review the request.`
      : details.type === 'status_update'
        ? `Hello ${details.name},\n\nYour application ${details.trackingId} (${details.service}) is now marked: ${details.status}. Sign in to the customer portal or use the tracking page with your registered mobile number to view approved updates.\n\nBABA'S CYBER CAFE`
        : `Hello ${details.name},\n\nA document update is available for application ${details.trackingId} (${details.service}). Use the secure tracking page with your registered mobile number to access approved documents.\n\nBABA'S CYBER CAFE`
  const greeting = details.type === 'customer_enquiry' ? 'New customer enquiry' : `Hello ${details.name}`
  const logoUrl = 'https://babacybercafe.in/logo-mark.svg'
  const intro = details.type === 'customer_enquiry'
    ? 'A new customer enquiry has been received. Please review it in the owner dashboard.'
    : details.type === 'application_confirmation'
      ? `We received your enquiry for ${details.service}. Keep your reference safe and use it with your registered mobile number to track progress.`
      : details.type === 'status_update'
        ? `Your application update is: ${details.status ?? 'Updated'}. Visit the tracking page to view the latest approved information.`
        : 'A customer-visible document is now available. Use the secure tracking page to access it.'
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:28px 14px;background:#0b1020;font-family:Arial,Helvetica,sans-serif;color:#eafcff">
    <main style="max-width:560px;margin:0 auto;padding:30px 28px;background:#111a30;border:1px solid #21465a;border-radius:18px">
      <header style="display:flex;align-items:center;gap:14px;padding-bottom:22px;border-bottom:1px solid #244052">
        <img src="${logoUrl}" width="66" height="66" alt="BABA'S CYBER CAFE logo" style="display:block;width:66px;height:66px;object-fit:contain;border:1px solid #20d9e8;border-radius:14px;background:#0b1020">
        <div><div style="font-size:18px;font-weight:800;letter-spacing:1px;color:#20d9e8">BABA'S CYBER CAFE</div><div style="margin-top:5px;font-size:11px;letter-spacing:2px;color:#bd68ff">SERVICE CENTRE · SRINAGAR</div></div>
      </header>
      <section style="padding:22px 0 8px;line-height:1.65">
        <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#f6fdff">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 20px;color:#c8e5ef">${escapeHtml(intro)}</p>
        <div style="padding:16px 18px;background:#0b1020;border:1px solid #244052;border-radius:12px">
          <p style="margin:0 0 8px"><span style="color:#9ab4c4">Reference:</span> <strong style="color:#20d9e8">${escapeHtml(details.trackingId)}</strong></p>
          <p style="margin:0"><span style="color:#9ab4c4">Service:</span> <strong>${escapeHtml(details.service)}</strong>${details.status ? `<br><span style="color:#9ab4c4">Status:</span> <strong>${escapeHtml(details.status)}</strong>` : ''}</p>
        </div>
      </section>
      <footer style="padding-top:18px;border-top:1px solid #244052;font-size:12px;line-height:1.6;color:#9ab4c4">
        <strong style="color:#eafcff">BABA'S CYBER CAFE</strong> · Your Trust, Our Service<br>
        Independent application assistance; official decisions are made by the responsible authority.<br>
        <a href="https://babacybercafe.in" style="color:#20d9e8">babacybercafe.in</a> · <a href="mailto:support@babacybercafe.in" style="color:#20d9e8">support@babacybercafe.in</a>
      </footer>
    </main></body></html>`

  if (!apiKey || !from) {
    await admin.from('email_notifications').insert({ application_id: details.applicationId, recipient_email: details.recipient, notification_type: details.type, status: 'not_configured', error_message: 'Set RESEND_API_KEY and EMAIL_FROM to enable email.' })
    return { sent: false, warning: 'Your request was saved, but email confirmation is not configured. Keep your tracking reference.' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [details.recipient], subject, text: plainText, html }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(typeof result?.message === 'string' ? result.message : `Email provider returned ${response.status}.`)
    await admin.from('email_notifications').insert({ application_id: details.applicationId, recipient_email: details.recipient, notification_type: details.type, status: 'sent', provider_id: result?.id ?? null })
    return { sent: true }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message.slice(0, 400) : 'Email provider request failed.'
    await admin.from('email_notifications').insert({ application_id: details.applicationId, recipient_email: details.recipient, notification_type: details.type, status: 'failed', error_message: message })
    return { sent: false, warning: 'Your request was saved, but we could not send the email. Keep your tracking reference.' }
  }
}
