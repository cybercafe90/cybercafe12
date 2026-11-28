import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, readJson } from '../_shared/http.ts'
import { cleanText, consumeRateLimit, hasAdminRole } from '../_shared/security.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const bucket = 'application-documents'
const maxFileSize = 5 * 1024 * 1024

type SupportedContentType = 'application/pdf' | 'image/jpeg' | 'image/png'

function getContentType(fileName: string, declaredType: string, bytes: Uint8Array): SupportedContentType | null {
  const extension = fileName.toLowerCase().split('.').pop()
  let detectedType: SupportedContentType | null = null
  if (extension === 'pdf' && new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-') detectedType = 'application/pdf'
  if (extension === 'jpg' || extension === 'jpeg') {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) detectedType = 'image/jpeg'
  }
  if (extension === 'png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    if (signature.every((byte, index) => bytes[index] === byte)) detectedType = 'image/png'
  }
  if (declaredType && detectedType !== declaredType) return null
  return detectedType
}

function safeFileName(fileName: string): string {
  const basename = fileName.split(/[\\/]/).pop() ?? ''
  const normalized = basename.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(-120)
  return normalized || 'document'
}

async function findApplication(adminClient: ReturnType<typeof createClient>, trackingId: string, mobile: string) {
  const { data, error } = await adminClient.from('applications')
    .select('id')
    .eq('tracking_id', trackingId)
    .eq('mobile_digits', mobile)
    .maybeSingle()
  if (error) {
    console.error('Could not verify document application:', error.message)
    return { id: null, error: true }
  }
  return { id: data?.id ?? null, error: false }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error('Missing required function secrets for application documents.')
    return jsonResponse({ error: 'Document service is not configured.' }, 500)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const contentTypeHeader = request.headers.get('content-type') ?? ''
  const jsonBody = contentTypeHeader.includes('application/json') ? await readJson(request) : null
  const authorization = request.headers.get('Authorization')
  let userId: string | null = null
  let isAdmin = false
  if (authorization?.startsWith('Bearer ')) {
    const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
    const { data, error } = await userClient.auth.getUser(authorization.slice('Bearer '.length))
    if (!error && data.user) {
      userId = data.user.id
      const role = await hasAdminRole(adminClient, userId)
      if (role.error) {
        console.error(role.error)
        return jsonResponse({ error: 'Could not verify account access.' }, 500)
      }
      isAdmin = role.allowed
    }
  }

  const requestUrl = new URL(request.url)
  const action = requestUrl.searchParams.get('action') || cleanText(jsonBody?.action) || request.headers.get('x-document-action')
  const isDownload = action === 'download'
  const isApproval = action === 'approval'
  const rateLimit = await consumeRateLimit(
    adminClient,
    request,
    isApproval ? 'admin_document_approval' : isDownload ? 'document_download' : 'document_upload',
    isApproval ? 120 : isDownload ? 30 : 10,
    3600,
  )
  if (rateLimit === 'unavailable') return jsonResponse({ error: 'Document security checks are unavailable.' }, 503)
  if (rateLimit === 'limited') return jsonResponse({ error: 'Too many document requests. Please wait and try again.' }, 429)

  if (isApproval) {
    if (!isAdmin || !userId) return jsonResponse({ error: 'Administrator access is required.' }, 403)
    if (!jsonBody) return jsonResponse({ error: 'Invalid document approval request.' }, 400)
    const documentId = cleanText(jsonBody.document_id)
    const approvalStatus = cleanText(jsonBody.approval_status)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
      return jsonResponse({ error: 'Choose a valid document.' }, 400)
    }
    if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
      return jsonResponse({ error: 'Choose a valid approval status.' }, 400)
    }
    const { data, error } = await adminClient.rpc('admin_update_document_approval', {
      p_document_id: documentId,
      p_actor_user_id: userId,
      p_approval_status: approvalStatus,
    })
    if (error) {
      console.error('Could not update document approval:', error.message)
      return jsonResponse({ error: 'The document review could not be saved.' }, 500)
    }
    if (data !== true) return jsonResponse({ error: 'The document could not be reviewed.' }, 404)
    return jsonResponse({ success: true })
  }

  if (isDownload) {
    if (!jsonBody) return jsonResponse({ error: 'Invalid document request.' }, 400)
    const documentId = cleanText(jsonBody.document_id)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
      return jsonResponse({ error: 'Choose a valid document.' }, 400)
    }
    const { data: document, error: documentError } = await adminClient.from('application_documents')
      .select('id,application_id,storage_path,upload_status')
      .eq('id', documentId)
      .maybeSingle()
    if (documentError) {
      console.error('Could not load requested document:', documentError.message)
      return jsonResponse({ error: 'The document could not be loaded.' }, 500)
    }
    if (!document || document.upload_status !== 'available') return jsonResponse({ error: 'The document is unavailable.' }, 404)

    let authorized = isAdmin
    if (!authorized && userId) {
      const { data: application, error } = await adminClient.from('applications')
        .select('id')
        .eq('id', document.application_id)
        .eq('customer_user_id', userId)
        .maybeSingle()
      if (error) {
        console.error('Could not verify customer document access:', error.message)
        return jsonResponse({ error: 'The document could not be authorized.' }, 500)
      }
      authorized = Boolean(application)
    }
    if (!authorized) {
      const trackingId = cleanText(jsonBody.tracking_id).toUpperCase()
      const mobile = cleanText(jsonBody.mobile).replace(/\D/g, '')
      if (!/^BBC-[0-9]{4}-[A-Z0-9]{5}$/.test(trackingId) || !/^[0-9]{10,15}$/.test(mobile)) {
        return jsonResponse({ error: 'Verify the application and mobile number to access this document.' }, 401)
      }
      const application = await findApplication(adminClient, trackingId, mobile)
      if (application.error) return jsonResponse({ error: 'The document could not be authorized.' }, 500)
      authorized = application.id === document.application_id
    }
    if (!authorized) return jsonResponse({ error: 'The document could not be authorized.' }, 403)

    const { data: signedUrl, error: signedUrlError } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(document.storage_path, 60)
    if (signedUrlError || !signedUrl?.signedUrl) {
      console.error('Could not create temporary document link:', signedUrlError?.message)
      return jsonResponse({ error: 'A temporary document link could not be created.' }, 500)
    }
    return jsonResponse({ signed_url: signedUrl.signedUrl, expires_in: 60 })
  }

  if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > maxFileSize + 64_000) {
    return jsonResponse({ error: 'The uploaded file exceeds the allowed size.' }, 413)
  }
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonResponse({ error: 'Use a valid multipart document upload.' }, 400)
  }
  const trackingId = cleanText(formData.get('tracking_id')).toUpperCase()
  const mobile = cleanText(formData.get('mobile')).replace(/\D/g, '')
  const file = formData.get('file')
  if (!/^BBC-[0-9]{4}-[A-Z0-9]{5}$/.test(trackingId) || !/^[0-9]{10,15}$/.test(mobile)) {
    return jsonResponse({ error: 'Verify the application and mobile number before uploading.' }, 401)
  }
  if (!(file instanceof File) || file.size < 1 || file.size > maxFileSize) {
    return jsonResponse({ error: 'Choose a non-empty PDF, JPG, JPEG, or PNG file no larger than 5 MB.' }, 400)
  }

  const application = await findApplication(adminClient, trackingId, mobile)
  if (application.error) return jsonResponse({ error: 'The application could not be verified.' }, 500)
  if (!application.id) return jsonResponse({ error: 'The application could not be verified.' }, 401)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const contentType = getContentType(file.name, file.type, bytes)
  if (!contentType) return jsonResponse({ error: 'The file must be a valid PDF, JPG, JPEG, or PNG document.' }, 400)

  const storagePath = `${application.id}/${crypto.randomUUID()}.${file.name.toLowerCase().split('.').pop()}`
  const { data: reservedDocumentId, error: reserveError } = await adminClient.rpc('reserve_application_document', {
    p_tracking_id: trackingId,
    p_mobile_digits: mobile,
    p_file_name: safeFileName(file.name),
    p_storage_path: storagePath,
    p_content_type: contentType,
    p_file_size_bytes: file.size,
  })
  if (reserveError) {
    console.error('Could not reserve document upload:', reserveError.message)
    return jsonResponse({ error: 'The document could not be prepared for upload.' }, 500)
  }
  if (typeof reservedDocumentId !== 'string') {
    return jsonResponse({ error: 'This application cannot accept any more documents.' }, 409)
  }

  const { error: uploadError } = await adminClient.storage.from(bucket).upload(storagePath, bytes, {
    contentType,
    cacheControl: '0',
    upsert: false,
  })
  if (uploadError) {
    console.error('Private document upload failed:', uploadError.message)
    await adminClient.from('application_documents').delete().eq('id', reservedDocumentId)
    return jsonResponse({ error: 'The document could not be uploaded. Please try again or contact our team.' }, 500)
  }

  const { error: updateError } = await adminClient.from('application_documents')
    .update({ upload_status: 'available' })
    .eq('id', reservedDocumentId)
  if (updateError) {
    console.error('Could not finalize uploaded document:', updateError.message)
    const { error: removeError } = await adminClient.storage.from(bucket).remove([storagePath])
    if (removeError) console.error('Could not remove incomplete document upload:', removeError.message)
    await adminClient.from('application_documents').delete().eq('id', reservedDocumentId)
    return jsonResponse({ error: 'The document could not be saved. Please try again or contact our team.' }, 500)
  }

  const { error: auditError } = await adminClient.from('admin_audit_logs').insert({
    action: 'application_document.uploaded',
    entity_type: 'application_document',
    entity_id: reservedDocumentId,
    metadata: { application_id: application.id, file_size_bytes: file.size, content_type: contentType },
  })
  if (auditError) console.error('Could not record document-upload audit event:', auditError.message)
  return jsonResponse({ success: true, document_id: reservedDocumentId }, 201)
})
