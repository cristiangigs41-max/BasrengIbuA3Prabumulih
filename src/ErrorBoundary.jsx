import { Component } from 'react'

// Mencegah layar kosong: bila ada error tampilan, tampilkan pesan dan tombol muat ulang.
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error(error) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ maxWidth: 520, margin: '15vh auto', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Halaman gagal dimuat</h1>
        <p style={{ color: '#555', marginBottom: 20 }}>Terjadi kesalahan saat menampilkan halaman. Muat ulang, atau kembali ke beranda.</p>
        <button onClick={() => location.reload()} style={{ padding: '10px 18px', marginRight: 8, cursor: 'pointer' }}>Muat ulang</button>
        <button onClick={() => { location.hash = '#/'; location.reload() }} style={{ padding: '10px 18px', cursor: 'pointer' }}>Ke beranda</button>
      </div>
    )
  }
}
