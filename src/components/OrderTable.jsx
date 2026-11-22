import { useEffect, useState } from 'react'
import { fdate, rupiah, NEXT_STEP, isCod } from '../utils'
import { mediaUrl } from '../api'
import { Empty } from './AdminUI'
import OrderDetail from './OrderDetail'

export default function OrderTable({ list, onStatus }) {
  const [detail, setDetail] = useState(null)
  const open = detail && list.find((x) => x.id === detail)
  if (!list.length) return <Empty icon="receipt" title="Belum ada pesanan" text="Pesanan yang masuk akan tampil di sini." />
  return (<>
    <div className="tbl-wrap"><table className="tbl tbl-orders"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Item</th><th className="num">Total</th><th>Status</th></tr></thead><tbody>
      {list.map((o) => (
        <tr key={o.id}>
          <td data-label="Pesanan"><b className="code">{o.code}</b><small>{fdate(o.created_at)}</small></td>
          <td data-label="Pelanggan"><b>{o.customer}</b><small>{o.phone}</small>{onStatus && <><small>{o.address}</small><button type="button" className="proof-link od-open" onClick={() => setDetail(o.id)}>Detail &amp; lokasi pembeli</button><small className="pay-l">{o.payment_method} • {o.payment_status}</small>{o.proof && <a className="proof-link" href={mediaUrl(o.proof)} target="_blank" rel="noreferrer">Lihat bukti bayar</a>}</>}</td>
          <td data-label="Item">{o.items.map((it, i) => <small key={i} className="it">{it.qty}× {it.product_name} {it.size_label} ({it.flavor})</small>)}</td>
          <td className="num" data-label="Total"><b>{rupiah(o.total)}</b></td>
          <td data-label="Status">{onStatus ? <StatusActions o={o} onStatus={onStatus} /> : <span className={'st ' + o.status}>{o.status}</span>}</td>
        </tr>
      ))}
    </tbody></table></div>
    {open && <OrderDetail o={open} onClose={() => setDetail(null)} />}
  </>)
}

// Tombol alur status: Proses → Kirim → Selesai (+ Batalkan).
// Transfer/QRIS: admin melihat bukti bayar dulu sebelum "Proses pesanan".
// COD: "Selesai" menunggu foto bukti bayar ke pengantar, admin melihat fotonya dulu lalu menyelesaikan.
// Fotonya tetap bisa dilihat setelah status berubah.
function StatusActions({ o, onStatus }) {
  const [review, setReview] = useState(false)
  const next = NEXT_STEP[o.status]
  const cod = isCod(o)
  const proof = cod ? o.delivery_proof : o.proof
  const label = cod ? 'bukti bayar ke pengantar' : `bukti pembayaran (${o.payment_method})`
  const isFinish = next && next[0] === 'Selesai'
  const isProcess = next && next[0] === 'Diproses'
  const wait = isFinish && cod && !o.delivery_proof
  const needReview = !!proof && ((isFinish && cod) || (isProcess && !cod))
  const cancel = () => { if (window.confirm(`Batalkan pesanan ${o.code}? Stok akan dikembalikan.`)) onStatus(o.id, 'Dibatalkan') }
  const act = () => onStatus(o.id, next[0])
  return (
    <div className="st-act">
      <span className={'st ' + o.status}>{o.status}</span>
      {proof && <button type="button" className="dp-thumb" onClick={() => setReview(true)} aria-label={'Lihat foto ' + label}><img src={mediaUrl(proof)} alt={'Foto ' + label} /><small>{needReview ? 'Foto dari pelanggan, klik untuk cek' : 'Foto ' + (cod ? 'bukti bayar' : 'bukti pembayaran') + ', klik untuk lihat'}</small></button>}
      {next && <button type="button" className="btn sm st-next" disabled={wait} onClick={() => (needReview ? setReview(true) : act())}>{needReview ? (isProcess ? 'Cek bukti & proses' : 'Cek foto & selesaikan') : next[1]}</button>}
      {wait && <small className="st-wait">Menunggu pelanggan upload foto bukti bayar ke pengantar</small>}
      {next && <button type="button" className="st-cancel" onClick={cancel}>Batalkan</button>}
      {review && <ProofReview o={o} img={proof} label={label} okText={isProcess ? 'Bukti sesuai, proses pesanan' : 'Foto sesuai, selesaikan pesanan'} canAct={needReview} onClose={() => setReview(false)} onOk={() => { setReview(false); act() }} />}
    </div>
  )
}

// Admin melihat foto bukti bayar dulu sebelum pesanan diproses/diselesaikan; setelahnya hanya untuk dilihat.
function ProofReview({ o, img, label, okText, canAct, onClose, onOk }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="od-back" onClick={onClose} role="presentation">
      <div className="od pr" role="dialog" aria-modal="true" aria-label={'Cek foto ' + label + ' ' + o.code} onClick={(e) => e.stopPropagation()}>
        <header><div><b className="code">{o.code}</b><small>Foto {label} · {o.status} · {o.customer} · {rupiah(o.total)}</small></div><button className="od-x" onClick={onClose} aria-label="Tutup">×</button></header>
        <div className="od-body pr-body">
          <a href={mediaUrl(img)} target="_blank" rel="noreferrer"><img className="pr-img" src={mediaUrl(img)} alt={'Foto ' + label} /></a>
          {canAct && <p className="pr-note">Periksa fotonya dulu. Pastikan nominalnya sesuai {rupiah(o.total)}, baru lanjutkan.</p>}
          <div className="pr-act"><button type="button" className="btn ghost" onClick={onClose}>Tutup</button>{canAct && <button type="button" className="btn" onClick={onOk}>{okText}</button>}</div>
        </div>
      </div>
    </div>
  )
}
