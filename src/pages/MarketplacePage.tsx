import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Box, CheckCircle2, PackageCheck, Search, ShieldCheck, ShoppingBag, Store, Truck, UserRound, Wallet } from 'lucide-react'
import { callFunction, supabase } from '../lib/supabase'
import './MarketplacePage.css'

type Mode = 'store' | 'seller' | 'admin' | 'orders'
type Props = { mode?: Mode }
type Category = { slug: string; name: string; description: string }
type Product = { id: string; seller_id: string | null; category_slug: string; name: string; description: string; price: number; stock: number; image_url: string; sellerName?: string; status?: string }
type Seller = { id: string; store_name: string; legal_name: string; status: string; contact_email: string; mobile: string; city: string }
type Membership = { id: string; fee_amount: number; paid_amount: number; status: string; expires_at: string; grace_until: string; renewal_grace: boolean }
type MembershipPayment = { id: string; amount: number; status: string; claimed_utr?: string; created_at: string }
type SellerOrder = { id: string; order_ref: string; customer_name: string; customer_email?: string; customer_mobile: string; shipping_address?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string }; items?: Array<{product_name:string;quantity:number;unit_price:number}>; total_amount: number; payment_method: string; payment_status: string; status: string; carrier?: string; tracking_number?: string }
type Dashboard = { seller: Seller | null; membership: Membership | null; payments: MembershipPayment[]; products: Product[]; orders: SellerOrder[] }
type OwnerData = { sellers: Seller[]; memberships: Array<Membership & { sellerName: string; seller_id: string }>; payments: Array<MembershipPayment & { sellerName: string; seller_id: string; membership_id: string }>; products: Product[]; orders: SellerOrder[]; reminders: Array<{ id: string; reminder_month: string; status: string; sent_at: string | null; error_message: string }>; commissionRate: number; annualSellerFee: number }
type CartItem = { product: Product; quantity: number }
type OrderResult = { id: string; orderRef: string; totalAmount: number; paymentMethod: string }

const rupees = (value: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'
const initialSellerForm = { storeName: '', legalName: '', mobile: '', businessType: 'individual', address: '', city: 'Srinagar', postalCode: '' }
const initialProductForm = { name: '', description: '', categorySlug: 'kashmiri-pashmina-shawls', price: '', stock: '1', imageUrl: '' }
const initialCheckout = { name: '', mobile: '', email: '', line1: '', line2: '', city: 'Srinagar', state: 'Jammu and Kashmir', postalCode: '', paymentMethod: 'upi' }
const sellerStatusNext: Record<string, string[]> = { placed: ['confirmed'], confirmed: ['processing'], processing: ['shipped'], shipped: ['delivered'] }

function upiLink(amount: number, reference: string) {
  const params = new URLSearchParams({ pa: 'mohammadzamanbaba@okicici', pn: "BABA'S CYBER CAFE", am: amount.toFixed(2), cu: 'INR', tn: reference })
  return 'upi://pay?' + params.toString()
}
function Status({ value }: { value: string }) {
  const label = value.replaceAll('_', ' ')
  return <span className={'market-status market-status-' + value}>{label}</span>
}
function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="market-section-title"><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>
}
function ErrorText({ value }: { value: string }) { return value ? <p className="market-error" role="alert">{value}</p> : null }

