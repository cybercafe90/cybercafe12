import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface NoticeProps {
  tone?: 'success' | 'error' | 'info'
  children: React.ReactNode
}

export default function Notice({ tone = 'info', children }: NoticeProps) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon size={17} /> <span>{children}</span></div>
}
