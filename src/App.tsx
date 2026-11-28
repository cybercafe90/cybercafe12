import { Suspense, lazy } from 'react'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Footer from './components/Footer'
import Header from './components/Header'
import { LoadingScreen } from './components/Motion'
import { useServiceCatalog } from './hooks/useServiceCatalog'

const HomePage = lazy(() => import('./pages/HomePage'))
const ApplyPage = lazy(() => import('./pages/ApplyPage'))
const TrackPage = lazy(() => import('./pages/TrackPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AboutPage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.AboutPage })))
const ServicesPage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.ServicesPage })))
const InsurancePage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.InsurancePage })))
const ContactPage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.ContactPage })))
const PrivacyPage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.TermsPage })))

function NotFoundPage() {
  return <main className="form-page"><div className="page-intro"><span className="eyebrow eyebrow-left">PAGE NOT FOUND</span><h1>Let's get you<br /><em>back on track.</em></h1><p>This page may have moved. Return to the homepage or contact our team for help.</p><a className="button button-gold" href="/">Go to homepage <ArrowRight size={16} /></a></div></main>
}

export default function App() {
  const location = useLocation()
  const page = location.pathname === '/' ? 'home' : location.pathname.slice(1)
  const { categories, services, error, isLoading } = useServiceCatalog()

  return (
    <div className="app-shell min-h-screen bg-cafe-ink text-cafe-cream">
      <Header activePage={page} />
      <div key={location.pathname} className="page-transition">
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<HomePage categories={categories} services={services} catalogError={error} isLoading={isLoading} />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/services" element={<ServicesPage categories={categories} services={services} catalogError={error} isLoading={isLoading} />} />
            <Route path="/department-services" element={<ServicesPage categories={categories} services={services} catalogError={error} isLoading={isLoading} departmentOnly />} />
            <Route path="/insurance" element={<InsurancePage />} />
            <Route path="/apply" element={<ApplyPage categories={categories} services={services} />} />
            <Route path="/track" element={<TrackPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>
      <Footer />
      <a className="whatsapp-float" href="https://wa.me/917006865909" target="_blank" rel="noreferrer" aria-label="Contact us on WhatsApp"><MessageCircle size={21} /></a>
    </div>
  )
}
