import { ArrowUpRight, Facebook, Mail, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div>
          <Link className="brand footer-brand" to="/">
            <span className="brand-mark"><span> B </span></span>
            <span className="brand-name">BABA'S <b>CYBER CAFE</b><small>YOUR LOCAL DIGITAL SERVICE DESK</small></span>
          </Link>
          <p>Personal assistance for everyday digital services, right here in Srinagar.</p>
        </div>
        <div className="footer-contact">
          <span className="footer-location">Srinagar, Jammu & Kashmir</span>
          <a href="tel:+917006865909"><Phone size={16} /> +91 70068 65909</a>
          <a href="mailto:support@babacybercafe.in"><Mail size={16} /> support@babacybercafe.in</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} BABA'S CYBER CAFE. All rights reserved.</span>
        <span className="footer-links">
          <a href="https://www.facebook.com/share/1cKyxm9dZ/" target="_blank" rel="noreferrer"><Facebook size={14} /> Facebook</a>
          <a href="https://share.google/0zqTy0GylWp6CnSYO" target="_blank" rel="noreferrer">Google Business <ArrowUpRight size={13} /></a>
          <Link to="/admin">Owner access</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </span>
      </div>
      <p className="disclaimer">BABA'S CYBER CAFE is an independent digital service assistance provider and is not a government office or insurer. Service availability and eligibility are determined by the relevant department or insurer. Insurance is subject to policy terms and conditions.</p>
    </footer>
  )
}
