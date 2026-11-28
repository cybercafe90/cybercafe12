import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, LockKeyhole } from 'lucide-react'
import Notice from '../components/Notice'
import { LoadingSpinner } from '../components/Motion'
import PageIntro from '../components/PageIntro'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { TrackingResult } from '../types'
import { STATUS_LABELS } from '../types'

export default function TrackPage() {
  const [searchParams] = useSearchParams()
  const [result, setResult] = useState<TrackingResult | null>(null)
  const [verifiedCredentials, setVerifiedCredentials] = useState<{ trackingId: string; mobile: string } | null>(null)
  const [temporaryDocumentUrls, setTemporaryDocumentUrls] = useState<Record<string, string>>({})
  const [errorText, setErrorText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setResult(null)
    setErrorText('')
    if (!supabase) {
      setErrorText('Tracking is not configured yet. Please contact our team on WhatsApp.')
      return
    }
    const data = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const trackingId = String(data.get('tracking_id') ?? '').trim().toUpperCase()
      const mobile = String(data.get('mobile') ?? '')
      const response = await supabase.functions.invoke('verify-tracking', {
        body: { tracking_id: trackingId, mobile },
      })
      if (response.error) {
        setErrorText(response.error.message || 'Tracking could not be checked. Please try again.')
        return
      }
      if (!response.data?.application) {
        setErrorText('We could not find a matching application. Check the tracking ID and mobile number and try again.')
        return
      }
      setVerifiedCredentials({ trackingId, mobile })
      setResult(response.data.application as TrackingResult)
    } catch (requestError) {
      setErrorText(requestError instanceof Error ? requestError.message : 'Tracking could not be checked. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function openDocument(documentId: string) {
    if (!supabase || !verifiedCredentials) return
    const documentWindow = window.open('about:blank', '_blank')
    setErrorText('')
    try {
      const { data, error } = await supabase.functions.invoke('application-documents', {
        body: {
          action: 'download',
          document_id: documentId,
          tracking_id: verifiedCredentials.trackingId,
          mobile: verifiedCredentials.mobile,
        },
      })
      if (error || typeof data?.signed_url !== 'string') {
        documentWindow?.close()
        setErrorText(error?.message || 'A temporary document link could not be created.')
        return
      }
      if (documentWindow) {
        documentWindow.opener = null
        documentWindow.location.href = data.signed_url
      } else {
        setTemporaryDocumentUrls((current) => ({ ...current, [documentId]: data.signed_url }))
        window.setTimeout(() => {
          setTemporaryDocumentUrls((current) => {
            const next = { ...current }
            delete next[documentId]
            return next
          })
        }, 55_000)
      }
    } catch (requestError) {
      documentWindow?.close()
      setErrorText(requestError instanceof Error ? requestError.message : 'A temporary document link could not be created.')
    }
  }

  return <main className="form-page track-page"><PageIntro label="APPLICATION TRACKING" title={<>Your progress,<br /><em>at a glance.</em></>} copy="Enter the tracking ID we shared with you and the mobile number used on your application." />
    <div className="track-layout"><form className="form-card track-form" onSubmit={submit}>
      {!isSupabaseConfigured && <Notice tone="info">Online tracking is not connected in this preview. Reach us on WhatsApp for assistance.</Notice>}
      {errorText && <Notice tone="error">{errorText}</Notice>}
      <label>Tracking ID<input name="tracking_id" required pattern="BBC-[0-9]{4}-[A-Z0-9]{5}" maxLength={14} defaultValue={searchParams.get('tracking_id') ?? ''} placeholder="BBC-2026-A1B2C" autoCapitalize="characters" /></label>
      <label>Mobile number<input name="mobile" type="tel" required maxLength={20} placeholder="Use the number from your application" /></label>
      <button className="button button-gold form-submit" type="submit" disabled={busy}>{busy ? <LoadingSpinner label="Checking status" /> : <>Check application status <ArrowRight size={16} /></>}</button>
      <p className="privacy-note"><LockKeyhole size={15} /> Your application details are shown only when both the tracking ID and mobile number match.</p>
    </form>
    {result ? <article className="status-card"><span className="eyebrow eyebrow-left">APPLICATION UPDATE</span><div className="status-id">{result.tracking_id}</div><span className={`status-pill status-${result.status}`}>{STATUS_LABELS[result.status]}</span><h2>{result.service_name}</h2><p>Received {new Date(result.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>{result.public_remark && <div className="public-remark"><b>Update from our team</b><span>{result.public_remark}</span></div>}{result.documents?.length ? <div className="verified-documents"><b>Your uploaded documents</b>{result.documents.map((document) => <div key={document.id}><span>{document.file_name} · {document.approval_status}</span><span className="document-actions"><button type="button" className="text-link" onClick={() => void openDocument(document.id)}>Open secure link</button>{temporaryDocumentUrls[document.id] && <a className="text-link" href={temporaryDocumentUrls[document.id]} target="_blank" rel="noreferrer">Open temporary link</a>}</span></div>)}</div> : null}<a href="https://wa.me/917006865909" target="_blank" rel="noreferrer" className="text-link">Need help? Message us <ArrowUpRight size={14} /></a></article> : <aside className="track-aside"><div className="aside-icon"><LockKeyhole size={17} /></div><h2>Private by design</h2><p>For your privacy, we never show application details based on a tracking ID alone. Keep your tracking ID safe, and use the same mobile number you provided in your application.</p><div className="track-support"><span>Can't find your tracking ID?</span><a href="https://wa.me/917006865909" target="_blank" rel="noreferrer">Contact our team <ArrowUpRight size={14} /></a></div></aside>}</div>
  </main>
}
