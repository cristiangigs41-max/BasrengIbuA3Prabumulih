// Pengganti localApi: menyimpan semua data (akun, produk, keranjang, pesanan) di Supabase.
// Bentuk jawaban sama persis dengan localApi / API Laravel, jadi halaman lain tidak perlu diubah.
import { SUPABASE_URL, SUPABASE_KEY } from './supabaseConfig'
import { fileToDataUrl } from './utils'

const T = 'a3_token', R = 'a3_refresh'
const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch { /* abaikan */ } }
const err = (message, status = 422) => Object.assign(new Error(message), { status })

const baseHeaders = (token) => ({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + (token || SUPABASE_KEY), 'Content-Type': 'application/json' })
const userToken = () => { const t = read(T); return t && !t.startsWith('local:') ? t : null }

async function http(url, init) {
  let res
  try { res = await fetch(url, init) } catch { throw err('Tidak bisa terhubung ke server. Periksa koneksi internet Anda.', 0) }
  const data = await res.json().catch(() => null)
  return { res, data }
}

let refreshing = null
async function refresh() {
  const rt = read(R)
  if (!rt) return false
  refreshing ||= http(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: baseHeaders(), body: JSON.stringify({ refresh_token: rt }) })
    .then(({ res, data }) => { if (res.ok && data?.access_token) { write(T, data.access_token); write(R, data.refresh_token); return true } return false })
    .finally(() => { refreshing = null })
  return refreshing
}

async function rpc(fn, args = {}, retry = true) {
  const { res, data } = await http(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: baseHeaders(userToken()), body: JSON.stringify(args) })
  if (res.ok) return data
  const expired = res.status === 401 || data?.code === 'PGRST301'
  if (expired && retry && read(R) && (await refresh())) return rpc(fn, args, false)
  if (expired) { write(T, null); write(R, null); throw err('Sesi berakhir. Silakan login kembali.', 401) }
  throw err(data?.code === 'P0001' && data.message ? data.message : 'Terjadi kesalahan di server (' + res.status + ').', res.status)
}

const authErr = (data, fallback) => {
  const c = data?.error_code || data?.code
  if (c === 'user_already_exists' || /already registered/i.test(data?.msg || data?.message || '')) return err('Email sudah terdaftar.')
  if (c === 'weak_password') return err('Password terlalu lemah. Gunakan campuran huruf dan angka.')
  if (c === 'over_request_rate_limit' || c === 'over_email_send_rate_limit' || data?.code === 429) return err('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.', 429)
  if (c === 'email_not_confirmed') return err('Email belum dikonfirmasi. Matikan "Confirm email" di Supabase atau cek kotak masuk email.')
  return err(fallback)
}

const body_ = (b, k) => (b instanceof FormData ? b.get(k) : b?.[k])
const imgData = async (f) => (f instanceof File && f.size ? fileToDataUrl(f, 900) : null)

export async function supaApi(path, { method = 'GET', body } = {}) {
  const [p0, qs] = path.split('?')
  const [a, b, c] = p0.split('/').filter(Boolean)
  const q = new URLSearchParams(qs || '')
  const get = (k) => body_(body, k)

  if (a === 'products' && method === 'GET') return rpc('a3_products')

  if (a === 'register') {
    if ((body.name || '').trim().length < 3) throw err('Nama minimal 3 karakter.')
    if (!/^\S+@\S+\.\S+$/.test(body.email || '')) throw err('Email tidak valid.')
    if (!/^[0-9+]{9,15}$/.test(body.phone || '')) throw err('Nomor WhatsApp tidak valid.')
    if ((body.password || '').length < 6) throw err('Password minimal 6 karakter.')
    if (body.password !== body.password_confirmation) throw err('Konfirmasi password tidak sama.')
    // Daftar lewat fungsi database (tanpa email konfirmasi, jadi tidak kena batas kirim email Supabase).
    await rpc('a3_register', { p_name: body.name.trim(), p_email: body.email.trim().toLowerCase(), p_phone: body.phone, p_password: body.password })
    return { message: 'ok' } // pengguna wajib login setelah mendaftar (sesi dari signup tidak dipakai)
  }
  if (a === 'login') {
    const { res, data } = await http(SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: baseHeaders(),
      body: JSON.stringify({ email: (body.email || '').trim().toLowerCase(), password: body.password || '' }) })
    if (!res.ok) throw authErr(data, 'Email atau password salah.')
    write(T, data.access_token); write(R, data.refresh_token)
    return { token: data.access_token, user: await rpc('a3_me') }
  }
  if (a === 'logout') {
    const t = userToken()
    if (t) await http(SUPABASE_URL + '/auth/v1/logout', { method: 'POST', headers: baseHeaders(t) }).catch(() => null)
    write(T, null); write(R, null)
    return { message: 'ok' }
  }
  if (a === 'me') return method === 'PUT' ? rpc('a3_me', { p_name: body.name, p_phone: body.phone ?? null }) : rpc('a3_me')

  if (a === 'cart') {
    if (method === 'POST') return rpc('a3_cart_add', { p_size: Number(body.product_size_id), p_flavor: body.flavor, p_qty: Number(body.qty) || 1 })
    if (b && method === 'PATCH') return rpc('a3_cart_set', { p_item: Number(b), p_qty: Number(body.qty) })
    if (b && method === 'DELETE') return rpc('a3_cart_del', { p_item: Number(b) })
    return rpc('a3_cart')
  }
  if (a === 'orders' && method === 'POST' && c === 'delivery-proof') {
    const f = get('proof'); if (!(f instanceof File)) throw err('Pilih foto bukti pembayaran.')
    return rpc('a3_delivery_proof', { p_order: Number(b), p_proof: await fileToDataUrl(f, 900) })
  }
  if (a === 'orders') return rpc('a3_orders')
  if (a === 'checkout') {
    const proof = body.proof instanceof File ? await fileToDataUrl(body.proof, 900) : null
    return rpc('a3_checkout', { p_phone: body.phone ?? null, p_address: body.address ?? '', p_method: body.payment_method, p_proof: proof,
      p_lat: body.latitude ?? null, p_lng: body.longitude ?? null })
  }

  if (a === 'admin') {
    if (b === 'stats') return rpc('a3_admin_stats')
    if (b === 'orders') return method === 'PATCH' ? rpc('a3_admin_set_status', { p_order: Number(c), p_status: body.status }) : rpc('a3_admin_orders')
    if (b === 'customers') return rpc('a3_admin_customers')
    if (b === 'report') return rpc('a3_admin_report', { p_from: q.get('from'), p_to: q.get('to') })
    if (b === 'categories') {
      if (method === 'GET') return rpc('a3_admin_categories')
      if (method === 'DELETE') return rpc('a3_admin_category_del', { p_id: Number(c) })
      return rpc('a3_admin_category_save', { p_id: c ? Number(c) : null, p_name: body.name })
    }
    if (b === 'products') {
      if (method === 'DELETE') return rpc('a3_admin_product_del', { p_id: Number(c) })
      return rpc('a3_admin_product_save', { p_id: c ? Number(c) : null, p_name: get('name'), p_desc: get('description') || '', p_cat: Number(get('category_id')),
        p_active: get('is_active') === '1' || get('is_active') === 1 || get('is_active') === true, p_image: await imgData(get('image')) })
    }
    if (b === 'sizes') return rpc('a3_admin_size_save', { p_id: Number(c), p_price: Math.max(0, Math.round(Number(body.price))), p_stock: Math.max(0, Math.round(Number(body.stock))) })
  }
  throw err('Endpoint tidak ditemukan.', 404)
}
