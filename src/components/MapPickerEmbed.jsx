import { useEffect, useState } from 'react'
import Icon from './Icon'
import { AREA, IN_AREA } from '../utils'

// Google Maps embed resmi (tanpa API key), dikunci ke Kota Prabumulih, Sumatera Selatan.
const KEC = ['Prabumulih Barat', 'Prabumulih Timur', 'Prabumulih Utara', 'Prabumulih Selatan', 'Cambai', 'Rambang Kapak Tengah']
const BASE = `${AREA.city}, ${AREA.province}`
function parseMapsText(t) {
  const x = decodeURIComponent(String(t).trim().replace(/\+/g, '%20'))
  const pats = [/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|ll|query|destination|center)=(-?\d{1,3}\.\d+)[, ]+(-?\d{1,3}\.\d+)/, /^\s*(-?\d{1,3}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)\s*$/]
  for (const re of pats) { const m = x.match(re); if (m) return { lat: +m[1], lng: +m[2], name: (x.match(/\/maps\/place\/([^/@]+)/) || [])[1] || '' } }
  return null
}
export const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`
const OUT = `Lokasi di luar area layanan. Pengantaran khusus Kota ${AREA.city}, ${AREA.province}.`

export default function MapPickerEmbed({ value, onChange, onAddress }) {
  const [kec, setKec] = useState('')
  const [q, setQ] = useState(''), [term, setTerm] = useState(''), [gl, setGl] = useState(''), [msg, setMsg] = useState('')
  const ctx = [kec && 'Kecamatan ' + kec, BASE].filter(Boolean).join(', ')

  // ketik ≥ 3 huruf → Google Maps otomatis mencari (tertunda 600 ms)
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim().length >= 3 ? q.trim() : ''), 600); return () => clearTimeout(t) }, [q])

  const query = term && !/^-?\d/.test(term) ? `${term}, ${ctx}` : (term || ctx)
  const submit = (e) => { e.preventDefault(); if (q.trim().length >= 2) { setTerm(q.trim()); onAddress?.(`${q.trim()}, ${ctx}`) } }
  const accept = (hit) => {
    if (!IN_AREA(hit.lat, hit.lng)) return setMsg(OUT)
    setMsg(''); setGl(''); onChange({ lat: +hit.lat.toFixed(6), lng: +hit.lng.toFixed(6) }); setTerm(`${hit.lat},${hit.lng}`)
    onAddress?.(hit.name ? decodeURIComponent(hit.name.replace(/\+/g, ' ')) + `, ${BASE}` : `${hit.lat}, ${hit.lng}`)
  }
  const useLink = async (e) => {
    e.preventDefault()
    const text = gl.trim()
    if (!text) return
    let hit = parseMapsText(text)
    if (!hit && /^https?:\/\//i.test(text)) {
      setMsg('Membaca link Google Maps…')
      try {
        const r = await fetch('/maps-resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: text }) })
        const d = await r.json()
        hit = d.lat != null ? { lat: d.lat, lng: d.lng, name: '' } : null
      } catch { /* di bawah */ }
    }
    if (!hit) return setMsg('Lokasi tidak terbaca. Di Google Maps pilih tempatnya → Bagikan → salin link, atau tekan lama titiknya lalu salin koordinat.')
    accept(hit)
  }
  const locate = () => {
    if (!navigator.geolocation) return setMsg('Browser tidak mendukung lokasi otomatis.')
    setMsg('Mencari lokasi Anda…')
    navigator.geolocation.getCurrentPosition(
      (p) => accept({ lat: p.coords.latitude, lng: p.coords.longitude, name: '' }),
      () => setMsg('Izin lokasi ditolak. Cari alamat di kolom cari.'),
      { enableHighAccuracy: true, timeout: 12000 })
  }

  return (
    <div className="mappick">
      <div className="map-reg">
        <select value="Prabumulih" disabled aria-label="Kota"><option value="Prabumulih">Kota {AREA.city}, {AREA.province}</option></select>
        <select value={kec} onChange={(e) => { setKec(e.target.value); setQ(''); setTerm('') }} aria-label="Kecamatan"><option value="">Semua kecamatan</option>{KEC.map((k) => <option key={k} value={k}>{k}</option>)}</select>
      </div>
      <div className="map-bar">
        <form onSubmit={submit} className="map-search">
          <Icon n="search" s={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cari toko, rumah, jalan, kantor… di ${AREA.city}`} aria-label="Cari lokasi" autoComplete="off" />
        </form>
        <button type="button" className="btn ghost sm" onClick={locate}><Icon n="pin" s={15} />Lokasi saya</button>
      </div>
      {msg && <small className="map-msg">{msg}</small>}
      <iframe className="mapbox" title="Google Maps" loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ border: 0, width: '100%', height: 340 }}
        src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&hl=id&output=embed`} />
      <div className="map-g">
        <b>Sudah ketemu tempatnya? Simpan titiknya</b>
        <small>Klik tempat di peta Google di atas, tekan <i>Bagikan</i>, salin link/koordinatnya ke sini supaya kurir dapat titik yang tepat. Hanya area Kota {AREA.city}.</small>
        <form onSubmit={useLink}>
          <a className="btn ghost sm" href={`https://www.google.com/maps/search/${encodeURIComponent(query)}`} target="_blank" rel="noreferrer"><Icon n="pin" s={15} />Buka di Google Maps</a>
          <input value={gl} onChange={(e) => setGl(e.target.value)} placeholder="Tempel link atau koordinat (mis. -3.4328, 104.2358)" aria-label="Link atau koordinat Google Maps" />
          <button type="submit" className="btn sm" disabled={!gl.trim()}>Gunakan</button>
        </form>
      </div>
      <small className="map-hint">{value ? <>Titik antar tersimpan. <a href={mapsLink(value.lat, value.lng)} target="_blank" rel="noreferrer">Buka di Google Maps</a></> : `Cari alamat di atas (peta Google langsung berubah), lalu tempel link untuk menyimpan titik antar di ${AREA.city}.`}</small>
    </div>
  )
}
