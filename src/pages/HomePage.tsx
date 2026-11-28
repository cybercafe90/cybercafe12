import { ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, Building2, Clock3, FileCheck2, Landmark, LockKeyhole, Phone, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GoldParticles, LoadingSpinner, ParallaxLayer, Reveal } from '../components/Motion'
import Notice from '../components/Notice'
import { insuranceCategories, WhatsAppEnquiry, WhyChooseUs } from './BusinessPages'
import type { ServiceCategory, ServiceRecord } from '../types'

interface HomePageProps {
  categories: ServiceCategory[]
  services: ServiceRecord[]
  catalogError: string
  isLoading: boolean
}

const departmentIcons = [Landmark, Building2, BriefcaseBusiness, FileCheck2]
const departmentDescriptions = [
  'Assistance with selected revenue services and certificates.',
  'Guidance for selected Srinagar municipal services.',
  'Support with selected transport and labour services.',
  'Help navigating selected central government services.',
]

export default function HomePage({ categories, services, catalogError, isLoading }: HomePageProps) {
  const popularServices = services.filter((service) => service.is_featured).slice(0, 4)

  return (
    <main>
      <section className="hero premium-hero">
        <GoldParticles />
        <ParallaxLayer className="hero-orbit orbit-one" strength={5} /><ParallaxLayer className="hero-orbit orbit-two" strength={-4} />
        <div className="hero-content hero-reveal">
          <div className="eyebrow"><span className="eyebrow-line" /> SRINAGAR · JAMMU & KASHMIR <span className="eyebrow-line" /></div>
          <h1>YOUR TRUSTED<br /><em>DIGITAL SERVICE</em><br />PARTNER</h1>
          <p className="hero-copy">Connecting people with essential services through technology, assistance and convenience.</p>
          <div className="hero-actions">
            <Link className="button button-gold" to="/services">Explore all services <ArrowRight size={16} /></Link>
            <Link className="button button-glass" to="/insurance">Get insurance assistance <ShieldCheck size={16} /></Link>
          </div>
          <div className="hero-meta"><span><span className="live-dot" /> Here to help in Srinagar</span><span className="meta-divider" /><span>Independent · Personal · Local</span></div>
        </div>
        <div className="hero-card hero-card-reveal">
          <div className="hero-card-top"><span className="icon-tile"><ShieldCheck size={21} /></span><span className="card-kicker">A LOCAL PARTNER</span></div>
          <div className="hero-card-title">The right help.<br />A real person.</div>
          <p>Not sure where to begin? Tell us what you need and we’ll help you understand the next step.</p>
          <a className="card-link" href="https://wa.me/917006865909" target="_blank" rel="noreferrer">Talk to our team <ArrowUpRight size={15} /></a>
          <div className="card-watermark"><ShieldCheck size={120} strokeWidth={0.7} /></div>
        </div>
        <a className="hero-scroll" href="#introduction" aria-label="Scroll to learn more"><span>SCROLL TO EXPLORE</span><ArrowDown size={14} /></a>
      </section>

      <Reveal className="section-reveal"><section className="trust-strip">
        <div><BadgeCheck /><span><b>Personal assistance</b><small>Speak with our local team</small></span></div>
        <div><LockKeyhole /><span><b>Private application tracking</b><small>Your status is for you alone</small></span></div>
        <div><Clock3 /><span><b>Clear next steps</b><small>Know what happens next</small></span></div>
      </section></Reveal>

      <Reveal className="section-reveal"><section className="content-section introduction-section" id="introduction">
        <div className="intro-mark"><ShieldCheck size={36} /><span>BBC</span></div>
        <div className="intro-copy"><span className="eyebrow eyebrow-left">BABA'S CYBER CAFE</span><h2>Every service journey<br /><em>starts with a person.</em></h2><p>We help people in Srinagar navigate selected digital services with practical guidance and one-to-one assistance. Whether you are looking for a department service or an insurance enquiry, our team can help you identify a clear next step.</p><Link className="text-link" to="/about">Get to know us <ArrowRight size={15} /></Link></div>
        <div className="intro-aside"><span className="intro-aside-line" /><p>Technology can open the door.<br /><b>Good assistance makes it easier to walk through.</b></p></div>
      </section></Reveal>

      <Reveal className="section-reveal"><section className="insurance-banner">
        <div className="insurance-banner-emblem"><ShieldCheck size={34} /><span>INSURANCE<br />ASSISTANCE</span></div>
        <div className="insurance-banner-copy"><span className="eyebrow eyebrow-left">OUR SPECIALITY — INSURANCE SERVICES</span><h2>Protect what matters<br /><em>most to you.</em></h2><p>Explore insurance assistance for your life, health, vehicle and business with BABA'S CYBER CAFE.</p><div className="insurance-category-chips">{insuranceCategories.slice(0, 4).map(({ name }) => <span key={name}>{name}</span>)}</div></div>
        <div className="insurance-banner-action"><Link className="button button-gold" to="/insurance">Explore insurance <ArrowUpRight size={16} /></Link><span>Independent assistance · Insurer terms apply</span></div>
        <div className="banner-glow" aria-hidden="true" />
      </section></Reveal>

      <Reveal className="section-reveal"><section className="section popular-section" id="popular-services">
        <div className="section-heading"><div><span className="eyebrow eyebrow-left">POPULAR SERVICES</span><h2>Explore services<br /><em>with local guidance.</em></h2></div><p>Browse highlighted published services or explore by department. Highlights are selected from the verified catalogue.</p></div>
        {catalogError ? <Notice tone="error">The service catalogue could not be loaded: {catalogError}</Notice> : isLoading ? <div className="catalog-loading"><LoadingSpinner label="Loading published services" /></div> : popularServices.length ? <div className="popular-grid">{popularServices.map((service, index) => {
          const whatsappMessage = `Hello BABA'S CYBER CAFE, I want to enquire about ${service.name}. Please guide me regarding the application process and service charges.`
          return <Reveal className="stagger-item" delay={index * 80} key={service.id}><article className="popular-card"><span className="popular-card-top"><span>0{index + 1}</span><ArrowUpRight size={16} /></span><h3>{service.name}</h3><p>{service.description ?? service.service_categories?.name ?? 'Digital service assistance'}</p><small>{service.service_categories?.name ?? 'Browse service'}</small><div className="popular-card-actions"><Link to={`/apply?service=${encodeURIComponent(service.id)}`}>Apply <ArrowUpRight size={14} /></Link><a href={`https://wa.me/917006865909?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer">WhatsApp <ArrowUpRight size={14} /></a></div></article></Reveal>
        })}</div> : <div className="catalog-empty"><span className="eyebrow eyebrow-left">VERIFIED SERVICE DIRECTORY</span><b>{services.length ? 'No featured services are published yet.' : 'Service listings are being prepared.'}</b><span>{services.length ? 'Explore all verified services or browse by department.' : 'We publish service records after reviewing the details. Browse departments or contact us for help with your enquiry.'}</span><Link className="text-link" to="/services">Browse the service directory <ArrowRight size={15} /></Link></div>}
        <div className="section-link-row"><Link className="text-link" to="/services">Explore all services <ArrowRight size={15} /></Link></div>
      </section></Reveal>

      <Reveal className="section-reveal"><section className="section departments-section">
        <div className="section-heading"><div><span className="eyebrow eyebrow-left">DEPARTMENT SERVICES</span><h2>Guidance across<br /><em>service categories.</em></h2></div><p>We assist with selected services. The relevant department sets eligibility, requirements and processing.</p></div>
        <div className="department-grid">{(categories.length ? categories.map((category, index) => ({ title: category.name, text: category.description ?? departmentDescriptions[index % departmentDescriptions.length], id: category.id })) : [
          { title: 'Revenue & certificates', text: departmentDescriptions[0], id: 'revenue' },
          { title: 'Municipal services', text: departmentDescriptions[1], id: 'municipal' },
          { title: 'Transport & labour', text: departmentDescriptions[2], id: 'transport' },
          { title: 'Central services', text: departmentDescriptions[3], id: 'central' },
        ]).map(({ title, text, id }, index) => {
          const Icon = departmentIcons[index % departmentIcons.length]
          return <Reveal className="stagger-item" delay={index * 75} key={id}><Link className="department-card" to="/department-services"><span className="department-icon"><Icon size={20} /></span><h3>{title}</h3><p>{text}</p><span className="department-card-link">Explore category <ArrowUpRight size={15} /></span></Link></Reveal>
        })}</div>
        <div className="section-link-row"><Link className="text-link" to="/department-services">See department services <ArrowRight size={15} /></Link></div>
      </section></Reveal>

      <Reveal className="section-reveal"><section className="why-section">
        <div className="section-heading"><div><span className="eyebrow eyebrow-left">WHY BABA'S CYBER CAFE</span><h2>Good service is<br /><em>personal.</em></h2></div><p>We focus on helpful communication, responsible guidance and clear expectations at each step.</p></div>
        <WhyChooseUs />
      </section></Reveal>

      <Reveal className="section-reveal"><section className="journey-section">
        <div className="section-heading journey-heading"><div><span className="eyebrow eyebrow-left">HOW OUR SERVICES WORK</span><h2>A clear path,<br /><em>step by step.</em></h2></div><p>We help you understand the process while the relevant provider remains responsible for its decisions.</p></div>
        <div className="steps-grid">{[['01', 'Tell us what you need', 'Choose a service or describe your request.'], ['02', 'We review the next step', 'Our team follows up if more information is needed.'], ['03', 'Follow your progress', 'Use your private tracking details to check for updates.']].map(([number, title, copy], index) => <Reveal delay={index * 90} key={number}><article><span>{number}</span><h3>{title}</h3><p>{copy}</p></article></Reveal>)}</div>
        <div className="journey-actions"><Link className="button button-gold" to="/apply">Start an application <ArrowRight size={16} /></Link><Link className="text-link" to="/track">Already applied? Track it <ArrowRight size={15} /></Link></div>
      </section></Reveal>

      <Reveal className="section-reveal"><section className="enquiry-section" id="enquiry">
        <div><span className="eyebrow eyebrow-left">CUSTOMER ENQUIRY</span><h2>What would you<br /><em>like help with?</em></h2><p>Send your enquiry to our team on WhatsApp. Please do not include passwords, one-time codes or sensitive identity details.</p><Link className="text-link" to="/contact">More ways to reach us <ArrowRight size={15} /></Link></div>
        <WhatsAppEnquiry />
      </section></Reveal>
      <ContactSection />
    </main>
  )
}

function ContactSection() {
  return <Reveal className="section-reveal"><section className="home-contact-section">
    <div><span className="eyebrow eyebrow-left">SAY HELLO</span><h2>Local help.<br /><em>One message away.</em></h2><p>Serving Srinagar, Jammu & Kashmir. Contact the team for service enquiries and availability.</p></div>
    <div className="home-contact-actions"><a href="tel:+917006865909"><span><Phone size={16} /></span><b>+91 7006865909</b><small>Call our team</small></a><a href="mailto:support@babacybercafe.in"><span>✉</span><b>support@babacybercafe.in</b><small>Send an email</small></a><a href="https://wa.me/917006865909" target="_blank" rel="noreferrer"><span><ArrowUpRight size={16} /></span><b>Message on WhatsApp</b><small>Continue your enquiry</small></a></div>
  </section></Reveal>
}
