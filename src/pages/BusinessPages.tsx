import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, Building2, CheckCircle2, FileCheck2, Landmark, LockKeyhole, Mail, MessageCircle, Phone, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingSpinner, Reveal } from '../components/Motion'
import Notice from '../components/Notice'
import PageIntro from '../components/PageIntro'
import type { ServiceCategory, ServiceRecord } from '../types'

export const insuranceCategories = [
  { name: 'Life Insurance', detail: 'Enquire about life insurance assistance.' },
  { name: 'Health Insurance', detail: 'Enquire about health insurance assistance.' },
  { name: 'Motor Insurance', detail: 'Enquire about motor insurance assistance.' },
  { name: 'Two-Wheeler Insurance', detail: 'Enquire about two-wheeler insurance assistance.' },
  { name: 'Four-Wheeler Insurance', detail: 'Enquire about four-wheeler insurance assistance.' },
  { name: 'Commercial Vehicle Insurance', detail: 'Enquire about commercial vehicle insurance assistance.' },
  { name: 'Personal Accident Insurance', detail: 'Enquire about personal accident insurance assistance.' },
  { name: 'Travel Insurance', detail: 'Enquire about travel insurance assistance.' },
  { name: 'Home Insurance', detail: 'Enquire about home insurance assistance.' },
  { name: 'Business Insurance', detail: 'Enquire about business insurance assistance.' },
  { name: 'Policy Renewal Assistance', detail: 'Ask about assistance with a policy renewal.' },
  { name: 'Claim Assistance', detail: 'Ask about assistance navigating an insurer claim process.' },
  { name: 'Documentation Assistance', detail: 'Ask about insurance application documentation assistance.' },
  { name: 'Insurance Quotation Enquiries', detail: 'Ask our team about an insurance quotation enquiry.' },
]

const departmentHighlights = [
  { icon: Landmark, title: 'Revenue & certificates', text: 'Assistance navigating selected revenue services and certificate applications.' },
  { icon: Building2, title: 'Municipal services', text: 'Guidance for selected Srinagar Municipal Corporation services.' },
  { icon: BriefcaseBusiness, title: 'Transport & labour', text: 'Support with selected transport, labour and employment services.' },
  { icon: FileCheck2, title: 'Handloom & handicrafts', text: 'Application guidance for selected artisan and craft services.' },
]

export function AboutPage() {
  return <main className="business-page">
    <PageIntro label="ABOUT BABA'S CYBER CAFE" title={<>Technology with<br /><em>a human touch.</em></>} copy="A local digital service assistance provider helping people in Srinagar navigate online applications and service journeys with care." />
    <section className="content-section split-content">
      <Reveal><div><span className="eyebrow eyebrow-left">WHO WE ARE</span><h2>Built around the<br /><em>people we serve.</em></h2></div></Reveal>
      <Reveal delay={90}><div className="prose-copy"><p>BABA'S CYBER CAFE helps customers access and navigate selected digital services. We aim to make the process easier to understand, from identifying a service to keeping track of an application.</p><p>Our role is to provide assistance and guidance. The relevant department, scheme administrator or insurer decides eligibility, processing and outcomes.</p><p>We are based in Srinagar, Jammu & Kashmir. Reach us by phone, email or WhatsApp when you need help finding the right next step.</p><Link className="button button-gold" to="/contact">Talk to our team <ArrowRight size={16} /></Link></div></Reveal>
    </section>
    <section className="content-section values-section">
      <div className="section-heading"><div><span className="eyebrow eyebrow-left">OUR APPROACH</span><h2>Clear guidance.<br /><em>Respect for your time.</em></h2></div><p>We keep communication human and explain what happens next, without promising outcomes that depend on another provider.</p></div>
      <div className="value-grid">{[['Personal assistance', 'Speak with our team when you need help understanding a service.'], ['Clear communication', 'Know what information is needed and what step comes next.'], ['Private by design', 'Application tracking is limited to the details needed to verify your request.']].map(([title, detail], index) => <Reveal delay={index * 80} key={title}><article className="value-card"><span className="department-icon">{index === 0 ? <MessageCircle size={19} /> : index === 1 ? <CheckCircle2 size={19} /> : <LockKeyhole size={19} />}</span><h3>{title}</h3><p>{detail}</p></article></Reveal>)}</div>
    </section>
    <ContactBanner />
  </main>
}

interface ServicesPageProps {
  categories: ServiceCategory[]
  services: ServiceRecord[]
  catalogError: string
  isLoading: boolean
  departmentOnly?: boolean
}

