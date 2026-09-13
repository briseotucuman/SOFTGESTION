import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta, colores } from '../estilos.js'
import {
  X, Plus, Phone, Mail, User, Star, Trash2, Clock, AlertTriangle,
  CheckCircle2, FileText, Wallet, Receipt, MessageSquare
} from 'lucide-react'

const c = colores.clientes

const TIPO_INTERACCION = {
  llamada: { label: 'Llamada', icon: Phone },
  email: { label: 'Email', icon: Mail },
  reunion: { label: 'Reunión', icon: User },
  visita: { label: 'Visita', icon: User },
  reclamo: { label: 'Reclamo', icon: AlertTriangle },
  nota: { label: 'Nota', icon: MessageSquare },
}

function diasDesde(fechaStr) {
  if (!fechaStr) return null
  const dif = (new Date() - new Date(fechaStr)) / (1000 * 60 * 60 * 24)
  return Math.floor(dif)
}

function FichaCliente({ cliente, onClose }) {
  const [tab, setTab] = useState('resumen')
  const [contactos, setContactos] = useState([])
  const [interacciones, setInteracciones] = useState([])
  const [tareas, setTareas] = useState([])
  const [contratos, setContratos] = useState([])
  const [facturas, setFacturas] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [loading, setLoading] = useState(true)

  const [mostrarFormContacto, setMostrarFormContacto] = useState(false)
  const [formContacto, setFormContacto] = useState({ nombre: '', cargo: '', telefono: '', email: '', es_principal: false, notas: '' })

  const [mostrarFormInteraccion, setMostrarFormInteraccion] = useState(false)
  const [formInteraccion, setFormInteraccion] = useState({ tipo: 'llamada', fecha: new Date().toISOString().split('T')[0], contacto_id: '', asunto: '', detalle: '', proximo_paso: '' })

  const [mostrarFormTarea, setMostrarFormTarea] = useState(false)
  const [formTarea, setFormTarea] = useState({ titulo: '', fecha_vencimiento: '', prioridad: 'media', notas: '' })

  useEffect(() => { cargarTodo() }, [cliente.id])

  async function cargarTodo() {
    setLoading(true)
    const [
      { data: cont }, { data: inter }, { data: tar },
      { data: contr }, { data: fact }, { data: pres }
    ] = await Promise.all([
      supabase.from('contactos_cliente').select('*').eq('cliente_id', cliente.id).eq('activo', true).order('es_principal', { ascending: false }),
      supabase.from('interacciones').select('*').eq('cliente_id', cliente.id).order('fecha', { ascending: false }),
      supabase.from('tareas_seguimiento').select('*').eq('cliente_id', cliente.id).order('fecha_vencimiento', { ascending: true }),
      supabase.from('contratos').select('*').eq('cliente_id', cliente.id),
      supabase.from('facturas').select('*').eq('cliente_id', cliente.id),
      supabase.from('presupuestos').select('*').eq('cliente_id', cliente.id),
    ])
    setContactos(cont || [])
    setInteracciones(inter || [])
    setTareas(tar || [])
    setContratos(contr || [])
    setFacturas(fact || [])
    setPresupuestos(pres || [])
    setLoading(false)
  }

  // ------- Salud de la cuenta -------
  const ultimaInteraccion = interacciones[0]?.fecha
  const diasSinContacto = diasDesde(ultimaInteraccion)
  const tareasVencidas = tareas.filter(t => t.estado === 'pendiente' && t.fecha_vencimiento && t.fecha_vencimiento < new Date().toISOString().split('T')[0])
  const contratosActivos = contratos.filter(ct => ct.estado === 'activo')
  const facturasPendientes = facturas.filter(f => ['pendiente','parcial','vencida'].includes(f.estado))
  const totalPendiente = facturasPendientes.reduce((a, f) => a + Number(f.total), 0)

  let salud = { nivel: 'bien', label: 'Cuenta saludable', color: '#059669', bg: '#d1fae5' }
  if (facturas.some(f => f.estado === 'vencida') || tareasVencidas.length > 0 || (diasSinContacto != null && diasSinContacto > 60)) {
    salud = { nivel: 'riesgo', label: 'Requiere atención', color: '#dc2626', bg: '#fee2e2' }
  } else if ((diasSinContacto != null && diasSinContacto > 30) || facturasPendientes.length > 0) {
    salud = { nivel: 'atencion', label: 'A seguir de cerca', color: '#d97706', bg: '#fef3c7' }
  }

  // ------- Contactos -------
  async function guardarContacto(e) {
    e.preventDefault()
    await supabase.from('contactos_cliente').insert([{ ...formContacto, cliente_id: cliente.id }])
    setMostrarFormContacto(false)
    setFormContacto({ nombre: '', cargo: '', telefono: '', email: '', es_principal: false, notas: '' })
    cargarTodo()
  }
  async function eliminarContacto(id) {
    if (!confirm('¿Eliminar este contacto?')) return
    await supabase.from('contactos_cliente').update({ activo: false }).eq('id', id)
    cargarTodo()
  }

  // ------- Interacciones -------
  async function guardarInteraccion(e) {
    e.preventDefault()
    await supabase.from('interacciones').insert([{ ...formInteraccion, cliente_id: cliente.id, contacto_id: formInteraccion.contacto_id || null }])
    setMostrarFormInteraccion(false)
    setFormInteraccion({ tipo: 'llamada', fecha: new Date().toISOString().split('T')[0], contacto_id: '', asunto: '', detalle: '', proximo_paso: '' })
    cargarTodo()
  }

  // ------- Tareas -------
  async function guardarTarea(e) {
    e.preventDefault()
    await supabase.from('tareas_seguimiento').insert([{ ...formTarea, cliente_id: cliente.id }])
    setMostrarFormTarea(false)
    setFormTarea({ titulo: '', fecha_vencimiento: '', prioridad: 'media', notas: '' })
    cargarTodo()
  }
  async function completarTarea(t) {
    await supabase.from('tareas_seguimiento').update({ estado: t.estado === 'pendiente' ? 'completada' : 'pendiente' }).eq('id', t.id)
    cargarTodo()
  }

  const prioridadColor = { alta: { bg: '#fee2e2', color: '#dc2626' }, media: { bg: '#fef3c7', color: '#d97706' }, baja: { bg: '#f1f5f9', color: '#64748b' } }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '920px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* HEADER */}
        <div style={{ padding: '22px 26px', borderBottom: `1px solid ${paleta.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontWeight: '800', fontSize: '18px', color: paleta.ink }}>{cliente.razon_social || cliente.nombre_contacto}</h3>
              <span style={{ ...s.badge(salud.bg, salud.color) }}>{salud.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: paleta.muted }}>
              {diasSinContacto != null ? `Último contacto hace ${diasSinContacto} día(s)` : 'Sin interacciones registradas'} · {contratosActivos.length} contrato(s) activo(s)
              {totalPendiente > 0 && <> · <strong style={{ color: '#dc2626' }}>{totalPendiente.toLocaleString('es-AR',{style:'currency',currency:'ARS'})} pendiente de cobro</strong></>}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: paleta.muted }}><X size={18} /></button>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '8px', padding: '14px 26px 0' }}>
          {[['resumen','Resumen'],['contactos',`Contactos (${contactos.length})`],['interacciones',`Interacciones (${interacciones.length})`],['tareas',`Tareas (${tareas.filter(t=>t.estado==='pendiente').length})`]].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
              color: tab === id ? c.main : paleta.muted, borderBottom: tab === id ? `2px solid ${c.main}` : '2px solid transparent'
            }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: '20px 26px', overflowY: 'auto', flex: 1 }}>
          {loading ? <div style={s.empty}>Cargando…</div> : (
            <>
              {tab === 'resumen' && (
                <div>
                  {(tareasVencidas.length > 0 || salud.nivel === 'riesgo') && (
                    <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <div style={{ fontSize: '12.5px', color: '#991b1b' }}>
                        {tareasVencidas.length > 0 && <p style={{ margin: '0 0 4px' }}>{tareasVencidas.length} tarea(s) de seguimiento vencida(s).</p>}
                        {facturas.some(f => f.estado === 'vencida') && <p style={{ margin: 0 }}>Tiene facturas vencidas sin cobrar.</p>}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ ...s.card, margin: 0, padding: '14px', borderLeft: `3px solid ${colores.contratos.main}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><FileText size={13} color={colores.contratos.main} /><span style={{ fontSize: '11.5px', color: paleta.muted, fontWeight: '600' }}>Contratos activos</span></div>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: paleta.ink }}>{contratosActivos.length}</p>
                    </div>
                    <div style={{ ...s.card, margin: 0, padding: '14px', borderLeft: `3px solid ${colores.facturacion.main}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><Receipt size={13} color={colores.facturacion.main} /><span style={{ fontSize: '11.5px', color: paleta.muted, fontWeight: '600' }}>Facturas pendientes</span></div>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: paleta.ink }}>{facturasPendientes.length}</p>
                    </div>
                    <div style={{ ...s.card, margin: 0, padding: '14px', borderLeft: `3px solid ${colores.presupuestos.main}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><Wallet size={13} color={colores.presupuestos.main} /><span style={{ fontSize: '11.5px', color: paleta.muted, fontWeight: '600' }}>Presupuestos</span></div>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: paleta.ink }}>{presupuestos.length}</p>
                    </div>
                  </div>

                  <p style={{ ...s.label, marginBottom: '8px' }}>Contratos</p>
                  {contratos.length === 0 ? <p style={{ fontSize: '13px', color: paleta.muted, marginBottom: '18px' }}>Sin contratos registrados.</p> : (
                    <div style={{ marginBottom: '18px' }}>
                      {contratos.map(ct => (
                        <div key={ct.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${paleta.line}`, fontSize: '13px' }}>
                          <span>{ct.numero_contrato || 'Sin número'} — {ct.descripcion || 'Sin descripción'}</span>
                          <span style={s.badge(ct.estado === 'activo' ? '#d1fae5' : '#f1f5f9', ct.estado === 'activo' ? '#059669' : '#64748b')}>{ct.estado}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={{ ...s.label, marginBottom: '8px' }}>Últimas interacciones</p>
                  {interacciones.slice(0,3).length === 0 ? <p style={{ fontSize: '13px', color: paleta.muted }}>Todavía no hay interacciones registradas.</p> : (
                    interacciones.slice(0,3).map(it => {
                      const ti = TIPO_INTERACCION[it.tipo] || TIPO_INTERACCION.nota
                      return (
                        <div key={it.id} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${paleta.line}` }}>
                          <ti.icon size={14} color={paleta.muted} style={{ marginTop: '2px', flexShrink: 0 }} />
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: paleta.ink }}>{it.asunto || ti.label}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: paleta.muted }}>{new Date(it.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {tab === 'contactos' && (
                <div>
                  <button style={{ ...s.btnSecundario, marginBottom: '14px' }} onClick={() => setMostrarFormContacto(!mostrarFormContacto)}>
                    {mostrarFormContacto ? <><X size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo contacto</>}
                  </button>
                  {mostrarFormContacto && (
                    <form onSubmit={guardarContacto} style={{ background: paleta.paper, borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                      <div style={s.grid2}>
                        <div><label style={s.label}>Nombre</label><input style={s.input} value={formContacto.nombre} onChange={e => setFormContacto({...formContacto, nombre: e.target.value})} required /></div>
                        <div><label style={s.label}>Cargo / rol</label><input style={s.input} value={formContacto.cargo} onChange={e => setFormContacto({...formContacto, cargo: e.target.value})} placeholder="Quien paga, quien reclama..." /></div>
                        <div><label style={s.label}>Teléfono</label><input style={s.input} value={formContacto.telefono} onChange={e => setFormContacto({...formContacto, telefono: e.target.value})} /></div>
                        <div><label style={s.label}>Email</label><input style={s.input} value={formContacto.email} onChange={e => setFormContacto({...formContacto, email: e.target.value})} /></div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '10px 0', fontSize: '13px', color: paleta.inkSoft }}>
                        <input type="checkbox" checked={formContacto.es_principal} onChange={e => setFormContacto({...formContacto, es_principal: e.target.checked})} /> Contacto principal
                      </label>
                      <button type="submit" style={s.btnPrimario(c.main)}>Guardar contacto</button>
                    </form>
                  )}
                  {contactos.length === 0 ? <p style={{ fontSize: '13px', color: paleta.muted }}>Sin contactos cargados.</p> : contactos.map(ct => (
                    <div key={ct.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${paleta.line}` }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '13.5px', color: paleta.ink, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {ct.nombre} {ct.es_principal && <Star size={12} color="#d97706" fill="#d97706" />}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: paleta.muted }}>{ct.cargo || 'Sin cargo'} {ct.telefono && `· ${ct.telefono}`} {ct.email && `· ${ct.email}`}</p>
                      </div>
                      <button onClick={() => eliminarContacto(ct.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} color={paleta.danger} /></button>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'interacciones' && (
                <div>
                  <button style={{ ...s.btnSecundario, marginBottom: '14px' }} onClick={() => setMostrarFormInteraccion(!mostrarFormInteraccion)}>
                    {mostrarFormInteraccion ? <><X size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Registrar interacción</>}
                  </button>
                  {mostrarFormInteraccion && (
                    <form onSubmit={guardarInteraccion} style={{ background: paleta.paper, borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                      <div style={s.grid2}>
                        <div>
                          <label style={s.label}>Tipo</label>
                          <select style={s.input} value={formInteraccion.tipo} onChange={e => setFormInteraccion({...formInteraccion, tipo: e.target.value})}>
                            {Object.entries(TIPO_INTERACCION).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </div>
                        <div><label style={s.label}>Fecha</label><input type="date" style={s.input} value={formInteraccion.fecha} onChange={e => setFormInteraccion({...formInteraccion, fecha: e.target.value})} /></div>
                        <div>
                          <label style={s.label}>Contacto (opcional)</label>
                          <select style={s.input} value={formInteraccion.contacto_id} onChange={e => setFormInteraccion({...formInteraccion, contacto_id: e.target.value})}>
                            <option value="">Sin especificar</option>
                            {contactos.map(ct => <option key={ct.id} value={ct.id}>{ct.nombre}</option>)}
                          </select>
                        </div>
                        <div><label style={s.label}>Asunto</label><input style={s.input} value={formInteraccion.asunto} onChange={e => setFormInteraccion({...formInteraccion, asunto: e.target.value})} /></div>
                        <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Detalle</label><textarea style={{...s.input, resize:'vertical'}} rows={2} value={formInteraccion.detalle} onChange={e => setFormInteraccion({...formInteraccion, detalle: e.target.value})} /></div>
                        <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Próximo paso</label><input style={s.input} value={formInteraccion.proximo_paso} onChange={e => setFormInteraccion({...formInteraccion, proximo_paso: e.target.value})} /></div>
                      </div>
                      <button type="submit" style={{ ...s.btnPrimario(c.main), marginTop: '10px' }}>Guardar</button>
                    </form>
                  )}
                  {interacciones.length === 0 ? <p style={{ fontSize: '13px', color: paleta.muted }}>Sin interacciones registradas.</p> : interacciones.map(it => {
                    const ti = TIPO_INTERACCION[it.tipo] || TIPO_INTERACCION.nota
                    const contactoRel = contactos.find(ct => ct.id === it.contacto_id)
                    return (
                      <div key={it.id} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: `1px solid ${paleta.line}` }}>
                        <div style={{ width: 30, height: 30, borderRadius: '8px', background: paleta.brandSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <ti.icon size={14} color={c.main} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '13.5px', color: paleta.ink }}>{it.asunto || ti.label}</p>
                            <span style={{ fontSize: '12px', color: paleta.muted }}>{new Date(it.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                          </div>
                          {contactoRel && <p style={{ margin: '2px 0', fontSize: '12px', color: paleta.muted }}>con {contactoRel.nombre}</p>}
                          {it.detalle && <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: paleta.inkSoft }}>{it.detalle}</p>}
                          {it.proximo_paso && <p style={{ margin: '4px 0 0', fontSize: '12px', color: c.main, fontWeight: '600' }}>Próximo paso: {it.proximo_paso}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'tareas' && (
                <div>
                  <button style={{ ...s.btnSecundario, marginBottom: '14px' }} onClick={() => setMostrarFormTarea(!mostrarFormTarea)}>
                    {mostrarFormTarea ? <><X size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nueva tarea</>}
                  </button>
                  {mostrarFormTarea && (
                    <form onSubmit={guardarTarea} style={{ background: paleta.paper, borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                      <div style={s.grid2}>
                        <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Título</label><input style={s.input} value={formTarea.titulo} onChange={e => setFormTarea({...formTarea, titulo: e.target.value})} required /></div>
                        <div><label style={s.label}>Vencimiento</label><input type="date" style={s.input} value={formTarea.fecha_vencimiento} onChange={e => setFormTarea({...formTarea, fecha_vencimiento: e.target.value})} /></div>
                        <div>
                          <label style={s.label}>Prioridad</label>
                          <select style={s.input} value={formTarea.prioridad} onChange={e => setFormTarea({...formTarea, prioridad: e.target.value})}>
                            <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option>
                          </select>
                        </div>
                      </div>
                      <button type="submit" style={{ ...s.btnPrimario(c.main), marginTop: '10px' }}>Guardar tarea</button>
                    </form>
                  )}
                  {tareas.length === 0 ? <p style={{ fontSize: '13px', color: paleta.muted }}>Sin tareas de seguimiento.</p> : tareas.map(t => {
                    const vencida = t.estado === 'pendiente' && t.fecha_vencimiento && t.fecha_vencimiento < new Date().toISOString().split('T')[0]
                    const pc = prioridadColor[t.prioridad] || prioridadColor.media
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: `1px solid ${paleta.line}`, opacity: t.estado === 'completada' ? 0.5 : 1 }}>
                        <button onClick={() => completarTarea(t)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <CheckCircle2 size={18} color={t.estado === 'completada' ? c.main : paleta.line} fill={t.estado === 'completada' ? c.main : 'none'} />
                        </button>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '600', color: paleta.ink, textDecoration: t.estado === 'completada' ? 'line-through' : 'none' }}>{t.titulo}</p>
                          {t.fecha_vencimiento && <p style={{ margin: '2px 0 0', fontSize: '12px', color: vencida ? paleta.danger : paleta.muted, fontWeight: vencida ? '700' : '400' }}>
                            {vencida && <Clock size={11} style={{ marginRight: 3, verticalAlign: '-1px' }} />}
                            Vence {new Date(t.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}
                          </p>}
                        </div>
                        <span style={s.badge(pc.bg, pc.color)}>{t.prioridad}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default FichaCliente
