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
    // Match exact tracking + amount + UTR to a payment as a review suggestion only.
    // SMS content is not bank-signed proof and must never mark an order paid.
    let candidateMatched = false
    let candidateNote = 'Could not identify a complete tracking, amount and UTR match; owner review required.'
    if (amount && utr && trackingId) {
      const { data: app } = await admin.from('applications').select('id').eq('tracking_id', trackingId).maybeSingle()
      if (app) {
        const { data: payment } = await admin.from('payment_orders')
          .select('id, amount, status, utr, claimed_utr')
          .eq('application_id', app.id).maybeSingle()
        const { data: duplicateUtr } = payment
          ? await admin.from('payment_orders').select('id').neq('id', payment.id)
              .or(`utr.eq.${utr},claimed_utr.eq.${utr}`).limit(1).maybeSingle()
          : { data: null }
        const claimedReferenceMatches = !payment?.claimed_utr || payment.claimed_utr === utr
        if (payment && Number(payment.amount).toFixed(2) === Number(amount).toFixed(2)
          && ['pending','claimed','needs_review'].includes(payment.status)
          && !payment.utr && claimedReferenceMatches && !duplicateUtr) {
          const { error: candidateError } = await admin.from('bank_sms_alerts').update({
            matched_payment_id: payment.id,
            status: 'unmatched',
            processing_note: 'Automatic exact-match candidate found for tracking ID, amount and UTR. NOT verified: owner must confirm the actual bank-statement credit before marking paid.',
          }).eq('id', alert.id)
          if (!candidateError) {
            candidateMatched = true
            candidateNote = 'Potential payment candidate found. Bank-statement verification is still mandatory.'
          }
        } else {
          candidateNote = 'No safe exact candidate: check amount, UTR reuse, customer claim and payment status.'
        }
      } else {
        candidateNote = 'No application matches the supplied tracking reference.'
      }
      if (!candidateMatched) {
        await admin.from('bank_sms_alerts').update({ status: 'unmatched', processing_note: candidateNote }).eq('id', alert.id)
      }
    }
    return response(request, { accepted: true, matched: false, candidateMatched, reviewRequired: true, alertId: alert.id, note: candidateNote }, 200)

  } catch (reason) {
    console.error('bank-sms webhook failed:', reason instanceof Error ? reason.message.slice(0, 120) : 'unknown error')
    return new Response('Webhook processing failed', { status: 500 })
  }
})
