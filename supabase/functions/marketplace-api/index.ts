import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
import { checkRateLimit, serviceClient, verifyOwner } from '../_shared/auth.ts'
import { isUuid, normalizeMobile, preflight, response } from '../_shared/http.ts'

type Json = Record<string, unknown>
const MARKETPLACE_FEE = 200
const UPI_VPA = 'mohammadzamanbaba@okicici'
const UPI_PAYEE = "BABA'S CYBER CAFE"

function textValue(value: unknown, min: number, max: number) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max ? value.trim() : null
}
function money(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
function upiUri(amount: number, reference: string) {
  const params = new URLSearchParams({ pa: UPI_VPA, pn: UPI_PAYEE, am: amount.toFixed(2), cu: 'INR', tn: reference })
  return 'upi://pay?' + params.toString()
}
async function userFromRequest(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  if (!token || !url || !key) throw new Error('AUTH_REQUIRED')
  const client = createClient(url, key, {
    global: { headers: { Authorization: 'Bearer ' + token } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) throw new Error('AUTH_REQUIRED')
  return user
}
async function sellerForUser(admin: ReturnType<typeof serviceClient>, userId: string) {
  const { data, error } = await admin.from('marketplace_sellers').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error('SELLER_LOOKUP_FAILED')
  return data
}
async function currentMembership(admin: ReturnType<typeof serviceClient>, sellerId: string) {
  const { data, error } = await admin.from('marketplace_memberships').select('*')
    .eq('seller_id', sellerId).order('period_start', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('MEMBERSHIP_LOOKUP_FAILED')
  return data
}
function canSell(membership: Json | null) {
  return Boolean(membership && (membership.status === 'active' ||
    (membership.status === 'grace' && membership.renewal_grace === true &&
      typeof membership.grace_until === 'string' && new Date(membership.grace_until).getTime() > Date.now())))
}
async function sendEmail(to: string, subject: string, text: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  if (!apiKey || !from || !to) return { sent: false, id: null, warning: 'Email is not configured.' }
  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  })
  const payload = await result.json().catch(() => ({}))
  if (!result.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'Email provider returned ' + result.status + '.')
  return { sent: true, id: typeof payload?.id === 'string' ? payload.id : null }
}
async function recordOrderEvent(admin: ReturnType<typeof serviceClient>, orderId: string, actorId: string | null, action: string, note = '') {
  await admin.from('marketplace_order_events').insert({ order_id: orderId, actor_id: actorId, action, note })
}
async function ownerAudit(admin: ReturnType<typeof serviceClient>, actorId: string, action: string, entityType: string, entityId: string, metadata: Json = {}) {
  await admin.from('admin_audit_logs').insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, metadata })
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  const admin = serviceClient()
  try {
    const raw = await request.text()
    if (raw.length > 16000) return response(request, { error: 'Request is too large.' }, 413)
    const body = (raw ? JSON.parse(raw) : {}) as Json
    const action = typeof body.action === 'string' ? body.action : ''

    if (action === 'categories') {
      const { data, error } = await admin.from('marketplace_categories').select('slug,name,description,sort_order')
        .eq('is_active', true).order('sort_order')
      if (error) throw error
      return response(request, { categories: data ?? [] }, 200, { 'Cache-Control': 'public, max-age=60' })
    }

    if (action === 'list_products' || action === 'get_product') {
      const productId = action === 'get_product' ? body.productId : null
      if (action === 'get_product' && !isUuid(productId)) return response(request, { error: 'Product not found.' }, 404)
      const search = typeof body.search === 'string' ? body.search.trim().slice(0, 80) : ''
      const category = typeof body.category === 'string' ? body.category.trim() : ''
      let query = admin.from('marketplace_products')
        .select('id,seller_id,category_slug,name,description,price,stock,image_url,status,created_at')
        .eq('status', 'published').gt('stock', 0).order('created_at', { ascending: false }).limit(action === 'get_product' ? 1 : 80)
      if (action === 'get_product') query = query.eq('id', productId as string)
      if (category) query = query.eq('category_slug', category)
      if (search) query = query.or('name.ilike.%' + search.replace(/[(),]/g, ' ') + '%,description.ilike.%' + search.replace(/[(),]/g, ' ') + '%')
      const { data, error } = await query
      if (error) throw error
      const sellerIds = [...new Set((data ?? []).map((p) => p.seller_id).filter((id): id is string => Boolean(id)))]
      const [sellersResult, membershipsResult] = sellerIds.length ? await Promise.all([
        admin.from('marketplace_sellers').select('id,store_name,status').in('id', sellerIds),
        admin.from('marketplace_memberships').select('seller_id,status,renewal_grace,grace_until,period_start')
          .in('seller_id', sellerIds).order('period_start', { ascending: false }),
      ]) : [{ data: [], error: null }, { data: [], error: null }]
      if (sellersResult.error || membershipsResult.error) throw new Error('Product catalogue could not be loaded.')
      const sellerMap = new Map((sellersResult.data ?? []).map((s) => [s.id, s]))
      const membershipMap = new Map<string, Json>()
      for (const m of membershipsResult.data ?? []) if (!membershipMap.has(m.seller_id)) membershipMap.set(m.seller_id, m)
      const products = (data ?? []).filter((p) => {
        if (!p.seller_id) return true
        const seller = sellerMap.get(p.seller_id)
        return seller?.status === 'approved' && canSell(membershipMap.get(p.seller_id) ?? null)
      }).map((p) => ({
        ...p,
        sellerName: p.seller_id ? sellerMap.get(p.seller_id)?.store_name ?? 'Approved seller' : UPI_PAYEE,
      }))
      if (action === 'get_product') return products[0]
        ? response(request, { product: products[0] }, 200, { 'Cache-Control': 'public, max-age=30' })
        : response(request, { error: 'Product not found.' }, 404)
      return response(request, { products }, 200, { 'Cache-Control': 'public, max-age=30' })
    }

    if (action === 'create_order') {
      const name = textValue(body.name, 2, 120)
      const mobile = normalizeMobile(body.mobile)
      const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : ''
      const address = body.address && typeof body.address === 'object' ? body.address as Json : null
      const paymentMethod = body.paymentMethod === 'cod' ? 'cod' : body.paymentMethod === 'upi' ? 'upi' : null
      if (!name || !mobile || !address || !paymentMethod ||
        !textValue(address.line1, 5, 300) || !textValue(address.city, 2, 100) ||
        !textValue(address.state, 2, 100) || typeof address.postalCode !== 'string' ||
        !/^[0-9]{6}$/.test(address.postalCode)) {
        return response(request, { error: 'Enter valid customer and delivery details.' }, 400)
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response(request, { error: 'Enter a valid email address.' }, 400)
      if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) return response(request, { error: 'Your cart is empty or contains too many products.' }, 400)
      const allowedItems = body.items.map((item) => ({
        productId: item && typeof item.productId === 'string' ? item.productId : '',
        quantity: Number(item?.quantity),
      }))
      if (allowedItems.some((item) => !isUuid(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
        return response(request, { error: 'Your cart contains an invalid product or quantity.' }, 400)
      }
      if (!(await checkRateLimit(admin, request, 'marketplace-create-order', mobile, 8, 15))) {
        return response(request, { error: 'Too many order attempts. Please wait and try again.' }, 429)
      }
      const { data, error } = await admin.rpc('marketplace_create_orders', {
        p_customer: { name, email, mobile, address: {
          line1: textValue(address.line1, 5, 300), line2: typeof address.line2 === 'string' ? address.line2.slice(0, 200) : '',
          city: textValue(address.city, 2, 100), state: textValue(address.state, 2, 100), postalCode: address.postalCode,
        }},
        p_items: allowedItems,
        p_payment_method: paymentMethod,
      })
      if (error || !data?.orders?.length) {
        console.error('marketplace order creation failed:', error?.message?.slice(0, 180) ?? 'No orders returned')
        return response(request, { error: 'We could not place this order. Please refresh your cart and try again.' }, 409)
      }
      const orders = data.orders as Array<{id:string;orderRef:string;sellerId:string|null;totalAmount:number}>
      if (email) {
        const lines = orders.map((o) => o.orderRef + ': ₹' + Number(o.totalAmount).toFixed(2)).join('\n')
        try {
          await sendEmail(email, "Your BABA'S CYBER CAFE marketplace order", 'Hello ' + name + ',\n\nYour order has been received.\n' + lines + '\n\nUse your order reference and registered mobile number to track your order at https://babacybercafe.in/marketplace/orders.\n\nBABA\'S CYBER CAFE',
            '<p>Hello ' + escapeHtml(name) + ',</p><p>Your marketplace order has been received.</p><ul>' + orders.map((o) => '<li><strong>' + escapeHtml(o.orderRef) + '</strong> — ₹' + Number(o.totalAmount).toFixed(2) + '</li>').join('') + '</ul><p>Track your order at <a href="https://babacybercafe.in/marketplace/orders">BABA\'S CYBER CAFE Marketplace</a>.</p>')
        } catch (e) { console.error('marketplace customer email failed:', e instanceof Error ? e.message.slice(0, 100) : 'unknown') }
      }
      return response(request, { created: true, orders, paymentInstructions: paymentMethod === 'upi' ? 'Pay using UPI and submit the 12-digit UTR from the order tracking page. Payment is confirmed only after owner verification.' : 'Pay the delivery partner in cash when your order arrives.' }, 201, { 'Cache-Control': 'no-store' })
    }

    if (action === 'track_order' || action === 'claim_order_payment') {
      const orderRef = typeof body.orderRef === 'string' ? body.orderRef.trim().toUpperCase() : ''
      const mobile = normalizeMobile(body.mobile)
      if (!/^BCM-[A-Z0-9]{12}$/.test(orderRef) || !mobile) return response(request, { error: 'We could not verify those order details.' }, 404)
      if (!(await checkRateLimit(admin, request, 'marketplace-' + action, orderRef, action === 'track_order' ? 20 : 5, 15))) {
        return response(request, { error: 'Too many attempts. Please wait and try again.' }, 429)
      }
      const { data: order, error } = await admin.from('marketplace_orders')
        .select('id,order_ref,customer_name,customer_mobile,shipping_address,subtotal,delivery_charge,total_amount,payment_method,payment_status,payment_expires_at,claimed_utr,status,carrier,tracking_number,created_at,updated_at')
        .eq('order_ref', orderRef).eq('customer_mobile', mobile).maybeSingle()
      if (error || !order) return response(request, { error: 'We could not verify those order details.' }, 404, { 'Cache-Control': 'no-store' })
      if (action === 'claim_order_payment') {
        const utr = typeof body.utr === 'string' ? body.utr.trim() : ''
        if (!/^[0-9]{12}$/.test(utr)) return response(request, { error: 'Enter a valid 12-digit UPI reference number.' }, 400)
        if (order.payment_method !== 'upi' || order.payment_status !== 'pending') return response(request, { error: 'This order is not awaiting UPI confirmation.' }, 409)
        if (order.payment_expires_at && new Date(order.payment_expires_at).getTime() <= Date.now()) return response(request, { error: 'The UPI payment window has expired. Please contact the seller or place a new order.' }, 409)
        const { data: updated, error: updateError } = await admin.from('marketplace_orders').update({ payment_status: 'claimed', claimed_utr: utr, updated_at: new Date().toISOString() })
          .eq('id', order.id).eq('payment_status', 'pending').select('id').maybeSingle()
        if (updateError || !updated) return response(request, { error: 'Payment confirmation has already been submitted.' }, 409)
        await recordOrderEvent(admin, order.id, null, 'upi_reference_submitted', 'Customer submitted a UPI reference for verification.')
        return response(request, { submitted: true, message: 'Your UPI reference has been received. Payment will be confirmed after verification.' }, 200, { 'Cache-Control': 'no-store' })
      }
      const { data: items } = await admin.from('marketplace_order_items').select('product_name,quantity,unit_price').eq('order_id', order.id)
      return response(request, { order, items: items ?? [] }, 200, { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' })
    }

    if (action === 'register_seller' || action === 'seller_dashboard' || action === 'create_membership_payment' ||
      action === 'claim_membership_payment' || action === 'create_product' || action === 'update_product' ||
      action === 'seller_update_order') {
      const user = await userFromRequest(request)
      const seller = await sellerForUser(admin, user.id)

      if (action === 'register_seller') {
        if (seller) return response(request, { error: 'A seller application already exists for this account.' }, 409)
        const storeName = textValue(body.storeName, 2, 120)
        const legalName = textValue(body.legalName, 2, 160)
        const mobile = normalizeMobile(body.mobile)
        const address = textValue(body.address, 5, 500)
        const city = textValue(body.city, 2, 100)
        const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() : ''
        const businessType = ['individual','proprietorship','partnership','company','cooperative','other'].includes(String(body.businessType)) ? String(body.businessType) : 'individual'
        if (!storeName || !legalName || !mobile || !address || !city || !/^[0-9]{6}$/.test(postalCode) || !user.email) {
          return response(request, { error: 'Complete all required seller application fields.' }, 400)
        }
        if (!(await checkRateLimit(admin, request, 'marketplace-seller-application', user.id, 3, 60))) {
          return response(request, { error: 'Too many applications. Please try again later.' }, 429)
        }
        const { data: newSeller, error: sellerError } = await admin.from('marketplace_sellers').insert({
          user_id: user.id, store_name: storeName, legal_name: legalName, contact_email: user.email,
          mobile, business_type: businessType, address, city, postal_code: postalCode, status: 'pending',
        }).select('id,status').single()
        if (sellerError || !newSeller) throw new Error('SELLER_APPLICATION_FAILED')
        const start = new Date()
        const expiry = new Date(start); expiry.setFullYear(expiry.getFullYear() + 1)
        const grace = new Date(expiry); grace.setDate(grace.getDate() + 15)
        const { error: membershipError } = await admin.from('marketplace_memberships').insert({
          seller_id: newSeller.id, period_start: start.toISOString(), expires_at: expiry.toISOString(),
          grace_until: grace.toISOString(), fee_amount: MARKETPLACE_FEE, paid_amount: 0, status: 'pending',
        })
        if (membershipError) {
          await admin.from('marketplace_sellers').delete().eq('id', newSeller.id)
          throw new Error('SELLER_MEMBERSHIP_FAILED')
        }
        return response(request, { submitted: true, seller: newSeller, annualFee: MARKETPLACE_FEE, message: 'Your seller application has been submitted for owner approval. The annual membership fee is ₹200 with flexible instalments and zero sales commission.' }, 201)
      }

      if (action === 'seller_dashboard' && !seller) return response(request, { seller: null, membership: null, payments: [], products: [], orders: [] }, 200, { 'Cache-Control': 'no-store' })
      if (!seller) return response(request, { error: 'Submit a seller application first.' }, 404)
      const membership = await currentMembership(admin, seller.id)

      if (action === 'seller_dashboard') {
        const [payments, products, orders] = await Promise.all([
          membership ? admin.from('marketplace_membership_payments').select('id,amount,status,claimed_utr,created_at,verified_at').eq('membership_id', membership.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
          admin.from('marketplace_products').select('id,name,category_slug,price,stock,image_url,status,created_at').eq('seller_id', seller.id).order('created_at', { ascending: false }).limit(100),
          admin.from('marketplace_orders').select('id,order_ref,customer_name,customer_email,customer_mobile,shipping_address,total_amount,payment_method,payment_status,status,carrier,tracking_number,created_at').eq('seller_id', seller.id).order('created_at', { ascending: false }).limit(100),
        ])
        if (payments.error || products.error || orders.error) throw new Error('SELLER_DASHBOARD_FAILED')
        const orderIds = (orders.data ?? []).map((order) => order.id)
        const { data: orderItems, error: itemsError } = orderIds.length
          ? await admin.from('marketplace_order_items').select('order_id,product_name,quantity,unit_price').in('order_id', orderIds)
          : { data: [], error: null }
        if (itemsError) throw new Error('SELLER_ORDER_ITEMS_FAILED')
        const itemsByOrder = new Map<string, Array<{product_name:string;quantity:number;unit_price:number}>>()
        for (const item of orderItems ?? []) {
          const group = itemsByOrder.get(item.order_id) ?? []
          group.push({ product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price })
          itemsByOrder.set(item.order_id, group)
        }
        const sellerOrders = (orders.data ?? []).map((order) => ({ ...order, items: itemsByOrder.get(order.id) ?? [] }))
        return response(request, { seller, membership, payments: payments.data ?? [], products: products.data ?? [], orders: sellerOrders }, 200, { 'Cache-Control': 'no-store' })
      }

      if (action === 'create_membership_payment') {
        if (seller.status !== 'approved') return response(request, { error: 'Your seller application must be approved before making membership payments.' }, 403)
        if (!membership) return response(request, { error: 'Seller membership is unavailable.' }, 409)
        const amount = money(body.amount)
        const { data: openPayments, error: openError } = await admin.from('marketplace_membership_payments')
          .select('id,status').eq('membership_id', membership.id).in('status', ['pending','claimed'])
        if (openError) throw openError
        if ((openPayments ?? []).length) return response(request, { error: 'You already have a membership payment awaiting verification. Submit its UTR or wait for owner review.' }, 409)
        const remaining = Math.max(0, Number(membership.fee_amount) - Number(membership.paid_amount))
        if (!Number.isFinite(amount) || amount < 1 || amount > remaining) return response(request, { error: 'Enter an instalment between ₹1 and ₹' + remaining.toFixed(2) + '.' }, 400)
        const { data: payment, error } = await admin.from('marketplace_membership_payments').insert({
          seller_id: seller.id, membership_id: membership.id, amount, payment_method: 'upi', status: 'pending',
        }).select('id,amount,status').single()
        if (error || !payment) throw new Error('MEMBERSHIP_PAYMENT_CREATE_FAILED')
        return response(request, { payment, upiUri: upiUri(amount, 'Seller membership ' + payment.id), payee: UPI_PAYEE, vpa: UPI_VPA }, 201)
      }

      if (action === 'claim_membership_payment') {
        const paymentId = body.paymentId
        const utr = typeof body.utr === 'string' ? body.utr.trim() : ''
        if (!isUuid(paymentId) || !/^[0-9]{12}$/.test(utr)) return response(request, { error: 'Enter a valid payment and 12-digit UPI reference.' }, 400)
        const { data: payment, error } = await admin.from('marketplace_membership_payments').update({ status: 'claimed', claimed_utr: utr, updated_at: new Date().toISOString() })
          .eq('id', paymentId).eq('seller_id', seller.id).eq('status', 'pending').select('id').maybeSingle()
        if (error || !payment) return response(request, { error: 'Payment could not be submitted for verification.' }, 409)
        return response(request, { submitted: true, message: 'Your payment reference has been submitted for owner verification.' })
      }

      if (action === 'create_product' || action === 'update_product') {
        if (seller.status !== 'approved' || !canSell(membership)) return response(request, { error: 'Your seller account and annual membership must be active before you can list products.' }, 403)
        const name = textValue(body.name, 2, 160)
        const description = textValue(body.description, 10, 3000)
        const categorySlug = textValue(body.categorySlug, 2, 48)
        const price = money(body.price)
        const stock = Number(body.stock)
        const imageUrl = textValue(body.imageUrl, 12, 1000)
        const expectedImagePrefix = 'https://dyzyfugxzsdvboxerbxv.supabase.co/storage/v1/object/public/marketplace-product-images/' + user.id + '/'
        if (!name || !description || !categorySlug || !Number.isFinite(price) || price <= 0 || price > 10000000 ||
          !Number.isInteger(stock) || stock < 0 || stock > 100000 || !imageUrl || !imageUrl.startsWith(expectedImagePrefix)) {
          return response(request, { error: 'Enter valid product details and upload an image using the marketplace image uploader.' }, 400)
        }
        const { data: category } = await admin.from('marketplace_categories').select('slug').eq('slug', categorySlug).eq('is_active', true).maybeSingle()
        if (!category) return response(request, { error: 'Select an active product category.' }, 400)
        if (action === 'create_product') {
          const { data: product, error } = await admin.from('marketplace_products').insert({
            seller_id: seller.id, category_slug: categorySlug, name, description, price, stock, image_url: imageUrl, status: 'pending_review',
          }).select('id,name,status').single()
          if (error || !product) throw new Error('PRODUCT_CREATE_FAILED')
          return response(request, { product, message: 'Product submitted for owner review.' }, 201)
        }
        const productId = body.productId
        if (!isUuid(productId)) return response(request, { error: 'Invalid product.' }, 400)
        const { data: product, error } = await admin.from('marketplace_products').update({
          category_slug: categorySlug, name, description, price, stock, image_url: imageUrl,
          status: 'pending_review', updated_at: new Date().toISOString(),
        }).eq('id', productId).eq('seller_id', seller.id).select('id,name,status').maybeSingle()
        if (error || !product) return response(request, { error: 'Product could not be updated.' }, 404)
        return response(request, { product, message: 'Product changes submitted for owner review.' })
      }

      if (action === 'seller_update_order') {
        const orderId = body.orderId
        const nextStatus = String(body.status ?? '')
        const carrier = typeof body.carrier === 'string' ? body.carrier.trim().slice(0, 120) : ''
        const trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim().slice(0, 160) : ''
        if (!isUuid(orderId) || !['confirmed','processing','shipped','delivered','cancelled'].includes(nextStatus)) return response(request, { error: 'Invalid order update.' }, 400)
        if (nextStatus === 'shipped' && (!carrier || !trackingNumber)) return response(request, { error: 'Enter the courier and tracking number before marking an order shipped.' }, 400)
        const { data: existingOrder, error: existingError } = await admin.from('marketplace_orders')
          .select('id,payment_method,payment_status,status').eq('id', orderId).eq('seller_id', seller.id).maybeSingle()
        if (existingError || !existingOrder) return response(request, { error: 'Order could not be found.' }, 404)
        const allowedNext: Record<string, string[]> = { placed: ['confirmed','cancelled'], confirmed: ['processing','cancelled'], processing: ['shipped','cancelled'], shipped: ['delivered'], delivered: [], cancelled: [], returned: [] }
        if (!(allowedNext[existingOrder.status] ?? []).includes(nextStatus)) return response(request, { error: 'This order cannot move to that status.' }, 409)
        if (existingOrder.payment_method === 'upi' && existingOrder.payment_status !== 'paid' && ['confirmed','processing','shipped','delivered'].includes(nextStatus)) {
          return response(request, { error: 'Wait until the owner verifies the UPI payment before processing this order.' }, 409)
        }
        if (nextStatus === 'cancelled') {
          const rejectPayment = existingOrder.payment_method === 'upi' && existingOrder.payment_status === 'pending'
          const { data: cancelled, error: cancelError } = await admin.rpc('marketplace_cancel_order', {
            p_order_id: orderId, p_actor_id: user.id, p_reason: 'Seller cancelled the order.', p_reject_payment: rejectPayment,
          })
          if (cancelError || !cancelled) return response(request, { error: 'This order cannot be cancelled automatically. Ask the owner to review it.' }, 409)
          return response(request, { order: cancelled })
        }
        const { data: order, error } = await admin.from('marketplace_orders').update({
          status: nextStatus, carrier, tracking_number: trackingNumber, updated_at: new Date().toISOString(),
        }).eq('id', orderId).eq('seller_id', seller.id).select('id,order_ref,status').maybeSingle()
        if (error || !order) return response(request, { error: 'Order could not be updated.' }, 404)
        await recordOrderEvent(admin, order.id, user.id, 'seller_' + nextStatus, trackingNumber ? carrier + ': ' + trackingNumber : '')
        return response(request, { order })
      }
    }

    if (action.startsWith('owner_')) {
      const actor = await verifyOwner(request, admin)
      if (action === 'owner_dashboard') {
        const [sellers, memberships, payments, products, orders, reminders] = await Promise.all([
          admin.from('marketplace_sellers').select('id,user_id,store_name,legal_name,contact_email,mobile,city,status,applied_at').order('applied_at', { ascending: false }).limit(200),
          admin.from('marketplace_memberships').select('id,seller_id,period_start,expires_at,grace_until,fee_amount,paid_amount,status,renewal_grace').order('period_start', { ascending: false }).limit(300),
          admin.from('marketplace_membership_payments').select('id,seller_id,membership_id,amount,status,claimed_utr,created_at').order('created_at', { ascending: false }).limit(200),
          admin.from('marketplace_products').select('id,seller_id,name,category_slug,price,stock,status,created_at').order('created_at', { ascending: false }).limit(200),
          admin.from('marketplace_orders').select('id,order_ref,seller_id,customer_name,customer_mobile,total_amount,payment_method,payment_status,claimed_utr,status,carrier,tracking_number,created_at').order('created_at', { ascending: false }).limit(200),
          admin.from('marketplace_membership_reminders').select('id,membership_id,reminder_month,reminder_type,status,sent_at,error_message').order('created_at', { ascending: false }).limit(100),
        ])
        if ([sellers,memberships,payments,products,orders,reminders].some((r) => r.error)) throw new Error('OWNER_DASHBOARD_FAILED')
        const sellerMap = new Map((sellers.data ?? []).map((s) => [s.id, s]))
        return response(request, {
          sellers: sellers.data ?? [],
          memberships: (memberships.data ?? []).map((m) => ({ ...m, sellerName: sellerMap.get(m.seller_id)?.store_name ?? 'Unknown seller' })),
          payments: (payments.data ?? []).map((p) => ({ ...p, sellerName: sellerMap.get(p.seller_id)?.store_name ?? 'Unknown seller' })),
          products: products.data ?? [],
          orders: orders.data ?? [],
          reminders: reminders.data ?? [],
          commissionRate: 0,
          annualSellerFee: MARKETPLACE_FEE,
        }, 200, { 'Cache-Control': 'no-store' })
      }

      if (action === 'owner_create_product') {
        const name = textValue(body.name, 2, 160)
        const description = textValue(body.description, 10, 3000)
        const categorySlug = textValue(body.categorySlug, 2, 48)
        const price = money(body.price)
        const stock = Number(body.stock)
        const imageUrl = textValue(body.imageUrl, 12, 1000)
        if (!name || !description || !categorySlug || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0 || !imageUrl?.startsWith('https://')) {
          return response(request, { error: 'Enter valid product details.' }, 400)
        }
        const { data: product, error } = await admin.from('marketplace_products').insert({
          seller_id: null, category_slug: categorySlug, name, description, price, stock, image_url: imageUrl, status: 'published',
        }).select('id,name,status').single()
        if (error || !product) throw new Error('OWNER_PRODUCT_CREATE_FAILED')
        await ownerAudit(admin, actor.id, 'marketplace_platform_product_created', 'marketplace_product', product.id)
        return response(request, { product }, 201)
      }

      if (action === 'owner_seller_decision') {
        const sellerId = body.sellerId
        const decision = body.decision
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : ''
        if (!isUuid(sellerId) || !['approved','rejected','suspended'].includes(String(decision))) return response(request, { error: 'Invalid seller decision.' }, 400)
        const { data: seller, error } = await admin.from('marketplace_sellers').update({
          status: decision, approved_at: decision === 'approved' ? new Date().toISOString() : null,
          approved_by: decision === 'approved' ? actor.id : null, rejection_reason: reason, updated_at: new Date().toISOString(),
        }).eq('id', sellerId).select('id,store_name,status,contact_email').single()
        if (error || !seller) throw new Error('SELLER_DECISION_FAILED')
        await ownerAudit(admin, actor.id, 'marketplace_seller_' + decision, 'marketplace_seller', sellerId, { reason })
        if (seller.contact_email) {
          try {
            await sendEmail(seller.contact_email, 'Marketplace seller application ' + decision,
              "Your BABA'S CYBER CAFE marketplace seller application is " + decision + '.' + (reason ? ' Note: ' + reason : ''),
              '<p>Your BABA\'S CYBER CAFE marketplace seller application is <strong>' + escapeHtml(String(decision)) + '</strong>.</p>' + (reason ? '<p>' + escapeHtml(reason) + '</p>' : ''))
          } catch (e) { console.error('seller decision email failed:', e instanceof Error ? e.message.slice(0, 100) : 'unknown') }
        }
        return response(request, { seller })
      }

      if (action === 'owner_product_decision') {
        const productId = body.productId
        const decision = body.decision
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : ''
        if (!isUuid(productId) || !['published','rejected','archived'].includes(String(decision))) return response(request, { error: 'Invalid product decision.' }, 400)
        const { data: product, error } = await admin.from('marketplace_products').update({
          status: decision, rejection_reason: reason, updated_at: new Date().toISOString(),
        }).eq('id', productId).select('id,name,status,seller_id').single()
        if (error || !product) throw new Error('PRODUCT_DECISION_FAILED')
        await ownerAudit(admin, actor.id, 'marketplace_product_' + decision, 'marketplace_product', productId, { reason })
        return response(request, { product })
      }

      if (action === 'owner_verify_membership_payment') {
        const paymentId = body.paymentId
        const decision = body.decision
        if (!isUuid(paymentId) || !['verified','rejected'].includes(String(decision))) return response(request, { error: 'Invalid membership payment review.' }, 400)
        if (decision === 'verified' && body.bankStatementVerified !== true) return response(request, { error: 'Confirm that the payment is visible in the bank statement before verification.' }, 400)
        const { data: review, error } = await admin.rpc('marketplace_review_membership_payment', {
          p_payment_id: paymentId,
          p_decision: decision,
          p_actor_id: actor.id,
          p_bank_statement_verified: body.bankStatementVerified === true,
        })
        if (error || !review) return response(request, { error: 'This payment is no longer awaiting review or could not be verified.' }, 409)
        await ownerAudit(admin, actor.id, 'marketplace_membership_payment_' + decision, 'marketplace_membership_payment', paymentId, { review })
        return response(request, { payment: review })
      }

      if (action === 'owner_update_order') {
        const orderId = body.orderId
        if (!isUuid(orderId)) return response(request, { error: 'Invalid order.' }, 400)
        const { data: existingOrder, error: existingOrderError } = await admin.from('marketplace_orders')
          .select('id,payment_method,payment_status,status').eq('id', orderId).maybeSingle()
        if (existingOrderError || !existingOrder) return response(request, { error: 'Order could not be found.' }, 404)
        if (body.status === 'cancelled' || body.paymentStatus === 'rejected') {
          const rejectPayment = existingOrder.payment_method === 'upi' && ['pending','claimed'].includes(existingOrder.payment_status)
          if (body.paymentStatus === 'rejected' && (existingOrder.payment_method !== 'upi' || existingOrder.payment_status !== 'claimed')) return response(request, { error: 'Only a claimed UPI payment can be rejected.' }, 409)
          const { data: cancelled, error: cancelError } = await admin.rpc('marketplace_cancel_order', {
            p_order_id: orderId, p_actor_id: actor.id,
            p_reason: body.paymentStatus === 'rejected' ? 'Owner rejected the UPI payment after review.' : 'Owner cancelled the order.',
            p_reject_payment: rejectPayment,
          })
          if (cancelError || !cancelled) return response(request, { error: 'This order cannot be cancelled automatically. Review its payment and delivery status.' }, 409)
          await ownerAudit(admin, actor.id, 'marketplace_order_cancelled', 'marketplace_order', orderId, { cancelled })
          return response(request, { order: cancelled })
        }
        const patch: Json = { updated_at: new Date().toISOString() }
        if (typeof body.status === 'string' && ['confirmed','processing','shipped','delivered','cancelled','returned'].includes(body.status)) patch.status = body.status
        if (typeof body.paymentStatus === 'string' && ['paid','rejected','cod_paid','refunded'].includes(body.paymentStatus)) {
          if (body.paymentStatus === 'paid' && (body.bankStatementVerified !== true || existingOrder.payment_method !== 'upi' || existingOrder.payment_status !== 'claimed')) return response(request, { error: 'Only a claimed UPI payment can be marked paid after bank statement verification.' }, 409)
          if (body.paymentStatus === 'rejected' && (existingOrder.payment_method !== 'upi' || existingOrder.payment_status !== 'claimed')) return response(request, { error: 'Only a claimed UPI payment can be rejected.' }, 409)
          if (body.paymentStatus === 'cod_paid' && (existingOrder.payment_method !== 'cod' || (body.status !== 'delivered' && existingOrder.status !== 'delivered'))) return response(request, { error: 'COD can be recorded only after delivery.' }, 409)
          if (body.paymentStatus === 'refunded' && !['paid','cod_paid'].includes(existingOrder.payment_status)) return response(request, { error: 'Only a completed payment can be marked refunded.' }, 409)
          patch.payment_status = body.paymentStatus
        }
        if (typeof body.carrier === 'string') patch.carrier = body.carrier.trim().slice(0, 120)
        if (typeof body.trackingNumber === 'string') patch.tracking_number = body.trackingNumber.trim().slice(0, 160)
        const { data: order, error } = await admin.from('marketplace_orders').update(patch).eq('id', orderId)
          .eq('payment_status', existingOrder.payment_status)
          .select('id,order_ref,status,payment_status').single()
        if (error || !order) return response(request, { error: 'Order changed while it was being reviewed. Refresh and try again.' }, 409)
        await recordOrderEvent(admin, order.id, actor.id, 'owner_order_update', JSON.stringify(patch))
        await ownerAudit(admin, actor.id, 'marketplace_order_updated', 'marketplace_order', orderId, patch)
        return response(request, { order })
      }

      return response(request, { error: 'Unsupported owner action.' }, 400)
    }

    return response(request, { error: 'Unsupported marketplace action.' }, 400)
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message === 'AUTH_REQUIRED' || message.includes('Unauthorized') ? 401 :
      message.includes('Owner authorization') ? 403 :
      message.includes('SELLER_') || message.includes('MEMBERSHIP_') ? 400 : 500
    console.error('marketplace-api failed:', status, message.slice(0, 160))
    const safe = status === 401 ? 'Please sign in to continue.' : status === 403 ? 'You are not authorized to perform this action.' :
      status === 400 ? 'The seller or membership request could not be completed.' : 'Marketplace services are temporarily unavailable.'
    return response(request, { error: safe }, status, { 'Cache-Control': 'no-store' })
  }
})
