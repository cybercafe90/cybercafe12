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
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24241e"><p>${escapeHtml(greeting)},</p><p>${escapeHtml(plainText.split('\n\n')[1] ?? '')}</p><p><strong>Reference:</strong> ${escapeHtml(details.trackingId)}<br><strong>Service:</strong> ${escapeHtml(details.service)}${details.status ? `<br><strong>Status:</strong> ${escapeHtml(details.status)}` : ''}</p><p>BABA'S CYBER CAFE is an independent assistance business; official decisions are made by the responsible authority.</p></div>`

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
