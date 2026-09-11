import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { CalendarDays, Plus, X } from 'lucide-react'

const c = colores.agenda

function Agenda() {
  const [ordenes, setOrdenes] = useState([])
  const [contratos, setContratos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [insumos, setInsumos] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarCierre, setMostrarCierre] = useState(null)
  const [filtroFecha, setFiltroFecha] = useState('')
  const [empleadosSeleccionados, setEmpleadosSeleccionados] = useState([])
  const [form, setForm] = useState({
    contrato_id: '', sucursal_id: '', fecha_programada: '', hora_inicio: '',
    hora_fin_estimada: '', observaciones_previas: ''
  })

  // Estado del cierre de orden
  const [horasEmpleados, setHorasEmpleados] = useState({})
  const [insumosUsados, setInsumosUsados] = useState([])
  const [insumoTemp, setInsumoTemp] = useState({ insumo_id: '', cantidad: '' })
  const [observacionesCierre, setObservacionesCierre] = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: ords }, { data: conts }, { data: emps }, { data: ins }] = await Promise.all([
      supabase.from('ordenes_trabajo').select(`*, contratos(numero_contrato, cliente_id, clientes(id, razon_social, nombre_contacto), tipos_servicio(nombre)), sucursales(nombre, direccion)`).order('fecha_programada', { ascending: false }),
      supabase.from('contratos').select(`id, numero_contrato, cliente_id, clientes(id, razon_social, nombre_contacto), tipos_servicio(nombre)`).eq('estado', 'activo'),
      supabase.from('empleados').select('id, nombre, apellido, costo_hora').eq('activo', true),
      supabase.from('insumos').select('id, nombre, unidad_medida, precio_costo, stock_actual').eq('activo', true).order('nombre')
    ])
    if (ords) setOrdenes(ords)
    if (conts) setContratos(conts)
    if (emps) setEmpleados(emps)
    if (ins) setInsumos(ins)
    setLoading(false)
  }

  async function cargarSucursales(clienteId) {
    if (!clienteId) { setSucursales([]); return }
    const { data } = await supabase.from('sucursales').select('*').eq('cliente_id', clienteId).eq('activa', true).order('nombre')
    if (data) setSucursales(data)
  }

  async function guardarOrden(e) {
    e.preventDefault()
    const { data: orden, error } = await supabase.from('ordenes_trabajo').insert([{
  ...form,
  sucursal_id: form.sucursal_id || null,
  hora_inicio: form.hora_inicio || null,
  hora_fin_estimada: form.hora_fin_estimada || null,
      numero_orden: 'OT-' + new Date().getFullYear() + '-' + (Math.floor(Math.random() * 9000) + 1000)
    }]).select().single()
    if (error) { alert('Error: ' + error.message); return }
    if (empleadosSeleccionados.length > 0) {
      await supabase.from('orden_empleados').insert(
        empleadosSeleccionados.map(id => ({ orden_id: orden.id, empleado_id: id, horas_trabajadas: 0 }))
      )
    }
    setMostrarForm(false)
    setForm({ contrato_id:'', sucursal_id:'', fecha_programada:'', hora_inicio:'', hora_fin_estimada:'', observaciones_previas:'' })
    setEmpleadosSeleccionados([])
    setSucursales([])
    cargarDatos()
  }

  async function abrirCierre(orden) {
    // Cargar empleados asignados a esta orden
    const { data: empOrden } = await supabase.from('orden_empleados').select('*, empleados(id, nombre, apellido, costo_hora)').eq('orden_id', orden.id)
    const horas = {}
    ;(empOrden || []).forEach(eo => { horas[eo.empleado_id] = { ...eo, horas: eo.horas_trabajadas || 0 } })
    setHorasEmpleados(horas)
    setInsumosUsados([])
    setInsumoTemp({ insumo_id: '', cantidad: '' })
    setObservacionesCierre('')
    setMostrarCierre(orden)
  }

  function agregarInsumo() {
    if (!insumoTemp.insumo_id || !insumoTemp.cantidad) return
    const ins = insumos.find(i => i.id === insumoTemp.insumo_id)
    if (!ins) return
    const ya = insumosUsados.find(i => i.insumo_id === insumoTemp.insumo_id)
    if (ya) {
      setInsumosUsados(insumosUsados.map(i => i.insumo_id === insumoTemp.insumo_id
        ? { ...i, cantidad: Number(i.cantidad) + Number(insumoTemp.cantidad) }
        : i))
    } else {
      setInsumosUsados([...insumosUsados, {
        insumo_id: ins.id, nombre: ins.nombre,
        unidad: ins.unidad_medida, cantidad: Number(insumoTemp.cantidad),
        precio_unitario: Number(ins.precio_costo || 0)
      }])
    }
    setInsumoTemp({ insumo_id: '', cantidad: '' })
  }

  function costoTotalHoras() {
    return Object.values(horasEmpleados).reduce((acc, eo) => {
      return acc + (Number(eo.horas) * Number(eo.empleados?.costo_hora || 0))
    }, 0)
  }

  function costoTotalInsumos() {
    return insumosUsados.reduce((acc, i) => acc + (i.cantidad * i.precio_unitario), 0)
  }

  async function completarOrden(e) {
    e.preventDefault()
    const orden = mostrarCierre
    const contrato = orden.contratos
    const clienteId = contrato?.cliente_id || contrato?.clientes?.id
    const fecha = orden.fecha_programada

    // 1. Actualizar estado de la orden
    await supabase.from('ordenes_trabajo').update({ estado: 'completada', observaciones_cierre: observacionesCierre }).eq('id', orden.id)

    // 2. Guardar horas de cada empleado y crear costo variable
    for (const [empId, eo] of Object.entries(horasEmpleados)) {
      const horas = Number(eo.horas)
      const costoHora = Number(eo.empleados?.costo_hora || 0)
      const costoMO = horas * costoHora
      await supabase.from('orden_empleados').update({ horas_trabajadas: horas, costo_calculado: costoMO }).eq('id', eo.id)
      if (horas > 0 && costoMO > 0 && clienteId) {
        await supabase.from('costos_variables').insert([{
          cliente_id: clienteId,
          contrato_id: contrato?.id || null,
          orden_id: orden.id,
          nombre: `Mano de obra — ${eo.empleados?.apellido} ${eo.empleados?.nombre} (${horas}hs) — ${orden.numero_orden}`,
          categoria: 'Mano de obra extra',
          monto: costoMO,
          fecha: fecha
        }])
      }
    }

    // 3. Guardar insumos usados y descontar stock
    for (const ins of insumosUsados) {
      const costo = ins.cantidad * ins.precio_unitario
      // Registrar en orden_insumos_usados
      await supabase.from('orden_insumos_usados').insert([{
        orden_id: orden.id,
        insumo_id: ins.insumo_id,
        cantidad: ins.cantidad,
        precio_unitario: ins.precio_unitario,
        costo_total: costo
      }])
      // Descontar stock
      const insumoActual = insumos.find(i => i.id === ins.insumo_id)
      if (insumoActual) {
        const nuevoStock = Number(insumoActual.stock_actual) - ins.cantidad
        await supabase.from('insumos').update({ stock_actual: Math.max(0, nuevoStock) }).eq('id', ins.insumo_id)
        // Registrar movimiento de stock
        await supabase.from('movimientos_stock').insert([{
          insumo_id: ins.insumo_id,
          tipo_movimiento: 'salida',
          cantidad: ins.cantidad,
          stock_anterior: Number(insumoActual.stock_actual),
          stock_nuevo: Math.max(0, nuevoStock),
          motivo: `Servicio ${orden.numero_orden}`
        }])
      }
      // Crear costo variable asignado al cliente
      if (clienteId && costo > 0) {
        await supabase.from('costos_variables').insert([{
          cliente_id: clienteId,
          contrato_id: contrato?.id || null,
          orden_id: orden.id,
          nombre: `Insumo: ${ins.nombre} (${ins.cantidad} ${ins.unidad}) — ${orden.numero_orden}`,
          categoria: 'Insumos de limpieza',
          monto: costo,
          fecha: fecha
        }])
      }
    }

    setMostrarCierre(null)
    cargarDatos()
    alert(`Orden ${orden.numero_orden} completada. Se registraron los costos automáticamente en el módulo de Costos.`)
  }

  async function cambiarEstado(id, estado) {
    if (estado === 'completada') {
      const orden = ordenes.find(o => o.id === id)
      if (orden) { abrirCierre(orden); return }
    }
    await supabase.from('ordenes_trabajo').update({ estado }).eq('id', id)
    cargarDatos()
  }

  const estadoColor = {
    programada:   { bg: '#dbeafe', color: '#1d4ed8' },
    en_curso:     { bg: '#fef3c7', color: '#d97706' },
    completada:   { bg: '#d1fae5', color: '#059669' },
    cancelada:    { bg: '#fee2e2', color: '#dc2626' },
    reprogramada: { bg: '#ede9fe', color: '#7c3aed' },
  }

  const filtradas = ordenes.filter(o => filtroFecha ? o.fecha_programada === filtroFecha : true)

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><CalendarDays size={19} /> Agenda de Servicios</h3>
          <p style={s.cabeceraSubtexto}>{ordenes.length} órdenes de trabajo</p>
        </div>
        <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nueva orden</>}
        </button>
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>Nueva orden de trabajo</h4>
          <form onSubmit={guardarOrden}>
            <div style={s.grid2}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Contrato</label>
                <select style={s.input} value={form.contrato_id} onChange={e => {
                  const ct = contratos.find(c => c.id === e.target.value)
                  setForm({...form, contrato_id: e.target.value, sucursal_id: ''})
                  cargarSucursales(ct?.cliente_id)
                }} required>
                  <option value="">Seleccionar contrato</option>
                  {contratos.map(ct => <option key={ct.id} value={ct.id}>{ct.numero_contrato} — {ct.clientes?.razon_social || ct.clientes?.nombre_contacto}</option>)}
                </select>
              </div>
              {sucursales.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Sucursal</label>
                  <select style={s.input} value={form.sucursal_id} onChange={e => setForm({...form, sucursal_id: e.target.value})}>
                    <option value="">Sin sucursal específica</option>
                    {sucursales.map(suc => <option key={suc.id} value={suc.id}>{suc.nombre}{suc.direccion ? ' — ' + suc.direccion : ''}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={s.label}>Fecha programada</label>
                <input type="date" style={s.input} value={form.fecha_programada} onChange={e => setForm({...form, fecha_programada: e.target.value})} required
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Hora de inicio</label>
                <input type="time" style={s.input} value={form.hora_inicio} onChange={e => setForm({...form, hora_inicio: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Empleados asignados</label>
                <div style={{ ...s.input, height: 'auto', padding: '10px 14px' }}>
                  {empleados.map(emp => (
                    <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}>
                      <input type="checkbox" checked={empleadosSeleccionados.includes(emp.id)}
                        onChange={() => setEmpleadosSeleccionados(prev => prev.includes(emp.id) ? prev.filter(i => i !== emp.id) : [...prev, emp.id])} />
                      <span style={{ fontSize: '13px', color: '#374151' }}>{emp.apellido}, {emp.nombre}</span>
                      {emp.costo_hora && <span style={{ fontSize: '11px', color: '#94a3b8' }}>(${emp.costo_hora}/h)</span>}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={s.label}>Observaciones</label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={3} value={form.observaciones_previas}
                  onChange={e => setForm({...form, observaciones_previas: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>Guardar orden</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <input type="date" style={{ ...s.buscador, maxWidth: '200px' }} value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
        {filtroFecha && <button style={s.btnSecundario} onClick={() => setFiltroFecha('')}>Limpiar filtro</button>}
      </div>

      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : filtradas.length === 0 ? <div style={s.empty}>{filtroFecha ? 'No hay servicios para esa fecha' : 'No hay órdenes registradas'}</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Número','Cliente','Sucursal','Servicio','Fecha','Hora','Estado','Acción'].map(h => (
                <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtradas.map((o, i) => {
                const ec = estadoColor[o.estado] || { bg: '#f1f5f9', color: '#64748b' }
                return (
                  <tr key={o.id} style={s.tablaFila(i)}>
                    <td style={{ ...s.tablaCell, fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>{o.numero_orden}</td>
                    <td style={s.tablaCellBold}>{o.contratos?.clientes?.razon_social || o.contratos?.clientes?.nombre_contacto}</td>
                    <td style={s.tablaCell}>{o.sucursales ? <span style={s.badge('#e0f2fe','#0891b2')}>{o.sucursales.nombre}</span> : <span style={{ color:'#94a3b8', fontSize:'12px' }}>—</span>}</td>
                    <td style={s.tablaCell}>{o.contratos?.tipos_servicio?.nombre}</td>
                    <td style={s.tablaCell}>{new Date(o.fecha_programada + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td style={s.tablaCell}>{o.hora_inicio || '—'}</td>
                    <td style={s.tablaCell}><span style={s.badge(ec.bg, ec.color)}>{o.estado}</span></td>
                    <td style={s.tablaCell}>
                      {o.estado !== 'completada' && o.estado !== 'cancelada' ? (
                        <select value={o.estado} onChange={e => cambiarEstado(o.id, e.target.value)}
                          style={{ ...s.input, padding: '6px 10px', fontSize: '12px', maxWidth: '160px' }}>
                          <option value="programada">Programada</option>
                          <option value="en_curso">En curso</option>
                          <option value="completada">Completar</option>
                          <option value="cancelada">Cancelada</option>
                          <option value="reprogramada">Reprogramada</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {o.estado === 'completada' ? 'Completada' : 'Cancelada'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL CIERRE DE ORDEN */}
      {mostrarCierre && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'20px' }}>
          <div style={{ background:'#fff', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'600px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div>
                <h4 style={{ margin:0, fontWeight:'800', color:'#0f172a', fontSize:'16px' }}>Completar orden</h4>
                <p style={{ margin:'4px 0 0', fontSize:'13px', color:'#64748b' }}>{mostrarCierre.numero_orden} · {mostrarCierre.contratos?.clientes?.razon_social || mostrarCierre.contratos?.clientes?.nombre_contacto}</p>
              </div>
              <button onClick={() => setMostrarCierre(null)} style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:'#94a3b8' }}><X size={16} /></button>
            </div>

            <form onSubmit={completarOrden}>

              {/* HORAS POR EMPLEADO */}
              {Object.keys(horasEmpleados).length > 0 && (
                <div style={{ background:'#f0fdf4', borderRadius:'12px', padding:'16px', marginBottom:'16px', border:'1px solid #86efac' }}>
                  <p style={{ ...s.label, color:'#059669', marginBottom:'12px', fontSize:'13px' }}>Horas trabajadas por empleado</p>
                  {Object.entries(horasEmpleados).map(([empId, eo]) => (
                    <div key={empId} style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
                      <span style={{ fontSize:'13px', color:'#374151', fontWeight:'600', minWidth:'160px' }}>{eo.empleados?.apellido}, {eo.empleados?.nombre}</span>
                      <span style={{ fontSize:'11px', color:'#94a3b8', minWidth:'80px' }}>${eo.empleados?.costo_hora}/h</span>
                      <input type="number" placeholder="Horas" value={eo.horas}
                        onChange={e => setHorasEmpleados({ ...horasEmpleados, [empId]: { ...eo, horas: e.target.value } })}
                        style={{ ...s.input, maxWidth:'80px', padding:'8px' }} min="0" step="0.5" />
                      <span style={{ fontSize:'13px', fontWeight:'700', color:'#059669', minWidth:'100px' }}>
                        = {(Number(eo.horas) * Number(eo.empleados?.costo_hora||0)).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}
                      </span>
                    </div>
                  ))}
                  <div style={{ borderTop:'1px solid #86efac', paddingTop:'10px', display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'13px', fontWeight:'700', color:'#059669' }}>Total mano de obra:</span>
                    <span style={{ fontSize:'14px', fontWeight:'800', color:'#059669' }}>{costoTotalHoras().toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                  </div>
                </div>
              )}

              {/* INSUMOS USADOS */}
              <div style={{ background:'#eff6ff', borderRadius:'12px', padding:'16px', marginBottom:'16px', border:'1px solid #93c5fd' }}>
                <p style={{ ...s.label, color:'#1d4ed8', marginBottom:'12px', fontSize:'13px' }}>Insumos utilizados</p>
                <div style={{ display:'flex', gap:'10px', marginBottom:'12px' }}>
                  <select style={{ ...s.input, flex:2 }} value={insumoTemp.insumo_id}
                    onChange={e => setInsumoTemp({...insumoTemp, insumo_id: e.target.value})}>
                    <option value="">Seleccionar insumo</option>
                    {insumos.map(ins => <option key={ins.id} value={ins.id}>{ins.nombre} (stock: {ins.stock_actual} {ins.unidad_medida})</option>)}
                  </select>
                  <input type="number" placeholder="Cantidad" style={{ ...s.input, flex:1 }} value={insumoTemp.cantidad}
                    onChange={e => setInsumoTemp({...insumoTemp, cantidad: e.target.value})} min="0" step="0.1" />
                  <button type="button" style={s.btnPrimario('#1d4ed8')} onClick={agregarInsumo}>Agregar</button>
                </div>
                {insumosUsados.length > 0 && (
                  <>
                    {insumosUsados.map((ins, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #bfdbfe', fontSize:'13px' }}>
                        <span style={{ color:'#374151', fontWeight:'500' }}>{ins.nombre}</span>
                        <span style={{ color:'#64748b' }}>{ins.cantidad} {ins.unidad}</span>
                        <span style={{ color:'#1d4ed8', fontWeight:'700' }}>{(ins.cantidad * ins.precio_unitario).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                        <button type="button" onClick={() => setInsumosUsados(insumosUsados.filter((_,j) => j !== i))}
                          style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:'16px' }}><X size={16} /></button>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'10px', fontWeight:'700', color:'#1d4ed8' }}>
                      <span>Total insumos:</span>
                      <span>{costoTotalInsumos().toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                    </div>
                  </>
                )}
              </div>

              {/* RESUMEN COSTOS */}
              <div style={{ background:'#fef3c7', borderRadius:'12px', padding:'16px', marginBottom:'16px', border:'1px solid #fcd34d' }}>
                <p style={{ ...s.label, color:'#d97706', marginBottom:'10px' }}>Resumen de costos del servicio</p>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'6px' }}>
                  <span style={{ color:'#374151' }}>Mano de obra</span>
                  <span style={{ fontWeight:'600', color:'#059669' }}>{costoTotalHoras().toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'10px' }}>
                  <span style={{ color:'#374151' }}>Insumos</span>
                  <span style={{ fontWeight:'600', color:'#1d4ed8' }}>{costoTotalInsumos().toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid #fcd34d', paddingTop:'10px', fontWeight:'800', color:'#d97706', fontSize:'15px' }}>
                  <span>Total costo real:</span>
                  <span>{(costoTotalHoras() + costoTotalInsumos()).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                </div>
                <p style={{ fontSize:'11px', color:'#92400e', margin:'8px 0 0' }}>
                  Estos costos se guardarán automáticamente en el módulo de Costos asignados a este cliente.
                </p>
              </div>

              <div style={{ marginBottom:'16px' }}>
                <label style={s.label}>Observaciones del cierre</label>
                <textarea style={{ ...s.input, resize:'vertical' }} rows={2} value={observacionesCierre}
                  onChange={e => setObservacionesCierre(e.target.value)} placeholder="Novedades, inconvenientes, observaciones..." />
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:'12px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setMostrarCierre(null)}>Cancelar</button>
                <button type="submit" style={s.btnPrimario('#059669')}>Confirmar y completar orden</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Agenda
