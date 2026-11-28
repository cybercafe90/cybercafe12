import type { ReactNode } from 'react'

interface PageIntroProps {
  label: string
  title: ReactNode
  copy: string
}

export default function PageIntro({ label, title, copy }: PageIntroProps) {
  return <div className="page-intro"><span className="eyebrow eyebrow-left">{label}</span><h1>{title}</h1><p>{copy}</p></div>
}
