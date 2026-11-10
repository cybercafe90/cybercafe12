import { serviceClient } from '../_shared/auth.ts'
import { preflight, response } from '../_shared/http.ts'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
function money(value: unknown) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value ?? 0))
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const token = request.headers.get('x-marketplace-cron-token') ?? ''
    if (token.length < 32) return response(request, { error: 'Unauthorized.' }, 401)
    const admin = serviceClient()
    const { data: valid, error: validationError } = await admin.rpc('marketplace_validate_cron_token', { p_token: token })
    if (validationError || valid !== true) return response(request, { error: 'Unauthorized.' }, 401)

    const { data: rolledOver, error: rolloverError } = await admin.rpc('marketplace_rollover_memberships')
    if (rolloverError) throw new Error('Membership rollover failed.')

    const now = new Date()
    const renewalWindow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const [monthlyResult, annualResult] = await Promise.all([
      admin.from('marketplace_memberships')
        .select('id,seller_id,period_start,expires_at,grace_until,fee_amount,paid_amount,status')
        .in('status', ['pending','grace','paused']).lt('paid_amount', 200)
        .order('period_start', { ascending: true }).limit(500),
      admin.from('marketplace_memberships')
        .select('id,seller_id,period_start,expires_at,grace_until,fee_amount,paid_amount,status')
        .eq('status', 'active').gte('expires_at', now.toISOString())
        .lte('expires_at', renewalWindow.toISOString()).gte('paid_amount', 200)
        .order('expires_at', { ascending: true }).limit(500),
    ])
    if (monthlyResult.error || annualResult.error) throw new Error('Membership reminders could not be loaded.')
    const jobs = [
      ...(monthlyResult.data ?? []).map((membership) => ({ membership, reminderType: 'monthly_payment' as const })),
      ...(annualResult.data ?? []).map((membership) => ({ membership, reminderType: 'annual_renewal' as const })),
    ]
    if (!jobs.length) return response(request, { processed: true, remindersSent: 0, remindersFailed: 0, membershipsRolledOver: rolledOver ?? 0 })

    const sellerIds = [...new Set(jobs.map((job) => job.membership.seller_id))]
    const membershipIds = [...new Set(jobs.map((job) => job.membership.id))]
    const { data: sellers, error: sellerError } = await admin.from('marketplace_sellers')
      .select('id,store_name,contact_email,status').in('id', sellerIds)
    if (sellerError) throw new Error('Seller reminder recipients could not be loaded.')
    const sellerMap = new Map((sellers ?? []).map((s) => [s.id, s]))
    const month = new Date()
    month.setUTCDate(1)
    month.setUTCHours(0, 0, 0, 0)
    const reminderMonth = month.toISOString().slice(0, 10)
    const { data: existing, error: existingError } = await admin.from('marketplace_membership_reminders')
      .select('membership_id,reminder_type').in('membership_id', membershipIds).eq('reminder_month', reminderMonth)
    if (existingError) throw new Error('Reminder history could not be checked.')
    const alreadySent = new Set((existing ?? []).map((r) => r.membership_id + ':' + r.reminder_type))
    let remindersSent = 0
    let remindersFailed = 0
    const apiKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('EMAIL_FROM')

    for (const job of jobs) {
      const membership = job.membership
      const key = membership.id + ':' + job.reminderType
      if (alreadySent.has(key)) continue
      const seller = sellerMap.get(membership.seller_id)
      if (!seller?.contact_email) continue
      const remaining = Math.max(0, Number(membership.fee_amount) - Number(membership.paid_amount))
      const isRenewal = job.reminderType === 'annual_renewal'
      const { data: reminder, error: insertError } = await admin.from('marketplace_membership_reminders').insert({
        membership_id: membership.id, reminder_month: reminderMonth, reminder_type: job.reminderType, status: 'queued',
      }).select('id').maybeSingle()
      if (insertError || !reminder) continue

      const statusLabel = membership.status === 'grace' ? 'Grace period' : membership.status === 'paused' ? 'Selling temporarily paused' : 'Payment pending'
      const subject = isRenewal ? 'Annual seller membership renewal · BABA’S CYBER CAFE' : 'Monthly seller membership reminder · BABA’S CYBER CAFE'
      const feeText = isRenewal
        ? 'Your next annual membership fee of ₹200 is due on ' + new Date(membership.expires_at).toLocaleDateString('en-IN') + '. Renew within the 15-day grace period to avoid a temporary selling pause.'
        : 'Annual fee: ' + money(membership.fee_amount) + '\nVerified payments: ' + money(membership.paid_amount) + '\nRemaining balance: ' + money(remaining) + '\nMembership status: ' + statusLabel + '\nGrace period ends: ' + new Date(membership.grace_until).toLocaleDateString('en-IN')
      const plain = 'Hello ' + seller.store_name + ',\n\n' + (isRenewal ? feeText : 'This is your monthly reminder about your BABA\'S CYBER CAFE Marketplace annual membership.\n\n' + feeText) + '\n\nYou may pay in flexible instalments of your choice. The annual seller membership is ₹200 and there is no commission on your product sales.\n\nBABA\'S CYBER CAFE'
      const html = '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><p>Hello ' + escapeHtml(seller.store_name) + ',</p><p>' + escapeHtml(isRenewal ? feeText : 'This is your monthly reminder about your BABA\'S CYBER CAFE Marketplace annual membership.') + '</p>' +
        (isRenewal ? '' : '<ul><li>Annual fee: <strong>' + money(membership.fee_amount) + '</strong></li><li>Verified payments: ' + money(membership.paid_amount) + '</li><li>Remaining balance: <strong>' + money(remaining) + '</strong></li><li>Membership status: ' + escapeHtml(statusLabel) + '</li><li>Grace period ends: ' + escapeHtml(new Date(membership.grace_until).toLocaleDateString('en-IN')) + '</li></ul>') +
        '<p>You may pay in flexible instalments of your choice. The annual seller membership is ₹200 and there is no commission on your product sales.</p><p>BABA\'S CYBER CAFE</p></div>'

      if (!apiKey || !from) {
        await admin.from('marketplace_membership_reminders').update({ status: 'failed', error_message: 'Resend email configuration is unavailable.' }).eq('id', reminder.id)
        remindersFailed++
        continue
      }
      try {
        const result = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [seller.contact_email], subject, text: plain, html }),
        })
        const payload = await result.json().catch(() => ({}))
        if (!result.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'Resend returned ' + result.status)
        await admin.from('marketplace_membership_reminders').update({
          status: 'sent', provider_id: typeof payload?.id === 'string' ? payload.id : null,
          sent_at: new Date().toISOString(), error_message: '',
        }).eq('id', reminder.id)
        remindersSent++
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 450) : 'Email delivery failed.'
        await admin.from('marketplace_membership_reminders').update({ status: 'failed', error_message: message }).eq('id', reminder.id)
        remindersFailed++
      }
    }

    return response(request, {
      processed: true,
      remindersSent,
      remindersFailed,
      membershipsRolledOver: rolledOver ?? 0,
      reminderMonth,
    }, 200, { 'Cache-Control': 'no-store' })
  } catch (error) {
    console.error('marketplace-reminders failed:', error instanceof Error ? error.message.slice(0, 160) : 'unknown')
    return response(request, { error: 'Marketplace reminders could not be processed.' }, 503, { 'Cache-Control': 'no-store' })
  }
})
