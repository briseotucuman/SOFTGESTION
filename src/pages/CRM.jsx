import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import {
  Radar, Plus, X, Target, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, Users, Calendar
} from 'lucide-react'

const c = colores.reportes

const ETAPAS = [
  { id: 'nuevo', label: 'Nuevo', color: '#64748b' },
  { id: 'contactado', label: 'Contactado', color: '#3D5A80' },
  { id: 'propuesta', label: 'Propuesta enviada', color: '#2E7C8C' },
  { id: 'negociacion', label: 'Negociación', color: '#B5701D' },
  { id: 'ganado', label: 'Ganado', color: '#2F8F6B' },
  { id: 'perdido', label: 'Perdido', color: '#AC3B2A' },
]

function diasDesde(fechaStr) {
  if (!fechaStr) return null
  return Math.floor((new Date() - new Date(fechaStr)) / (1000 * 60 * 60 * 24))
}

function CRM() {
  const [vista, setVista] = useState('panel')
  const [oportunidades, setOportunidades] = useState([])
  const [tareas, setTareas] = useState([])
  const [clientes, setClientes] = useState([])
  const [tiposServicio, setTiposServicio] = useState([])
  const [interacciones, setInteracciones] = useState([])
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)

  const [mostrarFormOp, setMostrarFormOp] = useState(false)
  const [esProspectoNuevo, setEsProspectoNuevo] = useState(true)
  const [formOp, setFormOp] = useState({
    cliente_id: '', nombre_prospecto: '', contacto_prospecto: '', telefono_prospecto: '', email_prospecto: '',
    tipo_servicio_id: '', valor_estimado: '', probabilidad: '50', fecha_estimada_cierre: '', notas: ''
  })

  const [mostrarFormTarea, setMostrarFormTarea] = useState(false)
  const [formTarea, setFormTarea] = useState({ cliente_id: '', titulo: '', fecha_vencimiento: '', prioridad: 'media' })
  const [filtroTareas, setFiltroTareas] = useState('pendiente')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: ops }, { data: tar }, { data: clis }, { data: tipos }, { data: inter }, { data: fact }] = await Promise.all([
      supabase.from('oportunidades').select(`*, clientes(razon_social,nombre_contacto), tipos_servicio(nombre)`).order('creado_en', { ascending: false }),
      supabase.from('tareas_seguimiento').select(`*, clientes(razon_social,nombre_contacto)`).order('fecha_vencimiento', { ascending: true }),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true),
      supabase.from('tipos_servicio').select('*').eq('activo', true),
      supabase.from('interacciones').select('cliente_id, fecha').order('fecha', { ascending: false }),
      supabase.from('facturas').select('cliente_id, estado').eq('estado', 'vencida'),
    ])
    if (ops) setOportunidades(ops)
    if (tar) setTareas(tar)
    if (clis) setClientes(clis)
    if (tipos) setTiposServicio(tipos)
    if (inter) setInteracciones(inter)
    if (fact) setFacturas(fact)
    setLoading(false)
  }

  // ------- Panel de salud de cartera -------
  const ultimoContactoPorCliente = {}
  interacciones.forEach(it => { if (!ultimoContactoPorCliente[it.cliente_id]) ultimoContactoPorCliente[it.cliente_id] = it.fecha })
  const clientesConFacturaVencida = new Set(facturas.map(f => f.cliente_id))
  const clientesEnRiesgo = clientes.filter(cl => {
    const dias = diasDesde(ultimoContactoPorCliente[cl.id])
    return clientesConFacturaVencida.has(cl.id) || dias == null || dias > 45
  })
  const tareasVencidas = tareas.filter(t => t.estado === 'pendiente' && t.fecha_vencimiento && t.fecha_vencimiento < new Date().toISOString().split('T')[0])
  const opsAbiertas = oportunidades.filter(o => o.etapa !== 'ganado' && o.etapa !== 'perdido')
  const valorPipeline = opsAbiertas.reduce((a, o) => a + Number(o.valor_estimado || 0), 0)
  const ganadas = oportunidades.filter(o => o.etapa === 'ganado').length
  const perdidas = oportunidades.filter(o => o.etapa === 'perdido').length
  const tasaConversion = (ganadas + perdidas) > 0 ? (ganadas / (ganadas + perdidas)) * 100 : null

  // ------- Oportunidades -------
  function cerrarFormOp() {
    setMostrarFormOp(false)
    setFormOp({ cliente_id: '', nombre_prospecto: '', contacto_prospecto: '', telefono_prospecto: '', email_prospecto: '', tipo_servicio_id: '', valor_estimado: '', probabilidad: '50', fecha_estimada_cierre: '', notas: '' })
  }
  async function guardarOportunidad(e) {
    e.preventDefault()
    const datos = {
      cliente_id: esProspectoNuevo ? null : (formOp.cliente_id || null),
      nombre_prospecto: esProspectoNuevo ? formOp.nombre_prospecto : null,
      contacto_prospecto: esProspectoNuevo ? formOp.contacto_prospecto : null,
      telefono_prospecto: esProspectoNuevo ? formOp.telefono_prospecto : null,
      email_prospecto: esProspectoNuevo ? formOp.email_prospecto : null,
      tipo_servicio_id: formOp.tipo_servicio_id || null,
      valor_estimado: parseFloat(formOp.valor_estimado) || null,
      probabilidad: parseInt(formOp.probabilidad) || 50,
      fecha_estimada_cierre: formOp.fecha_estimada_cierre || null,
      notas: formOp.notas,
      etapa: 'nuevo'
    }
    const { error } = await supabase.from('oportunidades').insert([datos])
    if (error) { alert('Error: ' + error.message); return }
    cerrarFormOp()
    cargarDatos()
  }
  async function cambiarEtapa(id, etapa) {
    await supabase.from('oportunidades').update({ etapa }).eq('id', id)
    cargarDatos()
  }

  // ------- Tareas globales -------
  async function guardarTarea(e) {
    e.preventDefault()
    await supabase.from('tareas_seguimiento').insert([{ ...formTarea, cliente_id: formTarea.cliente_id || null }])
    setMostrarFormTarea(false)
    setFormTarea({ cliente_id: '', titulo: '', fecha_vencimiento: '', prioridad: 'media' })
    cargarDatos()
  }
  async function completarTarea(t) {
    await supabase.from('tareas_seguimiento').update({ estado: t.estado === 'pendiente' ? 'completada' : 'pendiente' }).eq('id', t.id)
    cargarDatos()
  }
  const tareasFiltradas = tareas.filter(t => filtroTareas === 'todas' || t.estado === filtroTareas)
  const prioridadColor = { alta: { bg: '#fee2e2', color: '#dc2626' }, media: { bg: '#fef3c7', color: '#d97706' }, baja: { bg: '#f1f5f9', color: '#64748b' } }

  return (
    <div>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><Radar size={19} /> CRM</h3>
          <p style={s.cabeceraSubtexto}>{clientes.length} clientes · {opsAbiertas.length} oportunidades abiertas</p>
        </div>
        {vista === 'pipeline' && (
          <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => mostrarFormOp ? cerrarFormOp() : setMostrarFormOp(true)}>
            {mostrarFormOp ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nueva oportunidad</>}
          </button>
        )}
        {vista === 'tareas' && (
          <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => setMostrarFormTarea(!mostrarFormTarea)}>
            {mostrarFormTarea ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nueva tarea</>}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <button onClick={() => setVista('panel')} style={vista === 'panel' ? s.btnPrimario(c.main) : s.btnSecundario}>Panel</button>
        <button onClick={() => setVista('pipeline')} style={vista === 'pipeline' ? s.btnPrimario(c.main) : s.btnSecundario}><Target size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Pipeline</button>
        <button onClick={() => setVista('tareas')} style={vista === 'tareas' ? s.btnPrimario(c.main) : s.btnSecundario}><CheckCircle2 size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Tareas</button>
      </div>

      {loading ? <div style={s.empty}>Cargando…</div> : (
        <>
          {vista === 'panel' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '22px' }}>
                <div style={{ ...s.card, borderLeft: '3px solid #AC3B2A' }}>
                  <p style={{ ...s.label, color: '#AC3B2A' }}>Clientes en riesgo</p>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: paleta.ink, margin: 0 }}>{clientesEnRiesgo.length}</p>
                </div>
                <div style={{ ...s.card, borderLeft: '3px solid #A8631E' }}>
                  <p style={{ ...s.label, color: '#A8631E' }}>Tareas vencidas</p>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: paleta.ink, margin: 0 }}>{tareasVencidas.length}</p>
                </div>
                <div style={{ ...s.card, borderLeft: `3px solid ${c.main}` }}>
                  <p style={{ ...s.label, color: c.main }}>Valor en pipeline</p>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: paleta.ink, margin: 0 }}>{valorPipeline.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
                </div>
                <div style={{ ...s.card, borderLeft: '3px solid #2F8F6B' }}>
                  <p style={{ ...s.label, color: '#2F8F6B' }}>Tasa de conversión</p>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: paleta.ink, margin: 0 }}>{tasaConversion != null ? tasaConversion.toFixed(0) + '%' : '—'}</p>
                </div>
              </div>

              <h4 style={{ fontSize: '14px', fontWeight: '700', color: paleta.ink, margin: '0 0 12px', display:'flex', alignItems:'center', gap:'7px' }}><AlertTriangle size={15} color="#AC3B2A" /> Clientes que requieren atención</h4>
              <div style={{ ...s.card, padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
                {clientesEnRiesgo.length === 0 ? <div style={s.empty}>Ninguno por ahora — buen trabajo.</div> : (
                  <table style={s.tabla}>
                    <thead><tr>{['Cliente','Último contacto','Motivo'].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                    <tbody>
                      {clientesEnRiesgo.map((cl, i) => {
                        const dias = diasDesde(ultimoContactoPorCliente[cl.id])
                        return (
                          <tr key={cl.id} style={s.tablaFila(i)}>
                            <td style={s.tablaCellBold}>{cl.razon_social || cl.nombre_contacto}</td>
                            <td style={s.tablaCell}>{dias != null ? `Hace ${dias} días` : 'Sin registro'}</td>
                            <td style={s.tablaCell}>
                              {clientesConFacturaVencida.has(cl.id) && <span style={{...s.badge('#fee2e2','#dc2626'), marginRight:'6px'}}>Factura vencida</span>}
                              {(dias == null || dias > 45) && <span style={s.badge('#fef3c7','#d97706')}>Sin contacto reciente</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <h4 style={{ fontSize: '14px', fontWeight: '700', color: paleta.ink, margin: '0 0 12px', display:'flex', alignItems:'center', gap:'7px' }}><Clock size={15} color="#A8631E" /> Tareas vencidas</h4>
              <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                {tareasVencidas.length === 0 ? <div style={s.empty}>Sin tareas vencidas.</div> : tareasVencidas.map((t,i) => (
                  <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px', borderBottom: i<tareasVencidas.length-1?`1px solid ${paleta.line}`:'none' }}>
                    <div>
                      <p style={{ margin:0, fontWeight:'600', fontSize:'13.5px', color: paleta.ink }}>{t.titulo}</p>
                      <p style={{ margin:'2px 0 0', fontSize:'12px', color: paleta.muted }}>{t.clientes?.razon_social || t.clientes?.nombre_contacto || 'Sin cliente'} · Venció {new Date(t.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-AR')}</p>
                    </div>
                    <button onClick={() => completarTarea(t)} style={s.btnSecundario}>Completar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vista === 'pipeline' && (
            <div>
              {mostrarFormOp && (
                <div style={s.card}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <button type="button" onClick={() => setEsProspectoNuevo(true)} style={esProspectoNuevo ? s.btnPrimario(c.main) : s.btnSecundario}>Prospecto nuevo</button>
                    <button type="button" onClick={() => setEsProspectoNuevo(false)} style={!esProspectoNuevo ? s.btnPrimario(c.main) : s.btnSecundario}>Cliente existente</button>
                  </div>
                  <form onSubmit={guardarOportunidad}>
                    <div style={s.grid2}>
                      {esProspectoNuevo ? (
                        <>
                          <div><label style={s.label}>Nombre del prospecto</label><input style={s.input} value={formOp.nombre_prospecto} onChange={e => setFormOp({...formOp, nombre_prospecto: e.target.value})} required /></div>
                          <div><label style={s.label}>Contacto</label><input style={s.input} value={formOp.contacto_prospecto} onChange={e => setFormOp({...formOp, contacto_prospecto: e.target.value})} /></div>
                          <div><label style={s.label}>Teléfono</label><input style={s.input} value={formOp.telefono_prospecto} onChange={e => setFormOp({...formOp, telefono_prospecto: e.target.value})} /></div>
                          <div><label style={s.label}>Email</label><input style={s.input} value={formOp.email_prospecto} onChange={e => setFormOp({...formOp, email_prospecto: e.target.value})} /></div>
                        </>
                      ) : (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={s.label}>Cliente</label>
                          <select style={s.input} value={formOp.cliente_id} onChange={e => setFormOp({...formOp, cliente_id: e.target.value})} required>
                            <option value="">Seleccionar cliente</option>
                            {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label style={s.label}>Tipo de servicio</label>
                        <select style={s.input} value={formOp.tipo_servicio_id} onChange={e => setFormOp({...formOp, tipo_servicio_id: e.target.value})}>
                          <option value="">Sin especificar</option>
                          {tiposServicio.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </select>
                      </div>
                      <div><label style={s.label}>Valor estimado ($)</label><input type="number" style={s.input} value={formOp.valor_estimado} onChange={e => setFormOp({...formOp, valor_estimado: e.target.value})} /></div>
                      <div><label style={s.label}>Probabilidad (%)</label><input type="number" min="0" max="100" style={s.input} value={formOp.probabilidad} onChange={e => setFormOp({...formOp, probabilidad: e.target.value})} /></div>
                      <div><label style={s.label}>Fecha estimada de cierre</label><input type="date" style={s.input} value={formOp.fecha_estimada_cierre} onChange={e => setFormOp({...formOp, fecha_estimada_cierre: e.target.value})} /></div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Notas</label><textarea style={{...s.input, resize:'vertical'}} rows={2} value={formOp.notas} onChange={e => setFormOp({...formOp, notas: e.target.value})} /></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                      <button type="button" style={s.btnSecundario} onClick={cerrarFormOp}>Cancelar</button>
                      <button type="submit" style={s.btnPrimario(c.main)}>Guardar oportunidad</button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', alignItems: 'start' }}>
                {ETAPAS.map(etapa => {
                  const ops = oportunidades.filter(o => o.etapa === etapa.id)
                  return (
                    <div key={etapa.id} style={{ background: paleta.paper, borderRadius: '12px', padding: '10px', minHeight: '120px' }}>
                      <p style={{ fontSize: '11.5px', fontWeight: '700', color: etapa.color, margin: '0 0 10px', display:'flex', justifyContent:'space-between' }}>
                        {etapa.label} <span>{ops.length}</span>
                      </p>
                      {ops.map(op => (
                        <div key={op.id} style={{ background: '#fff', borderRadius: '9px', padding: '10px', marginBottom: '8px', border: `1px solid ${paleta.line}` }}>
                          <p style={{ margin: '0 0 4px', fontSize: '12.5px', fontWeight: '700', color: paleta.ink }}>
                            {op.clientes?.razon_social || op.clientes?.nombre_contacto || op.nombre_prospecto}
                          </p>
                          {op.valor_estimado && <p style={{ margin: '0 0 6px', fontSize: '12px', color: paleta.muted }}>{Number(op.valor_estimado).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>}
                          <select value={op.etapa} onChange={e => cambiarEtapa(op.id, e.target.value)} style={{ width: '100%', fontSize: '11px', padding: '4px', borderRadius: '6px', border: `1px solid ${paleta.line}` }}>
                            {ETAPAS.map(e2 => <option key={e2.id} value={e2.id}>{e2.label}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {vista === 'tareas' && (
            <div>
              {mostrarFormTarea && (
                <div style={s.card}>
                  <form onSubmit={guardarTarea}>
                    <div style={s.grid2}>
                      <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Título</label><input style={s.input} value={formTarea.titulo} onChange={e => setFormTarea({...formTarea, titulo: e.target.value})} required /></div>
                      <div>
                        <label style={s.label}>Cliente (opcional)</label>
                        <select style={s.input} value={formTarea.cliente_id} onChange={e => setFormTarea({...formTarea, cliente_id: e.target.value})}>
                          <option value="">Sin asignar</option>
                          {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>)}
                        </select>
                      </div>
                      <div><label style={s.label}>Vencimiento</label><input type="date" style={s.input} value={formTarea.fecha_vencimiento} onChange={e => setFormTarea({...formTarea, fecha_vencimiento: e.target.value})} /></div>
                      <div>
                        <label style={s.label}>Prioridad</label>
                        <select style={s.input} value={formTarea.prioridad} onChange={e => setFormTarea({...formTarea, prioridad: e.target.value})}>
                          <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                      <button type="submit" style={s.btnPrimario(c.main)}>Guardar tarea</button>
                    </div>
                  </form>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {['pendiente','completada','todas'].map(f => (
                  <button key={f} onClick={() => setFiltroTareas(f)} style={filtroTareas === f ? s.btnPrimario(c.main) : s.btnSecundario}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
                ))}
              </div>
              <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                {tareasFiltradas.length === 0 ? <div style={s.empty}>No hay tareas para mostrar.</div> : tareasFiltradas.map((t,i) => {
                  const vencida = t.estado === 'pendiente' && t.fecha_vencimiento && t.fecha_vencimiento < new Date().toISOString().split('T')[0]
                  const pc = prioridadColor[t.prioridad] || prioridadColor.media
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 18px', borderBottom: i<tareasFiltradas.length-1?`1px solid ${paleta.line}`:'none', opacity: t.estado==='completada'?0.5:1 }}>
                      <button onClick={() => completarTarea(t)} style={{ background:'none', border:'none', cursor:'pointer' }}>
                        <CheckCircle2 size={18} color={t.estado==='completada'?c.main:paleta.line} fill={t.estado==='completada'?c.main:'none'} />
                      </button>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin:0, fontSize:'13.5px', fontWeight:'600', color: paleta.ink, textDecoration: t.estado==='completada'?'line-through':'none' }}>{t.titulo}</p>
                        <p style={{ margin:'2px 0 0', fontSize:'12px', color: vencida ? paleta.danger : paleta.muted, fontWeight: vencida?'700':'400' }}>
                          {t.clientes?.razon_social || t.clientes?.nombre_contacto || 'Sin cliente'}
                          {t.fecha_vencimiento && ` · Vence ${new Date(t.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-AR')}`}
                        </p>
                      </div>
                      <span style={s.badge(pc.bg, pc.color)}>{t.prioridad}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CRM
