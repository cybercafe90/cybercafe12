import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Menu, ShieldCheck, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

interface HeaderProps {
  activePage: string
}

const links = [
  { label: 'Services', href: '/services', page: 'services' },
  { label: 'Insurance', href: '/insurance', page: 'insurance' },
  { label: 'About', href: '/about', page: 'about' },
  { label: 'Track application', href: '/track', page: 'track' },
]
const mobileLinks = [...links, { label: 'Department services', href: '/department-services', page: 'department-services' }, { label: 'Apply for a service', href: '/apply', page: 'apply' }, { label: 'Contact', href: '/contact', page: 'contact' }]

export default function Header({ activePage }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMenuOpen(false), [location.pathname])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <header className={`site-header${menuOpen ? ' menu-is-open' : ''}`}>
      <Link className="brand" to="/" aria-label="BABA'S CYBER CAFE home">
        <span className="brand-mark"><ShieldCheck size={19} /></span>
        <span className="brand-name">BABA'S <b>CYBER CAFE</b><small>SRINAGAR · JAMMU & KASHMIR</small></span>
      </Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map((link) => (
          <Link className={activePage === link.page ? 'active' : ''} to={link.href} key={link.label}>{link.label}</Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link className="button button-outline button-small" to="/apply">Start an application <ArrowRight size={14} /></Link>
        <button className="mobile-menu" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
      <nav className={`mobile-nav${menuOpen ? ' is-open' : ''}`} id="mobile-navigation" aria-label="Mobile navigation" aria-hidden={!menuOpen}>
        {mobileLinks.map((link) => (
          <Link tabIndex={menuOpen ? 0 : -1} to={link.href} key={link.label}>{link.label}<ArrowUpRight size={16} /></Link>
        ))}
        <Link className="mobile-nav-contact" tabIndex={menuOpen ? 0 : -1} to="/privacy">Privacy policy <ArrowUpRight size={15} /></Link>
        <Link className="mobile-nav-contact" tabIndex={menuOpen ? 0 : -1} to="/terms">Terms & conditions <ArrowUpRight size={15} /></Link>
      </nav>
    </header>
  )
}
