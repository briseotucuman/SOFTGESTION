import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { Plus, Wallet, X } from 'lucide-react'

const c = colores.presupuestos

function indicadorMargen(margen) {
  if (margen >= 30) return { color: '#059669', bg: '#d1fae5', label: 'Margen excelente', emoji: '' }
  if (margen >= 15) return { color: '#d97706', bg: '#fef3c7', label: 'Margen ajustado', emoji: '' }
  return { color: '#dc2626', bg: '#fee2e2', label: 'Margen bajo', emoji: '' }
}

function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState([])
  const [clientes, setClientes] = useState([])
  const [tiposServicio, setTiposServicio] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({
    cliente_id: '', tipo_servicio_id: '', descripcion: '',
    fecha_vencimiento: '', costo_mano_obra: '', costo_insumos: '',
    costo_traslado: '', otros_costos: '', porcentaje_ganancia: '30', observaciones: ''
  })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: pres }, { data: clis }, { data: tipos }] = await Promise.all([
      supabase.from('presupuestos').select(`*, clientes(razon_social,nombre_contacto), tipos_servicio(nombre)`).order('creado_en', { ascending: false }),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true),
      supabase.from('tipos_servicio').select('*').eq('activo', true)
    ])
    if (pres) setPresupuestos(pres)
    if (clis) setClientes(clis)
    if (tipos) setTiposServicio(tipos)
    setLoading(false)
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
      ...form,
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
    setMostrarForm(false)
    setForm({ cliente_id:'', tipo_servicio_id:'', descripcion:'', fecha_vencimiento:'', costo_mano_obra:'', costo_insumos:'', costo_traslado:'', otros_costos:'', porcentaje_ganancia:'30', observaciones:'' })
    cargarDatos()
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('presupuestos').update({ estado }).eq('id', id)
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
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><Wallet size={19} /> Presupuestos</h3>
          <p style={s.cabeceraSubtexto}>{presupuestos.length} presupuestos registrados</p>
        </div>
        <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo presupuesto</>}
        </button>
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>Nuevo presupuesto</h4>
          <form onSubmit={guardarPresupuesto}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Cliente</label>
                <select style={s.input} value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})} required>
                  <option value="">Seleccionar cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social || c.nombre_contacto}</option>)}
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
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={form.descripcion}
                  onChange={e => setForm({...form, descripcion: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Fecha de vencimiento</label>
                <input type="date" style={s.input} value={form.fecha_vencimiento}
                  onChange={e => setForm({...form, fecha_vencimiento: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>

            {/* DESGLOSE DE COSTOS */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '18px', margin: '16px 0', border: '1px solid #e2e8f0' }}>
              <p style={{ ...s.label, marginBottom: '14px', color: '#475569', fontSize: '13px' }}>Desglose de costos</p>
              <div style={s.grid2}>
                {[
                  ['Mano de obra', 'costo_mano_obra'],
                  ['Insumos', 'costo_insumos'],
                  ['Traslado', 'costo_traslado'],
                  ['Otros costos', 'otros_costos']
                ].map(([lbl, key]) => (
                  <div key={key}>
                    <label style={{ ...s.label, fontSize: '11px' }}>{lbl} ($)</label>
                    <input type="number" style={s.input} value={form[key]} placeholder="0"
                      onChange={e => setForm({...form, [key]: e.target.value})}
                      onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                ))}
              </div>
            </div>

            {/* PANEL DE RENTABILIDAD EN TIEMPO REAL */}
            <div style={{ background: hayCostos ? ind.bg : '#f8fafc', borderRadius: '14px', padding: '20px', margin: '0 0 16px', border: `2px solid ${hayCostos ? ind.color : '#e2e8f0'}`, transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: hayCostos ? ind.color : '#94a3b8' }}>
                  {hayCostos ? ind.label : 'Completá los costos para ver la rentabilidad'}
                </p>
                {hayCostos && <span style={{ fontSize: '24px' }}>{ind.emoji}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Costo total</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#dc2626' }}>
                    {costoTotal().toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <label style={{ ...s.label, fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Margen (%)</label>
                  <input type="number" value={form.porcentaje_ganancia}
                    onChange={e => setForm({...form, porcentaje_ganancia: e.target.value})}
                    style={{ ...s.input, textAlign: 'center', fontWeight: '800', fontSize: '16px', padding: '6px', background: 'transparent', border: '1.5px solid #e2e8f0' }} />
                </div>

                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Ganancia</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#059669' }}>
                    {gananciaEnPesos().toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </p>
                </div>

                <div style={{ background: hayCostos ? ind.color : '#e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: hayCostos ? 'rgba(255,255,255,0.8)' : '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Precio final</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: hayCostos ? '#fff' : '#94a3b8' }}>
                    {precioFinal().toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </p>
                </div>
              </div>

              {hayCostos && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: ind.color, marginBottom: '6px', fontWeight: '600' }}>
                    <span>Margen sobre precio de venta</span>
                    <span>{margenReal().toFixed(1)}%</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '99px', height: '10px' }}>
                    <div style={{
                      background: ind.color, height: '10px', borderRadius: '99px',
                      width: Math.min(margenReal(), 100) + '%', transition: 'width 0.4s'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    <span>0%</span><span>Recomendado: 30%+</span><span>100%</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" style={s.btnSecundario} onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>Guardar presupuesto</button>
            </div>
          </form>
        </div>
      )}

      {/* TABLA */}
      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : presupuestos.length === 0 ? <div style={s.empty}>No hay presupuestos registrados</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Número','Cliente','Servicio','Costo total','Ganancia','Margen','Precio final','Estado'].map(h => (
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
                    <td style={{ ...s.tablaCell, color: '#dc2626', fontWeight: '600' }}>{Number(p.subtotal||0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={{ ...s.tablaCell, color: '#059669', fontWeight: '600' }}>{ganancia.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={s.tablaCell}>
                      <span style={s.badge(mi.bg, mi.color)}>{mi.emoji} {margen.toFixed(1)}%</span>
                    </td>
                    <td style={{ ...s.tablaCellBold, color: c.main }}>{Number(p.precio_final).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={s.tablaCell}>
                      <select value={p.estado} onChange={e => cambiarEstado(p.id, e.target.value)}
                        style={{ ...s.badge(ec.bg, ec.color), border: 'none', cursor: 'pointer', fontWeight: '700' }}>
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
    </div>
  )
}

export default Presupuestos