export default function MarketplacePage({ mode = 'store' }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkout, setCheckout] = useState(initialCheckout)
  const [createdOrders, setCreatedOrders] = useState<OrderResult[]>([])
  const [orderRef, setOrderRef] = useState('')
  const [orderMobile, setOrderMobile] = useState('')
  const [tracked, setTracked] = useState<{ order: Record<string, unknown>; items: Array<Record<string, unknown>> } | null>(null)
  const [utr, setUtr] = useState('')
  const [sellerEmail, setSellerEmail] = useState('')
  const [sellerPassword, setSellerPassword] = useState('')
  const [sellerForm, setSellerForm] = useState(initialSellerForm)
  const [sellerDashboard, setSellerDashboard] = useState<Dashboard | null>(null)
  const [sellerAuth, setSellerAuth] = useState(false)
  const [ownerData, setOwnerData] = useState<OwnerData | null>(null)
  const [productForm, setProductForm] = useState(initialProductForm)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [membershipAmount, setMembershipAmount] = useState('20')
  const [membershipUtr, setMembershipUtr] = useState('')
  const [activeMembershipPayment, setActiveMembershipPayment] = useState<{ id: string; amount: number; upiUri: string } | null>(null)
  const [orderShipping, setOrderShipping] = useState<{ orderId: string; status: string; carrier: string; trackingNumber: string } | null>(null)
  const [ownerVerified, setOwnerVerified] = useState(false)
  const [ownerProductForm, setOwnerProductForm] = useState(initialProductForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0), [cart])
  const refreshProducts = useCallback(async () => {
    const [categoryResult, productResult] = await Promise.all([
      callFunction<{ categories: Category[] }>('marketplace-api', { action: 'categories' }),
      callFunction<{ products: Product[] }>('marketplace-api', { action: 'list_products', search, category }),
    ])
    setCategories(categoryResult.categories ?? [])
    setProducts(productResult.products ?? [])
  }, [search, category])

  const refreshSeller = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    if (!data.session) { setSellerAuth(false); setSellerDashboard(null); return }
    setSellerAuth(true)
    const result = await callFunction<Dashboard>('marketplace-api', { action: 'seller_dashboard' }, data.session.access_token)
    setSellerDashboard(result)
  }, [])

  const refreshOwner = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    if (!data.session) { setOwnerVerified(false); setOwnerData(null); return }
    const result = await callFunction<OwnerData>('marketplace-api', { action: 'owner_dashboard' }, data.session.access_token)
    setOwnerData(result)
    setOwnerVerified(true)
  }, [])

  useEffect(() => {
    let alive = true
    void callFunction<{ categories: Category[] }>('marketplace-api', { action: 'categories' })
      .then((result) => { if (alive) setCategories(result.categories ?? []) })
      .catch((reason) => { if (alive && mode !== 'orders') setError(reason instanceof Error ? reason.message : 'Marketplace categories could not be loaded.') })
    return () => { alive = false }
  }, [mode])

  useEffect(() => {
    if (mode !== 'store') return
    let alive = true
    queueMicrotask(() => { void refreshProducts().catch((reason) => { if (alive) setError(reason instanceof Error ? reason.message : 'Marketplace could not be loaded.') }) })
    return () => { alive = false }
  }, [mode, refreshProducts])

  useEffect(() => {
    queueMicrotask(() => {
      if (mode === 'seller') void refreshSeller().catch((reason) => setError(reason instanceof Error ? reason.message : 'Seller dashboard could not be loaded.'))
      if (mode === 'admin') void refreshOwner().catch(() => { setOwnerVerified(false); setOwnerData(null) })
    })
  }, [mode, refreshSeller, refreshOwner])

  function addToCart(product: Product) {
    setCart((current) => {
      const found = current.find((item) => item.product.id === product.id)
      if (found) return current.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(product.stock, item.quantity + 1) } : item)
      return [...current, { product, quantity: 1 }]
    })
    setMessage(product.name + ' added to your cart.')
  }
  function updateQuantity(productId: string, quantity: number) {
    setCart((current) => quantity <= 0 ? current.filter((item) => item.product.id !== productId) : current.map((item) => item.product.id === productId ? { ...item, quantity: Math.min(item.product.stock, quantity) } : item))
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await callFunction<{ created: boolean; orders: OrderResult[]; paymentInstructions: string }>('marketplace-api', {
        action: 'create_order',
        name: checkout.name, mobile: checkout.mobile, email: checkout.email,
        address: { line1: checkout.line1, line2: checkout.line2, city: checkout.city, state: checkout.state, postalCode: checkout.postalCode },
        paymentMethod: checkout.paymentMethod,
        items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      })
      setCreatedOrders(result.orders)
      setCart([])
      setCheckoutOpen(false)
      setMessage(result.paymentInstructions)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your order could not be placed.') }
    finally { setBusy(false) }
  }

  async function trackOrder(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setTracked(null); setMessage('')
    try {
      const result = await callFunction<{ order: Record<string, unknown>; items: Array<Record<string, unknown>> }>('marketplace-api', { action: 'track_order', orderRef, mobile: orderMobile })
      setTracked(result)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Order could not be found.') }
    finally { setBusy(false) }
  }
  async function claimOrderPayment(event: FormEvent) {
    event.preventDefault(); if (!tracked) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await callFunction<{ message: string }>('marketplace-api', { action: 'claim_order_payment', orderRef, mobile: orderMobile, utr })
      setMessage(result.message)
      const refreshed = await callFunction<{ order: Record<string, unknown>; items: Array<Record<string, unknown>> }>('marketplace-api', { action: 'track_order', orderRef, mobile: orderMobile })
      setTracked(refreshed)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'UPI reference could not be submitted.') }
    finally { setBusy(false) }
  }

  async function sellerSignIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase) { setError('Secure seller sign-in is not configured.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: sellerEmail, password: sellerPassword })
      if (authError) throw authError
      await refreshSeller()
      setMessage('Signed in successfully.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign-in failed.') }
    finally { setBusy(false) }
  }
  async function sellerSignUp() {
    if (!supabase) { setError('Secure seller registration is not configured.'); return }
    if (sellerPassword.length < 10) { setError('Use a password with at least 10 characters.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email: sellerEmail, password: sellerPassword })
      if (authError) throw authError
      if (!data.session) { setMessage('Account created. Complete any email confirmation requested by the sign-in service, then sign in here.'); return }
      await refreshSeller()
      setMessage('Seller account created. Complete your seller application below.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Account creation failed.') }
    finally { setBusy(false) }
  }
  async function submitSellerApplication(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await callFunction<{ message: string }>('marketplace-api', { action: 'register_seller', ...sellerForm })
      setMessage(result.message)
      await refreshSeller()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Seller application failed.') }
    finally { setBusy(false) }
  }
  async function createMembershipPayment(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await callFunction<{ payment: { id: string; amount: number }; upiUri: string }>('marketplace-api', { action: 'create_membership_payment', amount: membershipAmount })
      setActiveMembershipPayment({ id: result.payment.id, amount: result.payment.amount, upiUri: result.upiUri })
      setMessage('Membership instalment created. Pay using UPI, then submit the 12-digit UTR below.')
      await refreshSeller()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Membership payment could not be created.') }
    finally { setBusy(false) }
  }
  async function submitMembershipUtr(event: FormEvent) {
    event.preventDefault(); if (!activeMembershipPayment) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await callFunction<{ message: string }>('marketplace-api', { action: 'claim_membership_payment', paymentId: activeMembershipPayment.id, utr: membershipUtr })
      setMessage(result.message); setActiveMembershipPayment(null); setMembershipUtr('')
      await refreshSeller()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Payment reference could not be submitted.') }
    finally { setBusy(false) }
  }
  async function uploadProductImage(file?: File) {
    if (!file || !supabase) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Upload a JPG, PNG or WEBP image up to 5 MB.'); return }
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user.id
    if (!userId) { setError('Sign in before uploading product images.'); return }
    setBusy(true); setError('')
    try {
      const path = userId + '/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const { error: uploadError } = await supabase.storage.from('marketplace-product-images').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('marketplace-product-images').getPublicUrl(path)
      setProductForm((current) => ({ ...current, imageUrl: data.publicUrl }))
      setMessage('Product image uploaded.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Image upload failed.') }
    finally { setBusy(false) }
  }
  async function saveSellerProduct(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await callFunction<{ message: string }>('marketplace-api', { action: editingProductId ? 'update_product' : 'create_product', ...(editingProductId ? { productId: editingProductId } : {}), ...productForm })
      setMessage(result.message); setProductForm(initialProductForm); setEditingProductId(null); await refreshSeller()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Product could not be saved.') }
    finally { setBusy(false) }
  }
  async function updateSellerOrder(order: SellerOrder, status: string) {
    setBusy(true); setError('')
    try {
      await callFunction('marketplace-api', { action: 'seller_update_order', orderId: order.id, status, carrier: orderShipping?.carrier ?? '', trackingNumber: orderShipping?.trackingNumber ?? '' })
      setOrderShipping(null); setMessage('Order status updated.'); await refreshSeller()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Order could not be updated.') }
    finally { setBusy(false) }
  }
  async function ownerAction(payload: Record<string, unknown>) {
    setBusy(true); setError(''); setMessage('')
    try {
      const { data } = await supabase!.auth.getSession()
      await callFunction('marketplace-api', payload, data.session?.access_token)
      setMessage('Marketplace record updated.')
      await refreshOwner()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Owner action failed.') }
    finally { setBusy(false) }
  }
  async function createPlatformProduct(event: FormEvent) {
    event.preventDefault()
    await ownerAction({ action: 'owner_create_product', ...ownerProductForm })
    setOwnerProductForm(initialProductForm)
  }

  if (mode === 'orders') return <main className="content-page market-page"><div className="market-wrap">
    <Link className="market-back" to="/marketplace">← Back to marketplace</Link>
    <SectionTitle eyebrow="CUSTOMER ORDER CENTRE" title="Track your marketplace order" description="Enter the order reference and the mobile number used at checkout." />
    <form className="market-panel market-track-form" onSubmit={trackOrder}>
      <label>Order reference<input required value={orderRef} onChange={(e) => setOrderRef(e.target.value.toUpperCase())} placeholder="BCM-XXXXXXXXXXXX" /></label>
      <label>Registered mobile number<input required value={orderMobile} onChange={(e) => setOrderMobile(e.target.value)} placeholder="+91…" /></label>
      <button className="market-button" disabled={busy}> {busy ? 'Checking…' : 'Track order'} <Search size={16}/></button>
    </form>
    {tracked && <section className="market-panel market-order-result">
      <div className="market-row"><div><span className="market-eyebrow">ORDER REFERENCE</span><h3>{String(tracked.order.order_ref)}</h3></div><Status value={String(tracked.order.status)}/></div>
      <p>Total: <strong>{rupees(String(tracked.order.total_amount))}</strong> · Payment: <Status value={String(tracked.order.payment_status)}/></p>
      <p>Delivery: {String(tracked.order.carrier || 'Seller arranging delivery')} {String(tracked.order.tracking_number || '')}</p>
      <ul>{tracked.items.map((item, i) => <li key={i}>{String(item.product_name)} × {String(item.quantity)} — {rupees(String(item.unit_price))}</li>)}</ul>
      {tracked.order.payment_method === 'upi' && tracked.order.payment_status === 'pending' && <form onSubmit={claimOrderPayment} className="market-inline-form">
        <label>12-digit UPI reference (UTR)<input required inputMode="numeric" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0,12))}/></label>
        <button className="market-button" disabled={busy}>Submit payment reference</button>
      </form>}
    </section>}
    <ErrorText value={error}/><p className="market-notice">{message}</p>
  </div></main>

  if (mode === 'seller') return <main className="content-page market-page"><div className="market-wrap">
    <Link className="market-back" to="/marketplace">← Back to marketplace</Link>
    <SectionTitle eyebrow="SELLER WORKSPACE" title="Open your marketplace store" description="Apply to sell, manage listings, receive orders and track your annual membership." />
    {!sellerAuth ? <section className="market-panel market-auth-grid">
      <form onSubmit={sellerSignIn}><h3><UserRound size={18}/> Seller sign in</h3><label>Email<input required type="email" value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} /></label><label>Password<input required type="password" value={sellerPassword} onChange={(e) => setSellerPassword(e.target.value)} /></label><button className="market-button" disabled={busy}>Sign in</button></form>
      <form onSubmit={(e) => { e.preventDefault(); void sellerSignUp() }}><h3><Store size={18}/> Create seller account</h3><p>Create an account first. Seller applications are reviewed and approved by BABA'S CYBER CAFE.</p><label>Email<input required type="email" value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} /></label><label>Password (10+ characters)<input required minLength={10} type="password" value={sellerPassword} onChange={(e) => setSellerPassword(e.target.value)} /></label><button className="market-button market-button-secondary" disabled={busy}>Create account</button></form>
    </section> : sellerDashboard?.seller ? <>
      <section className="market-panel market-seller-summary">
        <div><span className="market-eyebrow">YOUR STORE</span><h3>{sellerDashboard.seller.store_name}</h3><p>{sellerDashboard.seller.city}</p><Status value={sellerDashboard.seller.status}/></div>
        <div><span className="market-eyebrow">ANNUAL MEMBERSHIP</span><strong>{rupees(200)} / year</strong><p>Paid: {rupees(sellerDashboard.membership?.paid_amount ?? 0)} · Remaining: {rupees(Math.max(0, 200 - Number(sellerDashboard.membership?.paid_amount ?? 0)))}</p><Status value={sellerDashboard.membership?.status ?? 'pending'}/><small>Renewal date: {dateLabel(sellerDashboard.membership?.expires_at)}</small></div>
      </section>
      {sellerDashboard.seller.status === 'pending' && <p className="market-notice">Your seller application is awaiting owner approval. You can prepare your membership instalment, but product listings will remain unavailable until your account and membership are eligible.</p>}
      {sellerDashboard.membership && Number(sellerDashboard.membership.paid_amount) < 200 && <section className="market-panel">
        <h3><Wallet size={18}/> Flexible annual membership payment</h3><p>Annual fee ₹200. Pay the full amount or choose any instalment amount. No sales commission is charged.</p>
        <form className="market-inline-form" onSubmit={createMembershipPayment}><label>Instalment amount (₹)<input type="number" min="1" max={Math.max(1,200-Number(sellerDashboard.membership.paid_amount))} step="0.01" value={membershipAmount} onChange={(e) => setMembershipAmount(e.target.value)}/></label><button className="market-button" disabled={busy}>Create UPI payment</button></form>
        {activeMembershipPayment && <div className="market-payment-callout"><p>Pay {rupees(activeMembershipPayment.amount)} using your UPI app.</p><a className="market-button" href={activeMembershipPayment.upiUri}>Open UPI payment app <ArrowRight size={15}/></a><form className="market-inline-form" onSubmit={submitMembershipUtr}><label>12-digit UPI UTR<input required inputMode="numeric" maxLength={12} value={membershipUtr} onChange={(e) => setMembershipUtr(e.target.value.replace(/\D/g,'').slice(0,12))}/></label><button className="market-button" disabled={busy}>Submit UTR for verification</button></form></div>}
        <div className="market-history">{sellerDashboard.payments.map((p) => <div key={p.id}><span>{dateLabel(p.created_at)} · {rupees(p.amount)}</span><Status value={p.status}/></div>)}</div>
      </section>}
      {sellerDashboard.seller.status === 'approved' && sellerDashboard.membership && (sellerDashboard.membership.status === 'active' || sellerDashboard.membership.status === 'grace') && <section className="market-panel">
        <h3><Box size={18}/> Add a product</h3>
        <form className="market-form-grid" onSubmit={saveSellerProduct}>
          <label>Product name<input required minLength={2} maxLength={160} value={productForm.name} onChange={(e) => setProductForm({...productForm,name:e.target.value})}/></label>
          <label>Category<select value={productForm.categorySlug} onChange={(e) => setProductForm({...productForm,categorySlug:e.target.value})}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
          <label>Price (₹)<input required type="number" min="0.01" step="0.01" value={productForm.price} onChange={(e) => setProductForm({...productForm,price:e.target.value})}/></label>
          <label>Available stock<input required type="number" min="0" step="1" value={productForm.stock} onChange={(e) => setProductForm({...productForm,stock:e.target.value})}/></label>
          <label className="market-full">Description<textarea required minLength={10} maxLength={3000} rows={4} value={productForm.description} onChange={(e) => setProductForm({...productForm,description:e.target.value})}/></label>
          <label className="market-full">Product photo (JPG, PNG or WEBP, max 5 MB)<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void uploadProductImage(e.target.files?.[0])}/></label>
          {productForm.imageUrl && <img className="market-upload-preview" src={productForm.imageUrl} alt="Uploaded product preview"/>}
          <div className="market-full market-form-actions"><button className="market-button" disabled={busy || !productForm.imageUrl}>{editingProductId ? 'Save changes for review' : 'Submit product for approval'}</button>{editingProductId && <button type="button" className="market-outline-button" onClick={() => {setEditingProductId(null);setProductForm(initialProductForm)}}>Cancel edit</button>}</div>
        </form>
      </section>}
      <section className="market-panel"><h3>Your product listings</h3>{sellerDashboard.products.length ? <div className="market-list">{sellerDashboard.products.map((p) => <div key={p.id}><strong>{p.name}</strong><span>{rupees(p.price)} · Stock {p.stock}</span><Status value={p.status ?? 'pending_review'}/><button className="market-small-button" onClick={() => { setEditingProductId(p.id); setProductForm({name:p.name,description:p.description,categorySlug:p.category_slug,price:String(p.price),stock:String(p.stock),imageUrl:p.image_url}) }}>Edit listing</button></div>)}</div> : <p>No products have been submitted yet.</p>}</section>
      <section className="market-panel"><h3><Truck size={18}/> Your orders</h3>{sellerDashboard.orders.length ? <div className="market-list">{sellerDashboard.orders.map((o) => <div key={o.id} className="market-order-row"><div><strong>{o.order_ref}</strong><span>{o.customer_name} · {o.customer_mobile} · {rupees(o.total_amount)}</span><span>{(o.items ?? []).map((item) => item.product_name + ' × ' + item.quantity).join(' · ')}</span><span>{[o.shipping_address?.line1,o.shipping_address?.line2,o.shipping_address?.city,o.shipping_address?.state,o.shipping_address?.postalCode].filter(Boolean).join(', ')}</span><Status value={o.payment_status}/><Status value={o.status}/></div><div className="market-order-controls">{(o.payment_method === 'cod' || o.payment_status === 'paid') && (sellerStatusNext[o.status] ?? []).map((s) => <button key={s} className="market-small-button" onClick={() => setOrderShipping({orderId:o.id,status:s,carrier:o.carrier ?? '',trackingNumber:o.tracking_number ?? ''})}>{s}</button>)}</div>{orderShipping?.orderId===o.id && <div className="market-shipping-edit"><input placeholder="Courier" value={orderShipping.carrier} onChange={(e) => setOrderShipping({...orderShipping,carrier:e.target.value})}/><input placeholder="Tracking number" value={orderShipping.trackingNumber} onChange={(e) => setOrderShipping({...orderShipping,trackingNumber:e.target.value})}/><button className="market-small-button" onClick={() => void updateSellerOrder(o,orderShipping.status)}>Save {orderShipping.status}</button></div>}</div>)}</div> : <p>No customer orders yet.</p>}</section>
      <button className="market-text-button" onClick={async () => { await supabase?.auth.signOut(); setSellerAuth(false); setSellerDashboard(null) }}>Sign out</button>
    </> : <section className="market-panel"><h3><Store size={18}/> Seller application</h3><p>Complete your details to apply. Your account must be approved before products can be listed. Annual membership is ₹200 with flexible instalments and no sales commission.</p><form className="market-form-grid" onSubmit={submitSellerApplication}>
      <label>Store name<input required minLength={2} maxLength={120} value={sellerForm.storeName} onChange={(e) => setSellerForm({...sellerForm,storeName:e.target.value})}/></label>
      <label>Legal name<input required minLength={2} maxLength={160} value={sellerForm.legalName} onChange={(e) => setSellerForm({...sellerForm,legalName:e.target.value})}/></label>
      <label>Mobile number<input required type="tel" value={sellerForm.mobile} onChange={(e) => setSellerForm({...sellerForm,mobile:e.target.value})}/></label>
      <label>Business type<select value={sellerForm.businessType} onChange={(e) => setSellerForm({...sellerForm,businessType:e.target.value})}><option value="individual">Individual</option><option value="proprietorship">Proprietorship</option><option value="partnership">Partnership</option><option value="company">Company</option><option value="cooperative">Cooperative</option><option value="other">Other</option></select></label>
      <label className="market-full">Business address<input required minLength={5} value={sellerForm.address} onChange={(e) => setSellerForm({...sellerForm,address:e.target.value})}/></label>
      <label>City<input required value={sellerForm.city} onChange={(e) => setSellerForm({...sellerForm,city:e.target.value})}/></label>
      <label>PIN code<input required inputMode="numeric" maxLength={6} value={sellerForm.postalCode} onChange={(e) => setSellerForm({...sellerForm,postalCode:e.target.value.replace(/\D/g,'').slice(0,6)})}/></label>
      <button className="market-button market-full" disabled={busy}>Submit seller application</button>
    </form></section>}
    <ErrorText value={error}/><p className="market-notice">{message}</p>
  </div></main>

  if (mode === 'admin') return <main className="content-page market-page"><div className="market-wrap">
    <Link className="market-back" to="/marketplace">← Back to marketplace</Link>
    <SectionTitle eyebrow="OWNER-ONLY WORKSPACE" title="Marketplace administration" description="Approve sellers and products, verify membership payments and oversee orders. Seller earnings are never reduced by commission." />
    {!ownerVerified || !ownerData ? <section className="market-panel"><ShieldCheck size={30}/><h3>Owner sign-in required</h3><p>Sign in using your existing BABA'S CYBER CAFE owner account, then return here.</p><Link className="market-button" to="/admin/login">Open secure owner sign-in <ArrowRight size={16}/></Link><button className="market-text-button" onClick={() => void refreshOwner()}>I have signed in — refresh</button></section> : <>
      <div className="market-stats"><div><span>Approved / registered sellers</span><strong>{ownerData.sellers.length}</strong></div><div><span>Products awaiting review</span><strong>{ownerData.products.filter((p) => p.status === 'pending_review').length}</strong></div><div><span>Membership payments to review</span><strong>{ownerData.payments.filter((p) => p.status === 'claimed').length}</strong></div><div><span>Sales commission</span><strong>₹0</strong></div></div>
      <section className="market-panel"><h3>Seller applications</h3>{ownerData.sellers.map((s) => <div className="market-admin-row" key={s.id}><div><strong>{s.store_name}</strong><span>{s.legal_name} · {s.contact_email} · {s.city}</span><Status value={s.status}/></div>{s.status === 'pending' && <div><button className="market-small-button" onClick={() => void ownerAction({action:'owner_seller_decision',sellerId:s.id,decision:'approved'})}>Approve</button><button className="market-small-button market-danger-button" onClick={() => void ownerAction({action:'owner_seller_decision',sellerId:s.id,decision:'rejected',reason:'Application not approved.'})}>Reject</button></div>}</div>)}</section>
      <section className="market-panel"><h3>Membership instalments</h3>{ownerData.payments.map((p) => <div className="market-admin-row" key={p.id}><div><strong>{p.sellerName} · {rupees(p.amount)}</strong><span>UTR: {p.claimed_utr ?? 'Not submitted'} · {dateLabel(p.created_at)}</span><Status value={p.status}/></div>{p.status === 'claimed' && <div><button className="market-small-button" onClick={() => { if (window.confirm('Confirm this UPI payment is visible in the bank statement?')) void ownerAction({action:'owner_verify_membership_payment',paymentId:p.id,decision:'verified',bankStatementVerified:true}) }}>Verify in bank</button><button className="market-small-button market-danger-button" onClick={() => void ownerAction({action:'owner_verify_membership_payment',paymentId:p.id,decision:'rejected'})}>Reject</button></div>}</div>)}</section>
      <section className="market-panel"><h3>Product moderation</h3>{ownerData.products.map((p) => <div className="market-admin-row" key={p.id}><div><strong>{p.name}</strong><span>{rupees(p.price)} · Stock {p.stock}</span><Status value={p.status ?? 'pending_review'}/></div>{p.status === 'pending_review' && <div><button className="market-small-button" onClick={() => void ownerAction({action:'owner_product_decision',productId:p.id,decision:'published'})}>Publish</button><button className="market-small-button market-danger-button" onClick={() => void ownerAction({action:'owner_product_decision',productId:p.id,decision:'rejected',reason:'Product listing not approved.'})}>Reject</button></div>}</div>)}</section>
      <section className="market-panel"><h3>Platform-owned product</h3><form className="market-form-grid" onSubmit={createPlatformProduct}>
        <label>Product name<input required value={ownerProductForm.name} onChange={(e) => setOwnerProductForm({...ownerProductForm,name:e.target.value})}/></label>
        <label>Category<select value={ownerProductForm.categorySlug} onChange={(e) => setOwnerProductForm({...ownerProductForm,categorySlug:e.target.value})}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
        <label>Price (₹)<input required type="number" min="0.01" step="0.01" value={ownerProductForm.price} onChange={(e) => setOwnerProductForm({...ownerProductForm,price:e.target.value})}/></label>
        <label>Stock<input required type="number" min="0" value={ownerProductForm.stock} onChange={(e) => setOwnerProductForm({...ownerProductForm,stock:e.target.value})}/></label>
        <label className="market-full">Description<textarea required minLength={10} value={ownerProductForm.description} onChange={(e) => setOwnerProductForm({...ownerProductForm,description:e.target.value})}/></label>
        <label className="market-full">Secure image URL (HTTPS)<input required type="url" value={ownerProductForm.imageUrl} onChange={(e) => setOwnerProductForm({...ownerProductForm,imageUrl:e.target.value})}/></label>
        <button className="market-button market-full" disabled={busy}>Publish platform product</button>
      </form></section>
      <section className="market-panel"><h3>Marketplace orders</h3>{ownerData.orders.map((o) => <div className="market-admin-row" key={o.id}><div><strong>{o.order_ref} · {rupees(o.total_amount)}</strong><span>{o.customer_name} · {o.customer_mobile} · {o.payment_method}</span><Status value={o.status}/><Status value={o.payment_status}/></div><div>{o.payment_status === 'claimed' && <button className="market-small-button" onClick={() => { if (window.confirm('Confirm UPI payment against the bank statement?')) void ownerAction({action:'owner_update_order',orderId:o.id,paymentStatus:'paid',bankStatementVerified:true}) }}>Verify UPI</button>}{o.payment_status === 'cod_due' && o.status === 'delivered' && <button className="market-small-button" onClick={() => void ownerAction({action:'owner_update_order',orderId:o.id,paymentStatus:'cod_paid'})}>COD received</button>}</div></div>)}</section>
      <button className="market-text-button" onClick={() => void refreshOwner()}>Refresh dashboard</button>
    </>}
    <ErrorText value={error}/><p className="market-notice">{message}</p>
  </div></main>

  return <main className="content-page market-page"><div className="market-wrap">
    <section className="market-hero">
      <div><span className="market-eyebrow">BABA'S CYBER CAFE PRESENTS</span><h1>Discover something <em>special.</em></h1><p>A trusted marketplace for Kashmiri crafts, handloom, everyday essentials and approved products from local sellers.</p><div className="market-hero-actions"><a href="#market-products" className="market-button">Explore products <ArrowRight size={16}/></a><Link to="/marketplace/seller" className="market-outline-button">Become a seller <Store size={16}/></Link></div></div>
      <div className="market-hero-mark"><ShoppingBag size={72}/><span>SHOP · DISCOVER · TRUST</span><strong>MARKETPLACE</strong></div>
    </section>
    <div className="market-top-actions"><Link to="/marketplace/seller"><Store size={16}/> Seller portal</Link><Link to="/marketplace/orders"><PackageCheck size={16}/> Track order</Link><Link to="/marketplace/admin"><ShieldCheck size={16}/> Owner dashboard</Link><button onClick={() => setCheckoutOpen(true)}><ShoppingBag size={16}/> Cart ({cart.reduce((s,i)=>s+i.quantity,0)}) · {rupees(cartTotal)}</button></div>
    {createdOrders.length > 0 && <section className="market-panel market-success"><CheckCircle2 size={24}/><div><h3>Your order has been placed.</h3><p>Save each order reference. UPI orders remain pending until payment is verified; COD is payable on delivery.</p>{createdOrders.map((o) => <div key={o.id}><strong>{o.orderRef}</strong> · {rupees(o.totalAmount)} {o.paymentMethod === 'upi' && <a href={upiLink(o.totalAmount,o.orderRef)}>Pay by UPI</a>}</div>)}</div></section>}
    <section className="market-category-section"><SectionTitle eyebrow="SHOP BY CATEGORY" title="Find your next favourite" description="Browse products from BABA'S CYBER CAFE and approved independent sellers."/><div className="market-category-pills"><button className={!category?'active':''} onClick={() => setCategory('')}>All products</button>{categories.map((c) => <button key={c.slug} className={category===c.slug?'active':''} onClick={() => setCategory(category===c.slug?'':c.slug)}>{c.name}</button>)}</div></section>
    <section id="market-products" className="market-products-section"><div className="market-products-heading"><SectionTitle eyebrow="THE COLLECTION" title="Marketplace products"/><label className="market-search"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…"/></label></div>
      {products.length ? <div className="market-product-grid">{products.map((p) => <article className="market-product-card" key={p.id}><button className="market-product-image" onClick={() => setSelected(p)}><img src={p.image_url} alt={p.name} loading="lazy"/></button><div className="market-product-copy"><span>{categories.find((c)=>c.slug===p.category_slug)?.name ?? 'Marketplace'}</span><h3>{p.name}</h3><p>{p.sellerName}</p><div><strong>{rupees(p.price)}</strong><small>{p.stock} available</small></div><button className="market-button" onClick={() => addToCart(p)}>Add to cart <ShoppingBag size={15}/></button></div></article>)}</div> : <div className="market-empty"><ShoppingBag size={32}/><h3>No products listed yet</h3><p>New products will appear here after they are added and approved by BABA'S CYBER CAFE.</p><Link to="/marketplace/seller">Apply to become a seller <ArrowRight size={15}/></Link></div>}
    </section>
    <section className="market-trust-strip"><div><ShieldCheck/><strong>Owner-approved sellers</strong><span>Seller applications are reviewed.</span></div><div><Wallet/><strong>Clear payments</strong><span>UPI and Cash on Delivery options.</span></div><div><Truck/><strong>Seller-managed delivery</strong><span>Tracking details shared with customers.</span></div><div><BadgeCheck/><strong>Zero sales commission</strong><span>Sellers keep their product sale proceeds.</span></div></section>
    <footer className="market-footer-note">BABA'S CYBER CAFE Marketplace · Seller membership ₹200 per year · No sales commission · Product and seller eligibility rules apply.</footer>
    <ErrorText value={error}/><p className="market-notice">{message}</p>
  </div>
  {selected && <div className="market-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="market-modal" role="dialog" aria-modal="true" aria-label={selected.name} onClick={(e) => e.stopPropagation()}><button className="market-modal-close" onClick={() => setSelected(null)}>×</button><img src={selected.image_url} alt={selected.name}/><span>{selected.sellerName}</span><h2>{selected.name}</h2><p>{selected.description}</p><strong>{rupees(selected.price)}</strong><button className="market-button" onClick={() => { addToCart(selected); setSelected(null) }}>Add to cart</button></section></div>}
  {checkoutOpen && <div className="market-modal-backdrop" role="presentation" onClick={() => setCheckoutOpen(false)}><section className="market-modal market-checkout-modal" role="dialog" aria-modal="true" aria-label="Checkout" onClick={(e) => e.stopPropagation()}><button className="market-modal-close" onClick={() => setCheckoutOpen(false)}>×</button><h2>Complete your order</h2><div className="market-cart-lines">{cart.map((item) => <div key={item.product.id}><span>{item.product.name} × {item.quantity}</span><strong>{rupees(Number(item.product.price)*item.quantity)}</strong><button onClick={() => updateQuantity(item.product.id,item.quantity-1)}>Remove</button></div>)}</div><h3>Total: {rupees(cartTotal)}</h3><form className="market-form-grid" onSubmit={submitOrder}>
    <label>Name<input required value={checkout.name} onChange={(e) => setCheckout({...checkout,name:e.target.value})}/></label><label>Mobile<input required type="tel" value={checkout.mobile} onChange={(e) => setCheckout({...checkout,mobile:e.target.value})}/></label><label className="market-full">Email (optional)<input type="email" value={checkout.email} onChange={(e) => setCheckout({...checkout,email:e.target.value})}/></label><label className="market-full">Address<input required minLength={5} value={checkout.line1} onChange={(e) => setCheckout({...checkout,line1:e.target.value})}/></label><label>City<input required value={checkout.city} onChange={(e) => setCheckout({...checkout,city:e.target.value})}/></label><label>State<input required value={checkout.state} onChange={(e) => setCheckout({...checkout,state:e.target.value})}/></label><label>PIN code<input required inputMode="numeric" maxLength={6} value={checkout.postalCode} onChange={(e) => setCheckout({...checkout,postalCode:e.target.value.replace(/\D/g,'').slice(0,6)})}/></label><label>Payment<select value={checkout.paymentMethod} onChange={(e) => setCheckout({...checkout,paymentMethod:e.target.value})}><option value="upi">UPI payment</option><option value="cod">Cash on Delivery</option></select></label><p className="market-full market-payment-note">UPI payments are confirmed after owner verification of the UTR. Delivery charges are currently set to ₹0; sellers should include any applicable delivery cost in the listed price.</p><button className="market-button market-full" disabled={busy || !cart.length}>{busy?'Placing order…':'Place order'}</button></form></section></div>}
  </main>
}
