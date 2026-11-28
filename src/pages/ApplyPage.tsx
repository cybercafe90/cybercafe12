import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, LockKeyhole, MessageCircle } from 'lucide-react'
import Notice from '../components/Notice'
import { LoadingSpinner } from '../components/Motion'
import PageIntro from '../components/PageIntro'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { isValidMobileNumber, normalizeMobileNumber } from '../lib/validation'
import type { ServiceCategory, ServiceRecord } from '../types'

const maximumDocuments = 5
const maximumDocumentSize = 5 * 1024 * 1024

interface SubmissionResult {
  trackingId: string
  createdAt: string
  whatsappUrl: string
  emailNotification: 'not_configured' | 'not_provided' | 'accepted' | 'failed'
  uploadedCount: number
  failedFiles: string[]
}

export default function ApplyPage({
  categories,
  services,
}: {
  categories: ServiceCategory[]
  services: ServiceRecord[]
}) {
  const [searchParams] = useSearchParams()
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [departmentId, setDepartmentId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [busy, setBusy] = useState(false)

  const departmentServices = useMemo(
    () => services.filter((service) => service.category_id === departmentId),
    [departmentId, services],
  )

  useEffect(() => {
    const queryService = searchParams.get('service')
    if (!queryService) return
    const service = services.find((item) => item.id === queryService)
    if (service) {
      setDepartmentId(service.category_id)
      setSelectedServiceId(service.id)
    }
  }, [searchParams, services])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    setResult(null)
    const form = event.currentTarget
    const formData = new FormData(form)
    const phone = normalizeMobileNumber(String(formData.get('phone') ?? ''))
    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const message = String(formData.get('message') ?? '').trim()
    const serviceName = String(formData.get('service_name') ?? '').trim()
    const files = Array.from(formData.getAll('documents')).filter((item): item is File => item instanceof File && item.size > 0)

    if (!isValidMobileNumber(phone)) {
      setNotice({ tone: 'error', text: 'Enter a valid phone number, including country code if needed.' })
      return
    }
    if (!departmentId) {
      setNotice({ tone: 'error', text: 'Choose a department for your request.' })
      return
    }
    const selectedService = services.find((service) => service.id === selectedServiceId)
    if (selectedServiceId !== 'other' && !selectedService) {
      setNotice({ tone: 'error', text: 'Choose a published service or select “Other / not listed”.' })
      return
    }
    if (selectedServiceId === 'other' && !serviceName) {
      setNotice({ tone: 'error', text: 'Describe the service you need help with.' })
      return
    }
    if (files.length > maximumDocuments) {
      setNotice({ tone: 'error', text: `Choose no more than ${maximumDocuments} documents.` })
      return
    }
    if (files.some((file) => file.size > maximumDocumentSize)) {
      setNotice({ tone: 'error', text: 'Each document must be no larger than 5 MB.' })
      return
    }
    if (!supabase) {
      setNotice({ tone: 'error', text: 'Online applications are not configured yet. Please contact our team on WhatsApp.' })
      return
    }

    const whatsappWindow = window.open('about:blank', '_blank')
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('process-application', {
        body: {
          action: 'create',
          customer_name: name,
          mobile: phone,
          email: email || null,
          department_id: departmentId,
          service_id: selectedService?.id ?? null,
          service_name: selectedService?.name ?? serviceName,
          message: message || null,
          consent: formData.get('consent') === 'on',
        },
      })
      if (error) {
        whatsappWindow?.close()
        setNotice({ tone: 'error', text: error.message || 'We could not submit your application. Please try again or contact us.' })
        return
      }
      if (typeof data?.tracking_id !== 'string' || typeof data?.created_at !== 'string') {
        whatsappWindow?.close()
        setNotice({ tone: 'error', text: 'The application service returned an unexpected response. Please contact our team before submitting again.' })
        return
      }

      const failedFiles: string[] = []
      let uploadedCount = 0
      for (const file of files) {
        try {
          const upload = new FormData()
          upload.set('tracking_id', data.tracking_id)
          upload.set('mobile', phone)
          upload.set('file', file, file.name)
          const { data: uploadResult, error: uploadError } = await supabase.functions.invoke('application-documents', { body: upload })
          if (uploadError || uploadResult?.success !== true) failedFiles.push(file.name)
          else uploadedCount += 1
        } catch {
          failedFiles.push(file.name)
        }
      }

      const submittedService = selectedService?.name ?? serviceName
      const whatsappMessage = [
        `Hello BABA'S CYBER CAFE, I submitted an application for ${submittedService}.`,
        `My tracking ID is ${data.tracking_id}.`,
        'Please guide me regarding the application process and service charges.',
        failedFiles.length ? 'I could not upload all supporting documents online and need guidance.' : '',
      ].filter(Boolean).join(' ')
      const whatsappUrl = `https://wa.me/917006865909?text=${encodeURIComponent(whatsappMessage)}`
      if (whatsappWindow) {
        whatsappWindow.opener = null
        whatsappWindow.location.href = whatsappUrl
      }

      setResult({
        trackingId: data.tracking_id,
        createdAt: data.created_at,
        whatsappUrl,
        emailNotification: data.email_notification,
        uploadedCount,
        failedFiles,
      })
      const emailMessage = data.email_notification === 'accepted'
        ? ' The email provider accepted a confirmation request; email delivery is not confirmed.'
        : data.email_notification === 'failed'
          ? ' The application is saved, but the email confirmation could not be requested.'
          : data.email_notification === 'not_configured'
            ? ' Email confirmation is not configured; keep your tracking ID.'
            : ''
      const documentMessage = failedFiles.length
        ? ` ${failedFiles.length} document${failedFiles.length === 1 ? '' : 's'} could not be uploaded. Please contact us before sending them another way.`
        : files.length
          ? ` ${uploadedCount} document${uploadedCount === 1 ? '' : 's'} uploaded securely.`
          : ''
      setNotice({
        tone: 'success',
        text: `Your application was received.${documentMessage}${emailMessage} WhatsApp opened in a new tab when allowed by your browser.`,
      })
      form.reset()
      setDepartmentId('')
      setSelectedServiceId('')
    } catch (error) {
      whatsappWindow?.close()
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'We could not submit your application. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return <main className="form-page"><PageIntro label="GET STARTED" title={<>Let's take the<br /><em>next step together.</em></>} copy="Share a few details about what you need. Our team will review your request and contact you if we need anything else." />
    <div className="form-layout"><form className="form-card" onSubmit={submit}>
      {!isSupabaseConfigured && <Notice tone="info">Online applications are not connected in this preview. Reach us on WhatsApp for assistance.</Notice>}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {result && <div className="tracking-success"><span>Your private tracking ID</span><strong>{result.trackingId}</strong><span>Received {new Date(result.createdAt).toLocaleString('en-IN')}</span><Link to={`/track?tracking_id=${encodeURIComponent(result.trackingId)}`}>Track your application <ArrowRight size={15} /></Link><a className="text-link" href={result.whatsappUrl} target="_blank" rel="noreferrer">Continue on WhatsApp <MessageCircle size={15} /></a>{result.failedFiles.length > 0 && <span>Not uploaded: {result.failedFiles.join(', ')}</span>}</div>}
      <label>Your name<input name="name" required maxLength={100} autoComplete="name" placeholder="Name as it appears on your documents" /></label>
      <div className="form-row"><label>Mobile number<input name="phone" type="tel" required maxLength={20} autoComplete="tel" placeholder="+91 70000 00000" /></label><label>Email address <span className="optional">(optional)</span><input name="email" type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" /></label></div>
      <label>Department
        <select name="department" required value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setSelectedServiceId('') }}>
          <option value="">Choose a published department</option>
          {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label>Selected service
        <select name="service" required value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} disabled={!departmentId}>
          <option value="">Choose a service</option>
          {departmentServices.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}
          <option value="other">Other / not listed</option>
        </select>
      </label>
      {selectedServiceId === 'other' && <label>Service name<input name="service_name" required maxLength={160} placeholder="Tell us what you need help with" /></label>}
      <label>Application description <span className="optional">(optional)</span><textarea name="message" rows={4} maxLength={2000} placeholder="Please do not include passwords, OTPs, or sensitive document numbers." /></label>
      <label>Supporting documents <span className="optional">(optional · PDF, JPG or PNG · up to 5 documents, 5 MB each)</span><input className="document-input" name="documents" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple /></label>
      <label className="consent-row"><input type="checkbox" name="consent" required /><span>I consent to BABA'S CYBER CAFE using the information I provide to review and respond to this application, and sharing only information needed with a relevant service provider when necessary. Documents are optional; do not include passwords, one-time codes, or unnecessary sensitive identity details. I may be contacted using the mobile number or email I supplied.</span></label>
      <p className="privacy-note"><LockKeyhole size={15} /> Documents are private and available only through authorized access. Applications are verified using the tracking ID and mobile number.</p>
      <button className="button button-gold form-submit" type="submit" disabled={busy}>{busy ? <LoadingSpinner label="Submitting application" /> : <>Submit application <ArrowRight size={16} /></>}</button>
      <p className="form-note">After submission, WhatsApp opens with an enquiry you can review and send. Service arrangements are discussed directly with our team.</p>
    </form>
    <aside className="form-aside"><div className="aside-icon"><Check size={18} /></div><h2>What happens next?</h2><ol><li><b>We receive your request</b><span>A unique tracking ID is created for you.</span></li><li><b>Our team reviews it</b><span>We’ll follow up on your registered mobile number.</span></li><li><b>You stay informed</b><span>Use your tracking ID and mobile number for updates.</span></li></ol><div className="aside-contact"><span>Prefer to speak first?</span><a href="https://wa.me/917006865909" target="_blank" rel="noreferrer">Message us on WhatsApp <ArrowUpRight size={14} /></a></div></aside></div>
  </main>
}
