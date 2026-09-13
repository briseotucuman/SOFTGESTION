import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { Plus, Wallet, X, Calculator, Tag } from 'lucide-react'

const c = colores.presupuestos

function indicadorMargen(margen) {
  if (margen >= 30) return { color: '#059669', bg: '#d1fae5', label: 'Margen excelente' }
  if (margen >= 15) return { color: '#d97706', bg: '#fef3c7', label: 'Margen ajustado' }
  return { color: '#dc2626', bg: '#fee2e2', label: 'Margen bajo' }
}

function Presupuestos() {
  const [vista, setVista] = useState('presupuestos') // presupuestos | tarifas
  const [presupuestos, setPresupuestos] = useState([])
  const [clientes, setClientes] = useState([])
  const [tiposServicio, setTiposServicio] = useState([])
  const [tiposCliente, setTiposCliente] = useState([])
  const [tarifas, setTarifas] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({
    cliente_id: '', tipo_servicio_id: '', descripcion: '',
    fecha_vencimiento: '', horas_estimadas: '', costo_mano_obra: '', costo_insumos: '',
    costo_traslado: '', otros_costos: '', porcentaje_ganancia: '30', observaciones: ''
  })
  const [nuevoTipoCliente, setNuevoTipoCliente] = useState('')
  const [tarifasEditadas, setTarifasEditadas] = useState({}) // key `${tipoClienteId}_${tipoServicioId}` -> precio_hora

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: pres }, { data: clis }, { data: tipos }, { data: tiposCli }, { data: tarifasData }, { data: emps }] = await Promise.all([
      supabase.from('presupuestos').select(`*, clientes(razon_social,nombre_contacto,tipo_cliente_id), tipos_servicio(nombre)`).order('creado_en', { ascending: false }),
      supabase.from('clientes').select('id, razon_social, nombre_contacto, tipo_cliente_id').eq('activo', true),
      supabase.from('tipos_servicio').select('*').eq('activo', true),
      supabase.from('tipos_cliente').select('*').eq('activo', true).order('nombre'),
      supabase.from('tarifas_servicio').select('*'),
      supabase.from('empleados').select('costo_hora').eq('activo', true)
    ])
    if (pres) setPresupuestos(pres)
    if (clis) setClientes(clis)
    if (tipos) setTiposServicio(tipos)
    if (tiposCli) setTiposCliente(tiposCli)
    if (tarifasData) setTarifas(tarifasData)
    if (emps) setEmpleados(emps)
    setLoading(false)
  }

  // ------- Costo interno de mano de obra (promedio real de empleados activos) -------
  const costoHoraInterno = empleados.length > 0
    ? empleados.reduce((a, e) => a + Number(e.costo_hora || 0), 0) / empleados.length
    : 0

  // ------- Tarifa estándar para el cliente/servicio elegidos en el form -------
  const clienteSeleccionado = clientes.find(cl => cl.id === form.cliente_id)
  const tarifaEncontrada = clienteSeleccionado?.tipo_cliente_id && form.tipo_servicio_id
    ? tarifas.find(t => t.tipo_cliente_id === clienteSeleccionado.tipo_cliente_id && t.tipo_servicio_id === form.tipo_servicio_id)
    : null

  function aplicarCalculoPorHoras() {
    const horas = parseFloat(form.horas_estimadas) || 0
    if (horas <= 0) return
    const costoManoObra = horas * costoHoraInterno
    let nuevoForm = { ...form, costo_mano_obra: costoManoObra.toFixed(2) }
    if (tarifaEncontrada) {
      const precioVentaManoObra = horas * Number(tarifaEncontrada.precio_hora)
      const otrosCostos = (parseFloat(form.costo_insumos)||0) + (parseFloat(form.costo_traslado)||0) + (parseFloat(form.otros_costos)||0)
      const costoTotalConOtros = costoManoObra + otrosCostos
      // % de ganancia sugerido para que el total dé aproximadamente la tarifa estándar de mano de obra + costos reales de lo demás
      const precioSugerido = precioVentaManoObra + otrosCostos
      const gananciaSugerida = costoTotalConOtros > 0 ? ((precioSugerido - costoTotalConOtros) / costoTotalConOtros) * 100 : 30
      nuevoForm.porcentaje_ganancia = Math.max(0, gananciaSugerida).toFixed(1)
    }
    setForm(nuevoForm)
  }

  const costoTotal = () =>
    (parseFloat(form.costo_mano_obra)||0) +
    (parseFloat(form.costo_insumos)||0) +
    (parseFloat(form.costo_traslado)||0) +
    (parseFloat(form.otros_costos)||0)

  const precioFinal = () => costoTotal() * (1 + (parseFloat(form.porcentaje_ganancia)||0) / 100)
  const gananciaEnPesos = () => precioFinal() - costoTotal()
  const margenReal = () => precioFinal() > 0 ? (gananciaEnPesos() / precioFinal()) * 100 : 0

  async function guardarPresupuesto(e) {
    e.preventDefault()
    const subtotal = costoTotal()
    const { error } = await supabase.from('presupuestos').insert([{
      cliente_id: form.cliente_id,
      tipo_servicio_id: form.tipo_servicio_id || null,
      descripcion: form.descripcion,
      fecha_vencimiento: form.fecha_vencimiento || null,
      horas_estimadas: parseFloat(form.horas_estimadas) || null,
      observaciones: form.observaciones,
      numero_presupuesto: 'PRES-' + new Date().getFullYear() + '-' + (Math.floor(Math.random()*900)+100),
      fecha_emision: new Date().toISOString().split('T')[0],
      costo_mano_obra: parseFloat(form.costo_mano_obra)||0,
      costo_insumos: parseFloat(form.costo_insumos)||0,
      costo_traslado: parseFloat(form.costo_traslado)||0,
      otros_costos: parseFloat(form.otros_costos)||0,
      subtotal,
      porcentaje_ganancia: parseFloat(form.porcentaje_ganancia)||0,
      precio_final: parseFloat(precioFinal().toFixed(2))
    }])
    if (error) { alert('Error: ' + error.message); return }
    cerrarForm()
    cargarDatos()
  }

  function cerrarForm() {
    setMostrarForm(false)
    setForm({ cliente_id:'', tipo_servicio_id:'', descripcion:'', fecha_vencimiento:'', horas_estimadas:'', costo_mano_obra:'', costo_insumos:'', costo_traslado:'', otros_costos:'', porcentaje_ganancia:'30', observaciones:'' })
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('presupuestos').update({ estado }).eq('id', id)
    cargarDatos()
  }

  // ------- Gestión de tipos de cliente y tarifas -------
  async function agregarTipoCliente() {
    if (!nuevoTipoCliente.trim()) return
    await supabase.from('tipos_cliente').insert([{ nombre: nuevoTipoCliente.trim() }])
    setNuevoTipoCliente('')
    cargarDatos()
  }

  function valorCelda(tipoClienteId, tipoServicioId) {
    const key = `${tipoClienteId}_${tipoServicioId}`
    if (key in tarifasEditadas) return tarifasEditadas[key]
    const existente = tarifas.find(t => t.tipo_cliente_id === tipoClienteId && t.tipo_servicio_id === tipoServicioId)
    return existente ? existente.precio_hora : ''
  }

  function cambiarCelda(tipoClienteId, tipoServicioId, valor) {
    setTarifasEditadas(prev => ({ ...prev, [`${tipoClienteId}_${tipoServicioId}`]: valor }))
  }

  async function guardarTarifas() {
    const filas = Object.entries(tarifasEditadas)
      .filter(([, v]) => v !== '' && v != null)
      .map(([key, precio_hora]) => {
        const [tipo_cliente_id, tipo_servicio_id] = key.split('_')
        return { tipo_cliente_id, tipo_servicio_id, precio_hora: parseFloat(precio_hora) || 0 }
      })
    if (filas.length === 0) return
    const { error } = await supabase.from('tarifas_servicio').upsert(filas, { onConflict: 'tipo_cliente_id,tipo_servicio_id' })
    if (error) { alert('Error: ' + error.message); return }
    setTarifasEditadas({})
    cargarDatos()
  }

  const estadoColor = {
    pendiente:  { bg: '#fef3c7', color: '#d97706' },
    aprobado:   { bg: '#d1fae5', color: '#059669' },
    rechazado:  { bg: '#fee2e2', color: '#dc2626' },
    vencido:    { bg: '#f1f5f9', color: '#64748b' },
  }

  const ind = indicadorMargen(margenReal())
  const hayCostos = costoTotal() > 0

  return (
    <div>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><Wallet size={19} /> Presupuestos</h3>
          <p style={s.cabeceraSubtexto}>{presupuestos.length} presupuestos registrados</p>
        </div>
        {vista === 'presupuestos' && (
          <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => mostrarForm ? cerrarForm() : setMostrarForm(true)}>
            {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo presupuesto</>}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button onClick={() => setVista('presupuestos')} style={vista === 'presupuestos' ? s.btnPrimario(c.main) : s.btnSecundario}>Presupuestos</button>
        <button onClick={() => setVista('tarifas')} style={vista === 'tarifas' ? s.btnPrimario(c.main) : s.btnSecundario}>
          <Calculator size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Tarifas estándar
        </button>
      </div>

      {vista === 'tarifas' && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h4 style={{ margin: '0 0 4px', color: paleta.ink, fontWeight: '700', fontSize: '15px' }}>Precio por hora según tipo de cliente y servicio</h4>
              <p style={{ margin: 0, color: paleta.muted, fontSize: '12.5px' }}>Costo interno de mano de obra (promedio de empleados activos): <strong>{costoHoraInterno.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}/hora</strong></p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={{ ...s.input, width: '180px' }} placeholder="Nuevo tipo de cliente" value={nuevoTipoCliente} onChange={e => setNuevoTipoCliente(e.target.value)} />
              <button style={s.btnSecundario} onClick={agregarTipoCliente}><Tag size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Agregar</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={s.tabla}>
              <thead>
                <tr>
                  <th style={s.tablaCabecera(c.main)}>Servicio \ Cliente</th>
                  {tiposCliente.map(tc => <th key={tc.id} style={s.tablaCabecera(c.main)}>{tc.nombre}</th>)}
                </tr>
              </thead>
              <tbody>
                {tiposServicio.map((ts, i) => (
                  <tr key={ts.id} style={s.tablaFila(i)}>
                    <td style={s.tablaCellBold}>{ts.nombre}</td>
                    {tiposCliente.map(tc => (
                      <td key={tc.id} style={s.tablaCell}>
                        <input type="number" step="0.01" style={{ ...s.input, padding: '6px 8px', width: '100px' }}
                          value={valorCelda(tc.id, ts.id)}
                          onChange={e => cambiarCelda(tc.id, ts.id, e.target.value)}
                          placeholder="$/hora" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button style={s.btnPrimario(c.main)} onClick={guardarTarifas} disabled={Object.keys(tarifasEditadas).length === 0}>Guardar tarifas</button>
          </div>
        </div>
      )}

      {vista === 'presupuestos' && mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>Nuevo presupuesto</h4>
          <form onSubmit={guardarPresupuesto}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Cliente</label>
                <select style={s.input} value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})} required>
                  <option value="">Seleccionar cliente</option>
                  {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Tipo de servicio</label>
                <select style={s.input} value={form.tipo_servicio_id} onChange={e => setForm({...form, tipo_servicio_id: e.target.value})}>
                  <option value="">Seleccionar servicio</option>
                  {tiposServicio.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Descripción del trabajo</label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} />
              </div>
              <div>
                <label style={s.label}>Fecha de vencimiento</label>
                <input type="date" style={s.input} value={form.fecha_vencimiento} onChange={e => setForm({...form, fecha_vencimiento: e.target.value})} />
              </div>
            </div>

            {/* CALCULADORA POR HORAS */}
            <div style={{ background: paleta.brandSoft, borderRadius: '12px', padding: '18px', margin: '16px 0', border: `1px solid ${c.main}33` }}>
              <p style={{ ...s.label, marginBottom: '12px', color: c.main, fontSize: '13px', display:'flex', alignItems:'center', gap:'6px' }}>
                <Calculator size={14} /> Calculadora por horas (estandarizada)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label style={{ ...s.label, fontSize: '11px' }}>Horas estimadas</label>
                  <input type="number" style={s.input} value={form.horas_estimadas} onChange={e => setForm({...form, horas_estimadas: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <p style={{ ...s.label, fontSize: '11px' }}>Tarifa estándar (cliente/servicio)</p>
                  <p style={{ margin: 0, fontWeight: '700', color: paleta.ink }}>{tarifaEncontrada ? `${Number(tarifaEncontrada.precio_hora).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}/hora` : 'Sin tarifa cargada'}</p>
                </div>
                <div>
                  <p style={{ ...s.label, fontSize: '11px' }}>Costo interno real</p>
                  <p style={{ margin: 0, fontWeight: '700', color: paleta.ink }}>{costoHoraInterno.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}/hora</p>
                </div>
                <button type="button" style={s.btnPrimario(c.main)} onClick={aplicarCalculoPorHoras} disabled={!form.horas_estimadas}>Aplicar</button>
              </div>
              {!clienteSeleccionado?.tipo_cliente_id && form.cliente_id && (
                <p style={{ marginTop: '8px', fontSize: '12px', color: paleta.warn }}>Este cliente no tiene un tipo asignado — asignale uno en la ficha del cliente para usar la tarifa estándar.</p>
              )}
            </div>

            {/* DESGLOSE DE COSTOS */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '18px', margin: '16px 0', border: '1px solid #e2e8f0' }}>
              <p style={{ ...s.label, marginBottom: '14px', color: '#475569', fontSize: '13px' }}>Desglose de costos (internos)</p>
              <div style={s.grid2}>
                {[
                  ['Mano de obra', 'costo_mano_obra'],
                  ['Insumos', 'costo_insumos'],
                  ['Traslado', 'costo_traslado'],
                  ['Otros costos', 'otros_costos']
                ].map(([lbl, key]) => (
                  <div key={key}>
                    <label style={{ ...s.label, fontSize: '11px' }}>{lbl} ($)</label>
                    <input type="number" style={s.input} value={form[key]} placeholder="0" onChange={e => setForm({...form, [key]: e.target.value})} />
                  </div>
                ))}
              </div>
            </div>

            {/* PANEL DE RENTABILIDAD */}
            <div style={{ background: hayCostos ? ind.bg : '#f8fafc', borderRadius: '14px', padding: '20px', margin: '0 0 16px', border: `2px solid ${hayCostos ? ind.color : '#e2e8f0'}` }}>
              <p style={{ margin: '0 0 16px', fontWeight: '700', fontSize: '14px', color: hayCostos ? ind.color : '#94a3b8' }}>
                {hayCostos ? ind.label : 'Completá los costos para ver la rentabilidad'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Costo total</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#dc2626' }}>{costoTotal().toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <label style={{ ...s.label, fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Margen (%)</label>
                  <input type="number" value={form.porcentaje_ganancia} onChange={e => setForm({...form, porcentaje_ganancia: e.target.value})}
                    style={{ ...s.input, textAlign: 'center', fontWeight: '800', fontSize: '16px', padding: '6px', background: 'transparent', border: '1.5px solid #e2e8f0' }} />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Ganancia</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#059669' }}>{gananciaEnPesos().toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
                </div>
                <div style={{ background: hayCostos ? ind.color : '#e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: hayCostos ? 'rgba(255,255,255,0.8)' : '#94a3b8', fontWeight: '600' }}>Precio final</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: hayCostos ? '#fff' : '#94a3b8' }}>{precioFinal().toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
                </div>
              </div>
              {hayCostos && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: ind.color, marginBottom: '6px', fontWeight: '600' }}>
                    <span>Margen sobre precio de venta</span><span>{margenReal().toFixed(1)}%</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '99px', height: '10px' }}>
                    <div style={{ background: ind.color, height: '10px', borderRadius: '99px', width: Math.min(margenReal(), 100) + '%', transition: 'width 0.4s' }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" style={s.btnSecundario} onClick={cerrarForm}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>Guardar presupuesto</button>
            </div>
          </form>
        </div>
      )}

      {vista === 'presupuestos' && (
      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : presupuestos.length === 0 ? <div style={s.empty}>No hay presupuestos registrados</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Número','Cliente','Servicio','Horas','Costo total','Ganancia','Margen','Precio final','Estado'].map(h => (
                <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {presupuestos.map((p, i) => {
                const ec = estadoColor[p.estado] || { bg: '#f1f5f9', color: '#64748b' }
                const ganancia = Number(p.precio_final) - Number(p.subtotal||0)
                const margen = Number(p.precio_final) > 0 ? (ganancia / Number(p.precio_final)) * 100 : 0
                const mi = indicadorMargen(margen)
                return (
                  <tr key={p.id} style={s.tablaFila(i)}>
                    <td style={{ ...s.tablaCell, fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>{p.numero_presupuesto}</td>
                    <td style={s.tablaCellBold}>{p.clientes?.razon_social || p.clientes?.nombre_contacto}</td>
                    <td style={s.tablaCell}>{p.tipos_servicio?.nombre || '—'}</td>
                    <td style={s.tablaCell}>{p.horas_estimadas || '—'}</td>
                    <td style={{ ...s.tablaCell, color: '#dc2626', fontWeight: '600' }}>{Number(p.subtotal||0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={{ ...s.tablaCell, color: '#059669', fontWeight: '600' }}>{ganancia.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={s.tablaCell}><span style={s.badge(mi.bg, mi.color)}>{margen.toFixed(1)}%</span></td>
                    <td style={{ ...s.tablaCellBold, color: c.main }}>{Number(p.precio_final).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={s.tablaCell}>
                      <select value={p.estado} onChange={e => cambiarEstado(p.id, e.target.value)} style={{ ...s.badge(ec.bg, ec.color), border: 'none', cursor: 'pointer', fontWeight: '700' }}>
                        <option value="pendiente">Pendiente</option>
                        <option value="aprobado">Aprobado</option>
                        <option value="rechazado">Rechazado</option>
                        <option value="vencido">Vencido</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  )
}

export default Presupuestos
