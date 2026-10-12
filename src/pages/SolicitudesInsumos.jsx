import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { Link2, Copy, Check, Circle, Send, PackageCheck, FileSpreadsheet, FileText } from 'lucide-react'
import { armarFilas, exportarExcel, exportarPDF, fechaLocalISO } from '../exportarInsumos.js'

const c = colores.insumos

const PASOS = [
  { id: 'pedido', label: 'Pedido', icon: Circle, color: paleta.muted },
  { id: 'enviado', label: 'Enviado', icon: Send, color: '#d97706' },
  { id: 'recibido', label: 'Recibido', icon: PackageCheck, color: '#059669' },
]

function SolicitudesInsumos() {
  const [solicitudes, setSolicitudes] = useState([])
  const [items, setItems] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [insumos, setInsumos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('en-curso')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [exportando, setExportando] = useState('')

  const linkPublico = `${window.location.origin}/solicitud-insumos`

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: sol }, { data: it }, { data: suc }, { data: ins }, { data: mov }] = await Promise.all([
      supabase.from('solicitudes_insumos').select('*').order('fecha_solicitud', { ascending: false }),
      supabase.from('solicitud_insumos_items').select('*'),
      supabase.from('sucursales').select('id, nombre, clientes(razon_social)'),
      supabase.from('insumos').select('id, nombre'),
      supabase.from('movimientos_stock').select('insumo_id, fecha_registro:creado_en, cantidad').eq('tipo_movimiento', 'entrada').order('creado_en', { ascending: false }),
    ])
    setSolicitudes(sol || [])
    setItems(it || [])
    setSucursales(suc || [])
    setInsumos(ins || [])
    setMovimientos(mov || [])
    setLoading(false)
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkPublico)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function avanzarEstado(item, nuevoEstado) {
    await supabase.from('solicitud_insumos_items').update({ estado: nuevoEstado }).eq('id', item.id)
    cargarDatos()
  }

  function ultimaEntrada(insumoId) {
    if (!insumoId) return null
    return movimientos.find(m => m.insumo_id === insumoId)
  }

  function estadoSolicitud(itemsSol) {
    if (itemsSol.length === 0) return 'pedido'
    if (itemsSol.every(it => it.estado === 'recibido')) return 'recibido'
    if (itemsSol.some(it => it.estado === 'enviado' || it.estado === 'recibido')) return 'enviado'
    return 'pedido'
  }

  const solicitudesConEstado = solicitudes.map(sol => ({
    ...sol,
    itemsSol: items.filter(it => it.solicitud_id === sol.id),
  })).map(sol => ({ ...sol, estadoCalculado: estadoSolicitud(sol.itemsSol) }))

  const solicitudesFiltradas = solicitudesConEstado.filter(sol => {
    const dia = fechaLocalISO(sol.fecha_solicitud)
    if (desde && dia < desde) return false
    if (hasta && dia > hasta) return false
    if (filtroEstado === 'todas') return true
    if (filtroEstado === 'en-curso') return sol.estadoCalculado !== 'recibido'
    return sol.estadoCalculado === filtroEstado
  })

  const filasExport = armarFilas(solicitudesFiltradas, sucursales, insumos)

  async function exportar(tipo) {
    if (filasExport.length === 0) return
    setExportando(tipo)
    try {
      if (tipo === 'excel') await exportarExcel(filasExport, desde, hasta)
      else await exportarPDF(filasExport, desde, hasta)
    } catch (e) {
      console.error(e)
      alert('No se pudo generar el archivo. Probá de nuevo.')
    }
    setExportando('')
  }

  return (
    <div>
      <div style={{ ...s.card, background: paleta.brandSoft, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <Link2 size={18} color={c.main} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <p style={{ margin: 0, fontSize: '12.5px', fontWeight: '600', color: paleta.inkSoft }}>Link para pedir insumos o confirmar recepción (sin login)</p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: c.main, fontFamily: 'monospace' }}>{linkPublico}</p>
        </div>
        <button onClick={copiarLink} style={{ ...s.btnPrimario(c.main), display: 'flex', alignItems: 'center', gap: '6px' }}>
          {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {[['en-curso','En curso'],['pedido','Pedido'],['enviado','Enviado'],['recibido','Recibido'],['todas','Todas']].map(([id,label]) => (
          <button key={id} onClick={() => setFiltroEstado(id)} style={filtroEstado === id ? s.btnPrimario(c.main) : s.btnSecundario}>{label}</button>
        ))}
      </div>

      <div style={{ ...s.card, display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <label style={s.label}>Desde</label>
          <input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} style={{ ...s.input, width: '160px' }} />
        </div>
        <div>
          <label style={s.label}>Hasta</label>
          <input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} style={{ ...s.input, width: '160px' }} />
        </div>
        {(desde || hasta) && (
          <button onClick={() => { setDesde(''); setHasta('') }} style={s.btnSecundario}>Limpiar fechas</button>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '12px', color: paleta.muted, alignSelf: 'center' }}>
          {solicitudesFiltradas.length} pedido{solicitudesFiltradas.length === 1 ? '' : 's'} · {filasExport.length} ítem{filasExport.length === 1 ? '' : 's'}
        </span>
        <button onClick={() => exportar('excel')} disabled={filasExport.length === 0 || !!exportando}
          style={{ ...s.btnPrimario(c.main), display: 'flex', alignItems: 'center', gap: '6px', opacity: filasExport.length === 0 ? 0.5 : 1 }}>
          <FileSpreadsheet size={14} /> {exportando === 'excel' ? 'Generando…' : 'Exportar Excel'}
        </button>
        <button onClick={() => exportar('pdf')} disabled={filasExport.length === 0 || !!exportando}
          style={{ ...s.btnSecundario, display: 'flex', alignItems: 'center', gap: '6px', opacity: filasExport.length === 0 ? 0.5 : 1 }}>
          <FileText size={14} /> {exportando === 'pdf' ? 'Generando…' : 'Exportar PDF'}
        </button>
      </div>

      {loading ? <div style={s.empty}>Cargando…</div>
      : solicitudesFiltradas.length === 0 ? <div style={s.empty}>No hay solicitudes en este filtro.</div>
      : solicitudesFiltradas.map(sol => {
        const suc = sucursales.find(x => x.id === sol.sucursal_id)
        const pasoActual = PASOS.find(p => p.id === sol.estadoCalculado)
        return (
          <div key={sol.id} style={{ ...s.card, marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: paleta.ink }}>
                  {suc?.nombre || 'Sucursal sin especificar'} {suc?.clientes?.razon_social && <span style={{ color: paleta.muted, fontWeight: '400' }}>— {suc.clientes.razon_social}</span>}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: paleta.muted }}>
                  {new Date(sol.fecha_solicitud).toLocaleString('es-AR')} {sol.solicitado_por && `· Pidió: ${sol.solicitado_por}`}
                </p>
              </div>
              <span style={s.badge(pasoActual.id === 'recibido' ? '#d1fae5' : pasoActual.id === 'enviado' ? '#fef3c7' : '#f1f5f9', pasoActual.color)}>{pasoActual.label}</span>
            </div>

            {sol.notas && <p style={{ fontSize: '12.5px', color: paleta.inkSoft, background: paleta.paper, padding: '8px 10px', borderRadius: '7px', margin: '0 0 10px' }}>{sol.notas}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {sol.itemsSol.map(it => {
                const insumo = insumos.find(i => i.id === it.insumo_id)
                const entrada = ultimaEntrada(it.insumo_id)
                return (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: `1px solid ${paleta.line}`, flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, fontSize: '13.5px', color: paleta.ink, minWidth: '160px' }}>
                      {insumo?.nombre || it.nombre_libre} <strong>× {it.cantidad}</strong>
                      {!insumo && it.nombre_libre && <span style={{ color: paleta.warn, fontSize: '11px', fontWeight: '600' }}> (no está en el catálogo)</span>}
                    </span>
                    {entrada && <span style={{ fontSize: '11px', color: paleta.muted }}>Última compra: {new Date(entrada.fecha_registro).toLocaleDateString('es-AR')} (×{entrada.cantidad})</span>}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {PASOS.map(paso => (
                        <button key={paso.id} onClick={() => avanzarEstado(it, paso.id)} style={{
                          padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                          border: `1.5px solid ${it.estado === paso.id ? paso.color : paleta.line}`,
                          background: it.estado === paso.id ? paso.color : '#fff',
                          color: it.estado === paso.id ? '#fff' : paleta.muted,
                        }}>{paso.label}</button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default SolicitudesInsumos

