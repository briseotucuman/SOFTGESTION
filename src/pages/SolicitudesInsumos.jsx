import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { Link2, Copy, Check, CheckCircle2, Circle } from 'lucide-react'

const c = colores.insumos

function SolicitudesInsumos() {
  const [solicitudes, setSolicitudes] = useState([])
  const [items, setItems] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [insumos, setInsumos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('pendiente')

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

  async function toggleItem(item) {
    await supabase.from('solicitud_insumos_items').update({ atendido: !item.atendido }).eq('id', item.id)
    cargarDatos()
  }

  async function marcarSolicitud(solicitudId, estado) {
    await supabase.from('solicitudes_insumos').update({ estado }).eq('id', solicitudId)
    cargarDatos()
  }

  function ultimaEntrada(insumoId) {
    if (!insumoId) return null
    return movimientos.find(m => m.insumo_id === insumoId)
  }

  const solicitudesFiltradas = solicitudes.filter(s => filtroEstado === 'todas' || s.estado === filtroEstado)

  return (
    <div>
      <div style={{ ...s.card, background: paleta.brandSoft, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <Link2 size={18} color={c.main} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <p style={{ margin: 0, fontSize: '12.5px', fontWeight: '600', color: paleta.inkSoft }}>Link para que los empleados carguen pedidos (sin login)</p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: c.main, fontFamily: 'monospace' }}>{linkPublico}</p>
        </div>
        <button onClick={copiarLink} style={{ ...s.btnPrimario(c.main), display: 'flex', alignItems: 'center', gap: '6px' }}>
          {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['pendiente', 'atendida', 'todas'].map(f => (
          <button key={f} onClick={() => setFiltroEstado(f)} style={filtroEstado === f ? s.btnPrimario(c.main) : s.btnSecundario}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <div style={s.empty}>Cargando…</div>
      : solicitudesFiltradas.length === 0 ? <div style={s.empty}>No hay solicitudes {filtroEstado !== 'todas' ? `en estado "${filtroEstado}"` : ''}.</div>
      : solicitudesFiltradas.map(sol => {
        const suc = sucursales.find(x => x.id === sol.sucursal_id)
        const itemsSol = items.filter(it => it.solicitud_id === sol.id)
        const todosAtendidos = itemsSol.length > 0 && itemsSol.every(it => it.atendido)
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
              <span style={s.badge(sol.estado === 'atendida' ? '#d1fae5' : '#fef3c7', sol.estado === 'atendida' ? '#059669' : '#d97706')}>{sol.estado}</span>
            </div>

            {sol.notas && <p style={{ fontSize: '12.5px', color: paleta.inkSoft, background: paleta.paper, padding: '8px 10px', borderRadius: '7px', margin: '0 0 10px' }}>{sol.notas}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {itemsSol.map(it => {
                const insumo = insumos.find(i => i.id === it.insumo_id)
                const entrada = ultimaEntrada(it.insumo_id)
                return (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderTop: `1px solid ${paleta.line}` }}>
                    <button onClick={() => toggleItem(it)} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      {it.atendido ? <CheckCircle2 size={17} color={c.main} fill={c.main} /> : <Circle size={17} color={paleta.line} />}
                    </button>
                    <span style={{ flex: 1, fontSize: '13.5px', color: paleta.ink, textDecoration: it.atendido ? 'line-through' : 'none' }}>
                      {insumo?.nombre || it.nombre_libre} <strong>× {it.cantidad}</strong>
                      {!insumo && it.nombre_libre && <span style={{ color: paleta.warn, fontSize: '11px', fontWeight: '600' }}> (no está en el catálogo)</span>}
                    </span>
                    {entrada && <span style={{ fontSize: '11px', color: paleta.muted }}>Última compra: {new Date(entrada.fecha_registro).toLocaleDateString('es-AR')} (×{entrada.cantidad})</span>}
                  </div>
                )
              })}
            </div>

            {sol.estado !== 'atendida' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button style={s.btnSecundario} onClick={() => marcarSolicitud(sol.id, 'atendida')} disabled={!todosAtendidos}>
                  {todosAtendidos ? 'Marcar solicitud como atendida' : 'Marcá todos los ítems primero'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default SolicitudesInsumos
