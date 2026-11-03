import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabase.js'
import { MARCA } from './marca.js'

const fondo = 'radial-gradient(700px 420px at 10% -10%, rgba(147,197,253,0.7), transparent 60%), linear-gradient(160deg, #eaf2ff 0%, #bfd6fb 100%)'
const vidrio = { background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 24, boxShadow: '0 20px 40px -18px rgba(37,99,235,0.45)', padding: 22 }

// Página pública para que cada empleado marque ingreso y egreso desde el celular (enlace personal)
export default function Marcar() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [cliente, setCliente] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('marcacion_info', { p_token: token })
    if (e) { setError('El sistema de marcación todavía no está habilitado. Avisá a administración.'); return }
    setInfo(data)
    if (data?.ok && data.clientes?.length === 1) setCliente(data.clientes[0].id)
    if (data?.abierta?.cliente_id) setCliente(data.abierta.cliente_id)
  }, [token])
  useEffect(() => { cargar() }, [cargar])

  const ubicacion = () => new Promise(res => {
    if (!navigator.geolocation) return res({})
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { timeout: 6000, maximumAge: 60000 })
  })

  const marcar = async () => {
    if (!info.abierta && info.clientes.length > 1 && !cliente) return setError('Elegí dónde estás trabajando.')
    setEnviando(true); setError(''); setResultado(null)
    const { lat, lng } = await ubicacion()
    const { data, error: e } = await supabase.rpc('marcar_asistencia', { p_token: token, p_cliente: cliente || null, p_lat: lat ?? null, p_lng: lng ?? null })
    setEnviando(false)
    if (e || !data?.ok) return setError(data?.error || 'No se pudo registrar. Probá de nuevo.')
    setResultado(data); cargar()
  }

  const base = { minHeight: '100vh', background: fondo, padding: '24px 16px', fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif", display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }
  if (error && !info) return <div style={base}><div style={{ ...vidrio, maxWidth: 420, width: '100%', textAlign: 'center', color: '#be123c' }}>{error}</div></div>
  if (!info) return <div style={base}><div style={{ ...vidrio, maxWidth: 420, width: '100%', textAlign: 'center' }}>Cargando…</div></div>
  if (!info.ok) return <div style={base}><div style={{ ...vidrio, maxWidth: 420, width: '100%', textAlign: 'center' }}><b>Enlace no válido</b><p style={{ color: '#64748b' }}>Pedí a administración que te envíe tu enlace personal.</p></div></div>

  const abierta = info.abierta
  return (
    <div style={base}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <img src="/logo.jpg" alt={MARCA.fantasia} style={{ height: 54, borderRadius: 14, background: '#fff', padding: 6 }} />
          <div style={{ fontWeight: 700, color: '#1e40af', marginTop: 6 }}>{MARCA.fantasia}</div>
        </div>
        <div style={vidrio}>
          <div style={{ fontSize: 14, color: '#64748b' }}>Hola,</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>{info.nombre} {info.apellido}</div>
          {abierta ? (
            <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 14, padding: '10px 14px', marginBottom: 14, fontWeight: 600 }}>Estás trabajando desde las {abierta.entrada}</div>
          ) : info.clientes.length > 1 ? (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>¿Dónde trabajás hoy?</label>
              <select value={cliente} onChange={e => setCliente(e.target.value)} style={{ width: '100%', padding: 12, fontSize: 16, borderRadius: 12, border: '1px solid #cbd5e1', marginTop: 4 }}>
                <option value="">Elegir…</option>{info.clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          ) : info.clientes.length === 1 ? <div style={{ marginBottom: 14, color: '#334155' }}>Servicio: <b>{info.clientes[0].nombre}</b></div> : null}
          <button onClick={marcar} disabled={enviando} style={{ width: '100%', padding: '20px 0', fontSize: 20, fontWeight: 700, color: '#fff', border: 0, borderRadius: 18, cursor: 'pointer', background: abierta ? '#be123c' : '#2563eb', boxShadow: '0 12px 24px -10px rgba(37,99,235,0.6)', opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Registrando…' : abierta ? 'Marcar SALIDA' : 'Marcar ENTRADA'}
          </button>
          {resultado && <div style={{ marginTop: 14, textAlign: 'center', fontWeight: 600, color: '#15803d' }}>✓ {resultado.accion === 'entrada' ? 'Entrada' : 'Salida'} registrada a las {resultado.hora}{resultado.horas ? ` · ${resultado.horas} h` : ''}</div>}
          {error && <div style={{ marginTop: 14, textAlign: 'center', color: '#be123c' }}>{error}</div>}
          {info.marcas?.length > 0 && (
            <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 12, fontSize: 13, color: '#334155' }}>
              <b>Hoy</b>
              {info.marcas.map((m, i) => <div key={i}>{m.entrada} → {m.salida || 'en curso'}{m.cliente ? ` · ${m.cliente}` : ''}{m.horas ? ` · ${m.horas} h` : ''}</div>)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 12 }}>Este enlace es personal: no lo compartas.</div>
      </div>
    </div>
  )
}
