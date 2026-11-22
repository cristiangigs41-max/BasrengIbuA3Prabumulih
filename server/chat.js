import fs from 'node:fs'
import path from 'node:path'
// Handler chatbot AI (Node). Dipakai oleh plugin Vite (npm run dev / preview) dan server/chat-server.js.
// Kunci API HANYA dibaca di server dari file .env (ANTHROPIC_API_KEY) — tidak pernah dikirim ke browser.

import { rp, buildSystem, fallbackReply, askFree } from './chatCore.js'
export { buildSystem, fallbackReply, askFree }

export async function handleChat(body, env = process.env) {
  const msgs = Array.isArray(body?.messages) ? body.messages : []
  const clean = msgs
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }))
  while (clean.length && clean[0].role !== 'user') clean.shift()
  if (!clean.length || clean[clean.length - 1].role !== 'user') return { status: 400, json: { message: 'Pesan kosong.' } }
  const last = clean[clean.length - 1].content
  const shop = body.shop || {}
  const key = env.ANTHROPIC_API_KEY
  const system = buildSystem(shop)
  if (key) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 1500, system, messages: clean }),
        signal: AbortSignal.timeout(45000),
      })
      if (!res.ok) throw new Error('AI ' + res.status)
      const data = await res.json()
      const reply = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
      if (!reply) throw new Error('kosong')
      return { status: 200, json: { reply, mode: 'ai' } }
    } catch { /* lanjut ke AI gratis */ }
  }
  try {
    return { status: 200, json: { reply: await askFree(system, clean), mode: 'ai' } }
  } catch {
    return { status: 200, json: { reply: fallbackReply(last, shop), mode: 'offline', needKey: !key } }
  }
}

// Simpan kunci API ke file .env (hanya dari komputer sendiri / localhost).
export function saveKey(key, env) {
  const k = String(key || '').trim()
  if (!/^sk-ant-[\w-]{20,}$/.test(k)) return { status: 400, json: { message: 'Format kunci tidak valid (harus diawali sk-ant-).' } }
  const file = path.join(process.cwd(), '.env')
  let txt = ''
  try { txt = fs.readFileSync(file, 'utf8') } catch { /* belum ada */ }
  txt = /^ANTHROPIC_API_KEY=.*$/m.test(txt) ? txt.replace(/^ANTHROPIC_API_KEY=.*$/m, 'ANTHROPIC_API_KEY=' + k) : txt.replace(/\n*$/, '\n') + 'ANTHROPIC_API_KEY=' + k + '\n'
  fs.writeFileSync(file, txt)
  env.ANTHROPIC_API_KEY = k
  return { status: 200, json: { ok: true } }
}

// Ubah link pendek Google Maps (maps.app.goo.gl) menjadi koordinat. Hanya host Google yang diizinkan.
const COORD = [/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|ll|query|destination|center)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/]
export async function resolveMap(link) {
  let u
  try { u = new URL(String(link)) } catch { return { status: 400, json: { message: 'Link tidak valid.' } } }
  if (u.protocol !== 'https:' || !/^((www|maps)\.)?google\.(com|co\.id)$|^(maps\.app\.)?goo\.gl$/.test(u.hostname)) return { status: 400, json: { message: 'Hanya link Google Maps.' } }
  try {
    const res = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; A3Maps/1.0)', 'accept-language': 'id' }, signal: AbortSignal.timeout(15000) })
    const html = (await res.text()).slice(0, 400000)
    for (const re of COORD) { const m = res.url.match(re) || html.match(re); if (m) return { status: 200, json: { url: res.url, lat: +m[1], lng: +m[2] } } }
    return { status: 200, json: { url: res.url } }
  } catch { return { status: 502, json: { message: 'Gagal membuka link.' } } }
}

// Middleware gaya connect: POST /ai-chat
export function chatMiddleware(env) {
  return (req, res, next) => {
    const url = req.url?.split('?')[0]
    if (url !== '/ai-chat' && url !== '/ai-setup' && url !== '/maps-resolve') return next()
    if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
    let raw = ''
    req.on('data', (c) => { raw += c; if (raw.length > 60000) req.destroy() })
    req.on('end', async () => {
      let body = {}
      try { body = JSON.parse(raw || '{}') } catch { /* body rusak */ }
      const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '')
      const { status, json } = url === '/maps-resolve' ? await resolveMap(body.url) : url === '/ai-setup'
        ? (local ? saveKey(body.key, env) : { status: 403, json: { message: 'Hanya dari komputer ini.' } })
        : await handleChat(body, env)
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(json))
    })
  }
}
