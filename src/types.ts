export type ApplicationStatus =
  | 'received'
  | 'in_review'
  | 'awaiting_customer'
  | 'submitted'
  | 'completed'
  | 'rejected'

export interface ServiceCategory {
  id: string
  name: string
  slug: string
  description: string | null
}

export interface ServiceRecord {
  id: string
  category_id: string
  name: string
  category: string
  description: string | null
  required_documents: string[]
  eligibility: string | null
  official_portal_url: string | null
  search_keywords: string[]
  is_active: boolean
  is_published: boolean
  is_featured: boolean
  created_at: string
  service_categories?: Pick<ServiceCategory, 'name' | 'slug'> | null
}

export interface ApplicationRecord {
  id: string
  tracking_id: string
  customer_name: string
  mobile_digits: string
  email: string | null
  department_name_snapshot: string
  service_name_snapshot: string
  message: string | null
  consent_at: string
  consent_version: string
  status: ApplicationStatus
  public_remark: string | null
  internal_notes: string | null
  created_at: string
}

export interface ApplicationDocumentRecord {
  id: string
  application_id: string
  file_name: string
  approval_status: 'pending' | 'approved' | 'rejected'
  upload_status: 'pending_upload' | 'available' | 'failed'
  created_at: string
}

export interface TrackingResult {
  tracking_id: string
  service_name: string
  status: ApplicationStatus
  public_remark: string | null
  created_at: string
  documents?: Pick<ApplicationDocumentRecord, 'id' | 'file_name' | 'approval_status'>[]
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'received',
  'in_review',
  'awaiting_customer',
  'submitted',
  'completed',
  'rejected',
]

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  received: 'Received',
  in_review: 'In review',
  awaiting_customer: 'Awaiting your response',
  submitted: 'Submitted to department',
  completed: 'Completed',
  rejected: 'Unable to proceed',
}
