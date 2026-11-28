import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Check, FileCheck2, LockKeyhole } from 'lucide-react'
import Notice from '../components/Notice'
import { LoadingScreen, LoadingSpinner } from '../components/Motion'
import PageIntro from '../components/PageIntro'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { APPLICATION_STATUSES, STATUS_LABELS } from '../types'
import type { ApplicationDocumentRecord, ApplicationRecord } from '../types'

function isDocumentApprovalStatus(value: string): value is ApplicationDocumentRecord['approval_status'] {
  return value === 'pending' || value === 'approved' || value === 'rejected'
}

export default function AdminPage() {
  const [sessionReady, setSessionReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [documents, setDocuments] = useState<Record<string, ApplicationDocumentRecord[]>>({})
  const [documentApprovals, setDocumentApprovals] = useState<Record<string, ApplicationDocumentRecord['approval_status']>>({})
  const [temporaryLinks, setTemporaryLinks] = useState<Record<string, string>>({})
  const [errorText, setErrorText] = useState('')
  const [busy, setBusy] = useState(false)

  const loadApplications = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('applications').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) {
      setErrorText(error.message)
      return
    }
    setApplications(data ?? [])
    if (!data?.length) {
      setDocuments({})
      return
    }
    const { data: documentRows, error: documentError } = await supabase
      .from('application_documents')
      .select('id,application_id,file_name,approval_status,upload_status,created_at')
      .in('application_id', data.map((application) => application.id))
      .order('created_at', { ascending: false })
    if (documentError) {
      setErrorText(documentError.message)
      return
    }
    const byApplication: Record<string, ApplicationDocumentRecord[]> = {}
    for (const document of documentRows ?? []) {
      byApplication[document.application_id] ??= []
      byApplication[document.application_id].push(document)
    }
    setDocuments(byApplication)
    setDocumentApprovals(Object.fromEntries((documentRows ?? []).map((document) => [document.id, document.approval_status])))
  }, [])

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true)
      return
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setErrorText(error.message)
      setSignedIn(Boolean(data.session))
      setSessionReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (signedIn) void loadApplications()
  }, [loadApplications, signedIn])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setErrorText('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErrorText(error.message)
    else setPassword('')
  }

  async function updateApplication(event: FormEvent<HTMLFormElement>, applicationId: string) {
    event.preventDefault()
    if (!supabase) return
    const formData = new FormData(event.currentTarget)
    setBusy(true)
    setErrorText('')
    const { error } = await supabase.functions.invoke('process-application', {
      body: {
        action: 'update',
        application_id: applicationId,
        status: String(formData.get('status')),
        public_remark: String(formData.get('public_remark') ?? '').trim() || null,
        internal_notes: String(formData.get('internal_notes') ?? '').trim() || null,
      },
    })
    setBusy(false)
    if (error) setErrorText(error.message || 'Could not update this application.')
    else await loadApplications()
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) setErrorText(error.message)
  }

  async function openDocument(documentId: string) {
    if (!supabase) return
    const documentWindow = window.open('about:blank', '_blank')
    setErrorText('')
    try {
      const { data, error } = await supabase.functions.invoke('application-documents', {
        body: { action: 'download', document_id: documentId },
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
        setTemporaryLinks((current) => ({ ...current, [documentId]: data.signed_url }))
        window.setTimeout(() => {
          setTemporaryLinks((current) => {
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

  async function updateDocumentApproval(documentId: string) {
    if (!supabase) return
    setBusy(true)
    setErrorText('')
    try {
      const { error } = await supabase.functions.invoke('application-documents', {
        body: {
          action: 'approval',
          document_id: documentId,
          approval_status: documentApprovals[documentId] ?? 'pending',
        },
      })
      if (error) {
        setErrorText(error.message || 'The document review could not be saved.')
        return
      }
      await loadApplications()
    } catch (requestError) {
      setErrorText(requestError instanceof Error ? requestError.message : 'The document review could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  function setDocumentApproval(documentId: string, value: string) {
    if (!isDocumentApprovalStatus(value)) return
    setDocumentApprovals((current) => ({ ...current, [documentId]: value }))
  }

  return <main className="admin-page"><PageIntro label="OWNER ACCESS" title={<>Application<br /><em>management.</em></>} copy="Restricted workspace for authorized owners to review applications and share customer updates." />
    {!isSupabaseConfigured ? <div className="admin-auth form-card"><Notice tone="info">The admin console requires a configured Supabase project.</Notice></div> : !sessionReady ? <LoadingScreen label="Checking owner session" /> : !signedIn ? <form className="admin-auth form-card" onSubmit={signIn}><div className="aside-icon"><LockKeyhole size={18} /></div><h2>Owner sign in</h2>{errorText && <Notice tone="error">{errorText}</Notice>}<label>Email address<input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-gold form-submit" disabled={busy}>{busy ? <LoadingSpinner label="Signing in…" /> : <>Sign in <ArrowRight size={16} /></>}</button><p className="form-note">Owner accounts must be provisioned by a project administrator. Public registration is disabled.</p></form> : <section className="admin-console">
      <div className="admin-toolbar"><div><span className="eyebrow eyebrow-left">OWNER CONSOLE</span><h2>Recent applications</h2></div><button className="button button-outline button-small" onClick={() => void signOut()}>Sign out</button></div>
      {errorText && <Notice tone="error">{errorText}</Notice>}
      {applications.length === 0 ? <div className="catalog-empty"><FileCheck2 size={20} /><b>No applications yet</b><span>New customer applications will appear here.</span></div> : <div className="admin-list">{applications.map((application) => <form className="admin-application" key={application.id} onSubmit={(event) => void updateApplication(event, application.id)}>
        <div className="admin-application-heading"><div><span className="status-id">{application.tracking_id}</span><h3>{application.customer_name}</h3></div><span className={`status-pill status-${application.status}`}>{STATUS_LABELS[application.status]}</span></div>
        <div className="admin-details"><span>{application.service_name_snapshot}</span><a href={`tel:${application.mobile_digits}`}>{application.mobile_digits}</a>{application.email && <a href={`mailto:${application.email}`}>{application.email}</a>}<span>{new Date(application.created_at).toLocaleString('en-IN')}</span></div>
        {application.message && <p className="customer-message">{application.message}</p>}
        {(documents[application.id]?.length ?? 0) > 0 && <div className="admin-document-list"><b>Supporting documents</b>{documents[application.id].map((document) => <div key={document.id}><span>{document.file_name} · {document.approval_status}</span><label className="document-review-status">Review status<select value={documentApprovals[document.id] ?? document.approval_status} onChange={(event) => setDocumentApproval(document.id, event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button className="button button-outline button-small" type="button" disabled={busy} onClick={() => void updateDocumentApproval(document.id)}>Save review</button></label>{document.upload_status === 'available' ? <><button className="text-link" type="button" onClick={() => void openDocument(document.id)}>Create secure download link</button>{temporaryLinks[document.id] && <a className="text-link" href={temporaryLinks[document.id]} target="_blank" rel="noreferrer">Open temporary link</a>}</> : <span>Upload unavailable</span>}</div>)}</div>}
        <div className="admin-edit-grid"><label>Application status<select name="status" defaultValue={application.status}>{APPLICATION_STATUSES.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select></label><label>Customer-visible update<textarea name="public_remark" rows={2} defaultValue={application.public_remark ?? ''} maxLength={1000} /></label><label>Internal notes<textarea name="internal_notes" rows={2} defaultValue={application.internal_notes ?? ''} maxLength={3000} /></label></div>
        <button className="button button-gold button-small" type="submit" disabled={busy}>Save update <Check size={15} /></button>
      </form>)}</div>}
      <p className="admin-security-note"><LockKeyhole size={15} /> Customer updates are visible in tracking. Internal notes remain restricted to authorized owners.</p>
    </section>}
  </main>
}
