import { serviceClient, verifyOwner } from '../_shared/auth.ts'
import { preflight, response } from '../_shared/http.ts'

function isHttpsUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 500) return false
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const admin = serviceClient()
    const owner = await verifyOwner(request, admin)
    const raw = await request.text()
    if (raw.length > 8000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    const { announcement, homepage, contact, social } = body
    if (!announcement || typeof announcement.enabled !== 'boolean' || typeof announcement.text !== 'string' || announcement.text.length > 240) return response(request, { error: 'Announcement text must be 240 characters or fewer.' }, 400)
    if (!homepage || typeof homepage.eyebrow !== 'string' || homepage.eyebrow.trim().length < 2 || homepage.eyebrow.length > 100 || typeof homepage.headline !== 'string' || homepage.headline.trim().length < 4 || homepage.headline.length > 120 || !homepage.headline.includes('|') || typeof homepage.description !== 'string' || homepage.description.trim().length < 10 || homepage.description.length > 400) return response(request, { error: 'Check the homepage copy, include a | in the headline to split lines, and stay within the length limits.' }, 400)
    if (!contact || typeof contact.phone !== 'string' || !/^\+?[0-9 ()-]{8,22}$/.test(contact.phone) || typeof contact.whatsapp !== 'string' || !/^\d{8,15}$/.test(contact.whatsapp.replace(/\D/g, '')) || typeof contact.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) || contact.email.length > 254) return response(request, { error: 'Check the phone and email details.' }, 400)
    if (!social || !isHttpsUrl(social.facebook) || !isHttpsUrl(social.business_profile) || (social.instagram !== undefined && social.instagram !== '' && !isHttpsUrl(social.instagram))) return response(request, { error: 'Social and business profile links must be valid HTTPS URLs.' }, 400)

    const socialLinks: Record<string, string> = {
      facebook: new URL(social.facebook).toString(),
      business_profile: new URL(social.business_profile).toString(),
    }
    if (typeof social.instagram === 'string' && social.instagram.trim()) {
      socialLinks.instagram = new URL(social.instagram).toString()
    }

    const values = [
      { key: 'homepage_announcement', value: { enabled: announcement.enabled, text: announcement.text.trim() } },
      { key: 'homepage_content', value: { eyebrow: homepage.eyebrow.trim(), headline: homepage.headline.trim(), description: homepage.description.trim() } },
      { key: 'contact', value: { phone: contact.phone.trim(), whatsapp: contact.whatsapp.replace(/\D/g, ''), email: contact.email.trim().toLowerCase() } },
      { key: 'social_links', value: socialLinks },
    ].map((item) => ({ ...item, is_public: true, updated_by: owner.id }))
    const { error } = await admin.from('website_settings').upsert(values, { onConflict: 'key' })
    if (error) throw new Error('Settings could not be saved.')
    await admin.from('admin_audit_logs').insert({ actor_id: owner.id, action: 'update', entity_type: 'website_settings', metadata: { keys: values.map((item) => item.key) } })
    return response(request, { saved: true }, 200, { 'Cache-Control': 'no-store' })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message.includes('Unauthorized') || message.includes('Verified owner') ? 401 : message.includes('Owner authorization') ? 403 : 500
    console.error('admin-update-settings failed:', status, message.slice(0, 120))
    return response(request, { error: status === 401 ? 'Verified owner sign-in required.' : status === 403 ? 'Owner authorization required.' : 'Website settings could not be saved.' }, status)
  }
})
