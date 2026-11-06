import { serviceClient } from '../_shared/auth.ts'
import { response } from '../_shared/http.ts'

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
function parseAmount(message: string) {
  const match = message.match(/(?:credited|credit(?:ed)?\s+to)[^\d]{0,50}(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i)
    ?? message.match(/(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)[^\n]{0,50}(?:credited|credit)/i)
  if (!match) return null
  const amount = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(amount) && amount > 0 && amount <= 10000000 ? amount.toFixed(2) : null
}
function parseUtr(message: string) {
  const match = message.match(/UPI[\s\S]{0,40}?(?:REF|RRN|REFERENCE)(?:\s*(?:NO|NUMBER))?\s*[:/#-]?\s*(\d{12})/i)
    ?? message.match(/(?:REF|RRN)(?:\s*(?:NO|NUMBER))?\s*[:/#-]?\s*(\d{12})/i)
  return match?.[1] ?? null
}
function parseTracking(message: string) {
  return message.toUpperCase().match(/BABA-[A-Z0-9]{10}/)?.[0] ?? null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': 'https://babacybercafe.in', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, x-api-key' } })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const supplied = request.headers.get('x-api-key') ?? ''
    if (!supplied || supplied.length > 256) return new Response('Unauthorized', { status: 401 })
    const admin = serviceClient()
    const { data: authorized, error: secretError } = await admin.rpc('verify_bank_sms_webhook_key', {
      p_supplied_key: supplied,
    })
    if (secretError || authorized !== true) return new Response('Unauthorized', { status: 401 })
    const raw = await request.text()
    if (raw.length > 5000) return new Response('Payload too large', { status: 413 })
    const body = JSON.parse(raw)
    const sender = typeof body.sender === 'string' ? body.sender.trim().slice(0, 80) : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const epoch = Number(body.timestamp)
    const bankTime = Number.isFinite(epoch) ? new Date(epoch < 100000000000 ? epoch * 1000 : epoch) : null
    if (!/^ICICI(?:[-_ ]BANK)?$/i.test(sender) || message.length < 10 || message.length > 2000 || !bankTime || Number.isNaN(bankTime.getTime()) || Math.abs(Date.now() - bankTime.getTime()) > 10 * 60 * 1000) {
      return new Response('Invalid bank alert payload', { status: 400 })
    }
    if (!/\b(?:credited|credit)\b/i.test(message) || /\b(debited|withdrawn|spent)\b/i.test(message)) return new Response('Not a credit alert', { status: 422 })
    const amount = parseAmount(message)
    const utr = parseUtr(message)
    const trackingId = parseTracking(message)
    const messageHash = await sha256(sender + '|' + message)
    const { data: alert, error: insertError } = await admin.from('bank_sms_alerts').insert({
      sender, message, bank_timestamp: bankTime.toISOString(), parsed_amount: amount,
      parsed_utr: utr, parsed_tracking_id: trackingId, message_hash: messageHash,
      status: amount && utr && trackingId ? 'unmatched' : 'review',
      processing_note: amount && utr && trackingId ? 'Awaiting exact tracking, amount and reference match.' : 'Could not parse all required fields; admin review required.',
    }).select('id').single()
    if (insertError) {
      if (insertError.code === '23505') return response(request, { accepted: true, duplicate: true }, 200)
      throw insertError
    }
    if (amount && utr && trackingId) {
      const { data: app } = await admin.from('applications').select('id').eq('tracking_id', trackingId).maybeSingle()
      if (app) {
        const { data: payment } = await admin.from('payment_orders').select('id, amount, status').eq('application_id', app.id).maybeSingle()
        if (payment && Number(payment.amount).toFixed(2) === amount && ['pending', 'claimed'].includes(payment.status)) {
          const { data: updated } = await admin.from('payment_orders').update({
            status: 'paid', utr, paid_at: bankTime.toISOString(),
          }).eq('id', payment.id).in('status', ['pending', 'claimed']).is('utr', null).select('id').maybeSingle()
          if (updated) {
            await admin.from('bank_sms_alerts').update({ status: 'matched', matched_payment_id: payment.id, processing_note: 'Automatically matched exact tracking ID, amount and unique UTR.' }).eq('id', alert.id)
            await admin.from('payment_audit_events').insert({ payment_id: payment.id, action: 'bank_sms_auto_reconciled', metadata: { alert_id: alert.id, utr, amount } })
            return response(request, { accepted: true, matched: true }, 200)
          }
        }
      }
    }
    return response(request, { accepted: true, matched: false, alertId: alert.id }, 200)
  } catch (reason) {
    console.error('bank-sms webhook failed:', reason instanceof Error ? reason.message.slice(0, 120) : 'unknown error')
    return new Response('Webhook processing failed', { status: 500 })
  }
})