export function ServicesPage({ categories, services, catalogError, isLoading, departmentOnly = false }: ServicesPageProps) {
  const [term, setTerm] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const visibleDepartments = categories.length ? categories.map((category, index) => ({
    icon: departmentHighlights[index % departmentHighlights.length].icon,
    title: category.name,
    text: category.description ?? departmentHighlights[index % departmentHighlights.length].text,
  })) : departmentHighlights
  const categoryServices = useMemo(() => services.filter((service) => categoryId === 'all' || service.category_id === categoryId), [categoryId, services])
  const filteredServices = useMemo(() => {
    const query = term.trim().toLowerCase()
    return categoryServices.filter((service) => !query || `${service.name} ${service.description ?? ''} ${service.service_categories?.name ?? ''}`.toLowerCase().includes(query))
  }, [categoryServices, term])
  return <main className="business-page">
    <PageIntro label={departmentOnly ? 'DEPARTMENT SERVICES' : 'SERVICE DIRECTORY'} title={departmentOnly ? <>Department<br /><em>service assistance.</em></> : <>Find the help<br /><em>you need.</em></>} copy={departmentOnly ? 'Explore available assistance by department. Published services depend on the verified catalogue.' : 'Browse published services or contact us to ask about a service not shown here.'} />
    <section className="content-section directory-section">
      {departmentOnly && <div className="department-directory-grid">{visibleDepartments.map(({ icon: Icon, title, text }, index) => <Reveal delay={index * 75} key={title}><article className="department-directory-card"><span className="department-icon"><Icon size={20} /></span><h2>{title}</h2><p>{text}</p></article></Reveal>)}</div>}
      <div className="directory-tools">
        <label className="search-box"><Search size={17} /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search published services..." aria-label="Search services" /></label>
        <label className="select-box"><span className="sr-only">Filter by department</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">All departments</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><span aria-hidden="true">⌄</span></label>
      </div>
      {catalogError ? <Notice tone="error">The service catalogue could not be loaded: {catalogError}</Notice> : isLoading ? <div className="catalog-loading"><LoadingSpinner label="Loading published services" /></div> : filteredServices.length ? <div className="service-list">{filteredServices.map((service) => {
        const whatsappMessage = `Hello BABA'S CYBER CAFE, I want to enquire about ${service.name}. Please guide me regarding the application process and service charges.`
        return <article className="service-row" key={service.id}><Link className="service-row-details" to={`/apply?service=${encodeURIComponent(service.id)}`}><b>{service.name}</b><small>{service.service_categories?.name ?? 'Digital services'}{service.description ? ` · ${service.description}` : ''}</small></Link><div className="service-row-actions"><Link to={`/apply?service=${encodeURIComponent(service.id)}`} aria-label={`Apply for ${service.name}`}>Apply <ArrowUpRight size={14} /></Link><a href={`https://wa.me/917006865909?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer">WhatsApp <ArrowUpRight size={14} /></a></div></article>
      })}</div> : <div className="catalog-empty"><Sparkles size={20} /><b>{term ? 'No matching published service' : 'The directory is being updated'}</b><span>{term ? 'Try another search or ask our team for guidance.' : 'We publish services after catalogue details have been reviewed. Contact us and we can help you find the right next step.'}</span><Link className="text-link" to="/contact">Contact our team <ArrowRight size={15} /></Link></div>}
      <p className="catalog-note">Service eligibility, document requirements and processing are determined by the relevant department or provider.</p>
    </section>
    <ContactBanner />
  </main>
}

export function InsurancePage() {
  const [searchParams] = useSearchParams()
  const initialCategory = insuranceCategories.some((category) => category.name === searchParams.get('category'))
    ? searchParams.get('category')!
    : insuranceCategories[0].name
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const enquiryForm = useRef<HTMLDivElement>(null)

  function chooseCategory(name: string) {
    setSelectedCategory(name)
    enquiryForm.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' })
  }

  return <main className="business-page insurance-page">
    <section className="insurance-hero">
      <div className="insurance-hero-light insurance-light-one" aria-hidden="true" />
      <div className="insurance-hero-light insurance-light-two" aria-hidden="true" />
      <div className="insurance-hero-copy">
        <span className="insurance-special-label"><span /> OUR SPECIALITY — INSURANCE SERVICES</span>
        <h1>PROTECT WHAT<br /><em>MATTERS MOST</em></h1>
        <p>Explore insurance assistance for your life, health, vehicle and business with BABA'S CYBER CAFE.</p>
        <button className="button button-gold" type="button" onClick={() => enquiryForm.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Start an insurance enquiry <ArrowRight size={16} /></button>
        <small>Independent assistance. Products, terms and decisions belong to insurers.</small>
      </div>
      <div className="insurance-hero-art" aria-hidden="true"><span className="insurance-shield-ring ring-outer" /><span className="insurance-shield-ring ring-inner" /><span className="insurance-shield-core"><ShieldCheck size={76} strokeWidth={1.05} /></span><span className="insurance-orbit-dot dot-top" /><span className="insurance-orbit-dot dot-side" /></div>
    </section>
    <section className="insurance-category-section">
      <div className="section-heading"><div><span className="eyebrow eyebrow-left">PERSONAL INSURANCE ASSISTANCE</span><h2>Choose what you’d<br /><em>like help with.</em></h2></div><p>Choose an enquiry type to prefill the form. We’ll open a WhatsApp conversation so you can speak with our team.</p></div>
      <div className="insurance-page-grid">{insuranceCategories.map((category, index) => <Reveal delay={(index % 7) * 55} variant="scale" key={category.name}><article className={`insurance-page-card${selectedCategory === category.name ? ' selected' : ''}`}><span className="insurance-page-icon"><ShieldCheck size={17} /></span><span className="insurance-page-index">{String(index + 1).padStart(2, '0')}</span><h2>{category.name}</h2><p>{category.detail}</p><button type="button" onClick={() => chooseCategory(category.name)} aria-label={`Select ${category.name}`}>Select enquiry <ArrowUpRight size={15} /></button></article></Reveal>)}</div>
    </section>
    <section className="content-section insurance-page-content">
      <div className="insurance-callout"><span className="insurance-shield"><ShieldCheck size={26} /></span><div><span className="eyebrow eyebrow-left">PERSONAL GUIDANCE</span><h2>Questions about<br /><em>your next step?</em></h2><p>Our team can help you understand the assistance process and direct you to the insurer for product terms, eligibility and decisions.</p></div></div>
      <div className="insurance-enquiry-layout" ref={enquiryForm} id="insurance-enquiry">
        <InsuranceEnquiryForm selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />
        <aside className="insurance-enquiry-aside"><div className="aside-icon"><LockKeyhole size={18} /></div><h2>A direct conversation</h2><p>Your enquiry is not stored on this website. The form opens WhatsApp with the details you choose to include.</p><div className="insurance-whatsapp-direct"><span>Prefer to message us?</span><a href="https://wa.me/917006865909?text=Hello%2C%20I%20would%20like%20insurance%20assistance." target="_blank" rel="noreferrer">Continue on WhatsApp <ArrowUpRight size={15} /></a></div><p className="insurance-sensitive-note">Please do not send passwords, one-time codes, payment details or sensitive identity documents in WhatsApp.</p></aside>
      </div>
      <p className="insurance-disclaimer">BABA'S CYBER CAFE provides independent assistance and does not claim to be an insurer, broker, insurance agent or authorized representative. Insurance products are offered by insurers and are subject to their terms, conditions, eligibility, underwriting and decisions. No policy or claim outcome is guaranteed.</p>
    </section>
  </main>
}

const insuranceEnquiryTypes = [
  'General insurance enquiry',
  'Policy renewal enquiry',
  'Claim assistance enquiry',
  'Documentation assistance enquiry',
  'Insurance quotation enquiry',
]

function InsuranceEnquiryForm({ selectedCategory, onCategoryChange }: { selectedCategory: string; onCategoryChange: (value: string) => void }) {
  const [customerName, setCustomerName] = useState('')
  const [enquiryType, setEnquiryType] = useState(insuranceEnquiryTypes[0])
  const [applicationReference, setApplicationReference] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [whatsAppUrl, setWhatsAppUrl] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = [
      'Hello BABA\'S CYBER CAFE, I would like insurance assistance.',
      `Insurance category: ${selectedCategory}`,
      `Enquiry type: ${enquiryType}`,
      customerName.trim() ? `Name: ${customerName.trim()}` : '',
      applicationReference.trim() ? `Existing application reference: ${applicationReference.trim()}` : '',
      message.trim() ? `Message: ${message.trim()}` : '',
    ].filter(Boolean).join('\n')
    const url = `https://wa.me/917006865909?text=${encodeURIComponent(body)}`
    setError('')
    const popup = window.open(url, '_blank')
    if (popup) {
      popup.opener = null
      setWhatsAppUrl('')
    } else {
      setWhatsAppUrl(url)
    }
  }

  return <form className="insurance-enquiry-form" onSubmit={submit}>
    <span className="eyebrow eyebrow-left">INSURANCE ENQUIRY</span>
    <h2>Tell us what you need.</h2>
    <p>Choose an enquiry type and we’ll prepare a message for WhatsApp.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <label>Insurance category<select value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)}>{insuranceCategories.map(({ name }) => <option value={name} key={name}>{name}</option>)}</select></label>
    <label>How can we assist?<select value={enquiryType} onChange={(event) => setEnquiryType(event.target.value)}>{insuranceEnquiryTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
    <label>Your name <span className="optional">(optional)</span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={100} autoComplete="name" placeholder="Your name" /></label>
    <label>Existing application reference <span className="optional">(optional)</span><input value={applicationReference} onChange={(event) => setApplicationReference(event.target.value)} maxLength={40} placeholder="For example, a tracking reference" /></label>
    <label>Message <span className="optional">(optional)</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={1000} placeholder="Share a little context. Do not include sensitive documents or private credentials." /></label>
    <button className="button button-gold form-submit" type="submit">Continue to WhatsApp <ArrowUpRight size={16} /></button>
    {whatsAppUrl && <a className="insurance-whatsapp-fallback" href={whatsAppUrl} target="_blank" rel="noreferrer">WhatsApp did not open? Continue here <ArrowUpRight size={14} /></a>}
    <small>Your details are only placed in the WhatsApp message you choose to send. This website does not submit or store this enquiry.</small>
  </form>
}

export function ContactPage() {
  return <main className="business-page">
    <PageIntro label="CONTACT US" title={<>We're here<br /><em>to help you.</em></>} copy="Reach the BABA'S CYBER CAFE team in Srinagar with your question or service enquiry." />
    <section className="content-section contact-page-layout">
      <div className="contact-card-grid">
        <a className="contact-detail-card" href="tel:+917006865909"><span className="department-icon"><Phone size={20} /></span><small>CALL OUR TEAM</small><b>+91 7006865909</b><span>Speak with us about your enquiry <ArrowUpRight size={15} /></span></a>
        <a className="contact-detail-card" href="https://wa.me/917006865909" target="_blank" rel="noreferrer"><span className="department-icon"><MessageCircle size={20} /></span><small>WHATSAPP</small><b>Message our team</b><span>Continue your enquiry on WhatsApp <ArrowUpRight size={15} /></span></a>
        <a className="contact-detail-card" href="mailto:support@babacybercafe.in"><span className="department-icon"><Mail size={20} /></span><small>EMAIL</small><b>support@babacybercafe.in</b><span>Send us a message by email <ArrowUpRight size={15} /></span></a>
      </div>
      <WhatsAppEnquiry />
    </section>
    <section className="contact-area-note"><div className="department-icon"><Landmark size={20} /></div><div><h2>Serving Srinagar</h2><p>BABA'S CYBER CAFE is based in Srinagar, Jammu & Kashmir. Contact our team for location and availability details. A street address has not been published here.</p></div></section>
  </main>
}

export function WhatsAppEnquiry() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const enquiry = message.trim()
    if (!enquiry) {
      setError('Write a short message so our team knows how to help.')
      return
    }
    setError('')
    window.open(`https://wa.me/917006865909?text=${encodeURIComponent(enquiry)}`, '_blank', 'noopener,noreferrer')
  }

  return <form className="enquiry-card" onSubmit={submit}>
    <span className="eyebrow eyebrow-left">SEND AN ENQUIRY</span>
    <h2>How can we help?</h2>
    <p>Write a short message and continue the conversation with our team on WhatsApp.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <label className="sr-only" htmlFor="contact-enquiry">Your enquiry</label>
    <textarea id="contact-enquiry" rows={5} maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what you need help with. Please do not include passwords, OTPs, or sensitive document details." />
    <button className="button button-gold" type="submit">Continue to WhatsApp <ArrowUpRight size={15} /></button>
    <small>Your message is opened in WhatsApp. It is not stored on this website.</small>
  </form>
}

function ContactBanner() {
  return <section className="contact-banner"><div><span className="eyebrow eyebrow-left">A QUESTION? A SERVICE TO FIND?</span><h2>Start with a conversation.</h2><p>Our team can help you understand the next step for your enquiry.</p></div><Link className="button button-gold" to="/contact">Contact our team <ArrowRight size={16} /></Link></section>
}

export function PrivacyPage() {
  return <PolicyPage type="privacy" />
}

export function TermsPage() {
  return <PolicyPage type="terms" />
}

function PolicyPage({ type }: { type: 'privacy' | 'terms' }) {
  const privacy = type === 'privacy'
  return <main className="business-page policy-page">
    <PageIntro label={privacy ? 'PRIVACY POLICY' : 'TERMS & CONDITIONS'} title={privacy ? <>Your information,<br /><em>handled with care.</em></> : <>Clear terms for<br /><em>using our services.</em></>} copy={privacy ? 'This notice describes the information used when you contact us or submit an application through this website.' : 'These terms explain the role of BABA’S CYBER CAFE and the conditions for using this website.'} />
    <article className="policy-content">
      {privacy ? <>
        <PolicySection title="Information you provide"><p>When you submit an application, this website may collect your name, mobile number, optional email address, selected department and service, your message, consent record and any optional PDF or image documents you upload. Do not submit passwords, one-time codes, or unnecessary sensitive identity details.</p></PolicySection>
        <PolicySection title="How information is used"><p>Information is used to respond to your enquiry, manage an application, provide its tracking status and communicate relevant updates. Application tracking requires both the tracking ID and the mobile number supplied with the request.</p></PolicySection>
        <PolicySection title="Sharing and service providers"><p>We do not sell your personal information. Information may be processed by the hosting, database, storage, authentication and communication providers needed to operate the service, or shared with a relevant provider when necessary to assist with a request and as permitted by applicable requirements.</p></PolicySection>
        <PolicySection title="Retention and security"><p>Applications and uploaded documents are stored with access controls designed to limit access to the relevant customer and authorized administrators. Information is retained only as needed for service operations and applicable obligations. Uploaded files are not represented as malware-scanned. No internet transmission or storage method can be guaranteed completely secure.</p></PolicySection>
        <PolicySection title="Your choices and contact"><p>You may contact <a href="mailto:support@babacybercafe.in">support@babacybercafe.in</a> with privacy questions or requests concerning information submitted through this website. We may need to verify your identity before responding.</p></PolicySection>
        <PolicySection title="Changes"><p>This notice may be updated as the service changes. The current version will be published on this page.</p></PolicySection>
      </> : <>
        <PolicySection title="Our role"><p>BABA’S CYBER CAFE provides independent digital-service assistance. We are not a government department, scheme administrator, insurer or decision-making authority. We do not represent that an application will be accepted, approved or completed by a third party.</p></PolicySection>
        <PolicySection title="Customer information"><p>You are responsible for providing accurate information and for reviewing details before they are submitted to a relevant department or provider. Do not share passwords or one-time codes through this website or with anyone claiming to act on our behalf.</p></PolicySection>
        <PolicySection title="Applications and tracking"><p>Online enquiries are subject to service availability and review. A tracking ID helps you check the status of an application; keep it private and use the mobile number associated with that application. Status information is an assistance update and does not replace an official department or insurer decision.</p></PolicySection>
        <PolicySection title="Insurance information"><p>Insurance products are provided by insurers, not by BABA’S CYBER CAFE. Product availability, eligibility, policy terms, underwriting and claims are determined by the insurer. Please review official policy documents and consult the insurer for product-specific decisions.</p></PolicySection>
        <PolicySection title="Website use"><p>Use this website lawfully and do not attempt to access another customer’s application or interfere with the website, its data or its security controls. Website content is provided for general service guidance and may be updated without notice.</p></PolicySection>
        <PolicySection title="Contact and updates"><p>For questions about these terms or a service request, contact <a href="mailto:support@babacybercafe.in">support@babacybercafe.in</a> or message us on <a href="https://wa.me/917006865909">WhatsApp</a>. These terms may be updated by publishing a revised version on this page.</p></PolicySection>
      </>}
    </article>
    <ContactBanner />
  </main>
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return <Reveal><section className="policy-section"><h2>{title}</h2>{children}</section></Reveal>
}

export function WhyChooseUs() {
  return <div className="why-grid">{[
    ['Personal assistance', 'Get a real person to help you understand the service journey.'],
    ['A clear next step', 'We explain what may be needed and where your application goes next.'],
    ['Private tracking', 'Check your application status through a private verification flow.'],
  ].map(([title, detail], index) => <Reveal delay={index * 85} key={title}><article className="why-card"><span className="department-icon">{index === 0 ? <BadgeCheck size={19} /> : index === 1 ? <CheckCircle2 size={19} /> : <LockKeyhole size={19} />}</span><h3>{title}</h3><p>{detail}</p></article></Reveal>)}</div>
}
