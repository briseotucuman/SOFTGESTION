import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { paleta } from './estilos.js'
import { Package, Plus, Trash2, CheckCircle2, Loader2 } from 'lucide-react'

const inputStyle = {
  width: '100%', padding: '11px 13px', boxSizing: 'border-box', background: '#fff',
  border: `1.5px solid ${paleta.line}`, borderRadius: '8px', color: paleta.ink,
  fontSize: '15px', outline: 'none', fontFamily: paleta.font
}
const labelStyle = { display: 'block', color: paleta.inkSoft, fontSize: '13px', fontWeight: '600', marginBottom: '6px' }

function SolicitudInsumos() {
  const [sucursales, setSucursales] = useState([])
  const [insumos, setInsumos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const [solicitadoPor, setSolicitadoPor] = useState('')
  const [sucursalId, setSucursalId] = useState('')
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState([{ insumo_id: '', nombre_libre: '', cantidad: 1 }])

  useEffect(() => {
    async function cargar() {
      const [{ data: suc }, { data: ins }] = await Promise.all([
        supabase.from('sucursales_publicas').select('*').order('nombre'),
        supabase.from('insumos_publicos').select('*').order('nombre'),
      ])
      setSucursales(suc || [])
      setInsumos(ins || [])
      setCargando(false)
    }
    cargar()
  }, [])

  function actualizarItem(i, campo, valor) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it))
  }
  function agregarItem() {
    setItems(prev => [...prev, { insumo_id: '', nombre_libre: '', cantidad: 1 }])
  }
  function quitarItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  async function enviar(e) {
    e.preventDefault()
    setError('')
    const itemsValidos = items.filter(it => it.insumo_id || it.nombre_libre.trim())
    if (!sucursalId) { setError('Elegí la sucursal'); return }
    if (itemsValidos.length === 0) { setError('Agregá al menos un insumo'); return }
    setEnviando(true)
    try {
      const { data: solicitud, error: e1 } = await supabase.from('solicitudes_insumos').insert({
        sucursal_id: sucursalId, solicitado_por: solicitadoPor || null, notas: notas || null
      }).select().single()
      if (e1) throw e1
      const filas = itemsValidos.map(it => ({
        solicitud_id: solicitud.id,
        insumo_id: it.insumo_id || null,
        nombre_libre: it.insumo_id ? null : it.nombre_libre.trim(),
        cantidad: parseFloat(it.cantidad) || 1,
      }))
      const { error: e2 } = await supabase.from('solicitud_insumos_items').insert(filas)
      if (e2) throw e2
      setEnviado(true)
    } catch (err) {
      setError('No se pudo enviar la solicitud. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  function nuevaSolicitud() {
    setEnviado(false); setSolicitadoPor(''); setSucursalId(''); setNotas('')
    setItems([{ insumo_id: '', nombre_libre: '', cantidad: 1 }])
  }

  return (
    <div style={{ minHeight: '100vh', background: paleta.paper, display: 'flex', justifyContent: 'center', padding: '24px 16px', fontFamily: paleta.font }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ background: paleta.brand, borderRadius: '10px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={19} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: '800', fontSize: '16px', color: paleta.ink }}>Pedido de insumos</p>
            <p style={{ margin: 0, fontSize: '12.5px', color: paleta.muted }}>Briseo — completá lo que necesitás en tu sucursal</p>
          </div>
        </div>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: paleta.muted }}>Cargando…</div>
        ) : enviado ? (
          <div style={{ background: '#fff', borderRadius: '14px', padding: '30px 24px', textAlign: 'center', border: `1px solid ${paleta.line}` }}>
            <CheckCircle2 size={32} color={paleta.brand} style={{ marginBottom: '10px' }} />
            <p style={{ fontWeight: '700', fontSize: '15px', color: paleta.ink, margin: '0 0 6px' }}>Solicitud enviada</p>
            <p style={{ fontSize: '13px', color: paleta.muted, margin: '0 0 18px' }}>Gracias — ya quedó registrada para que la revisen.</p>
            <button onClick={nuevaSolicitud} style={{ background: paleta.brand, color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 20px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
              Cargar otro pedido
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: `1px solid ${paleta.line}` }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Tu nombre</label>
              <input style={inputStyle} value={solicitadoPor} onChange={e => setSolicitadoPor(e.target.value)} placeholder="Quién pide" />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Sucursal</label>
              <select style={inputStyle} value={sucursalId} onChange={e => setSucursalId(e.target.value)} required>
                <option value="">Seleccionar sucursal</option>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre} {s.cliente_nombre ? `— ${s.cliente_nombre}` : ''}</option>)}
              </select>
            </div>

            <label style={labelStyle}>Insumos necesarios</label>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <select style={{ ...inputStyle, marginBottom: it.insumo_id ? 0 : '6px' }} value={it.insumo_id} onChange={e => actualizarItem(i, 'insumo_id', e.target.value)}>
                    <option value="">Otro (escribir abajo)</option>
                    {insumos.map(ins => <option key={ins.id} value={ins.id}>{ins.nombre}</option>)}
                  </select>
                  {!it.insumo_id && (
                    <input style={inputStyle} value={it.nombre_libre} onChange={e => actualizarItem(i, 'nombre_libre', e.target.value)} placeholder="Nombre del insumo" />
                  )}
                </div>
                <input type="number" min="1" step="1" style={{ ...inputStyle, width: '70px', flexShrink: 0 }} value={it.cantidad} onChange={e => actualizarItem(i, 'cantidad', e.target.value)} />
                {items.length > 1 && (
                  <button type="button" onClick={() => quitarItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', flexShrink: 0 }}>
                    <Trash2 size={17} color={paleta.danger} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={agregarItem} style={{ background: 'none', border: `1.5px dashed ${paleta.line}`, borderRadius: '8px', padding: '9px', width: '100%', color: paleta.brand, fontWeight: '600', fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
              <Plus size={14} /> Agregar otro insumo
            </button>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Notas (opcional)</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Alguna aclaración..." />
            </div>

            {error && <p style={{ color: paleta.danger, fontSize: '13px', fontWeight: '600', marginBottom: '14px' }}>{error}</p>}

            <button type="submit" disabled={enviando} style={{
              width: '100%', background: paleta.brand, color: '#fff', border: 'none', borderRadius: '9px',
              padding: '13px', fontWeight: '700', fontSize: '15px', cursor: enviando ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: enviando ? 0.7 : 1
            }}>
              {enviando ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Enviando…</> : 'Enviar pedido'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default SolicitudInsumos
