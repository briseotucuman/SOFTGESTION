import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { Briefcase, Plus, X } from 'lucide-react'

const c = colores.sueldos

function calcularLiquidacion(form) {
  const bruto = (parseFloat(form.sueldo_basico)||0) + (parseFloat(form.horas_extra)||0) + (parseFloat(form.bonificaciones)||0)
  const jubilacion = bruto * 0.11
  const obraSocial = bruto * 0.03
  const sindical = parseFloat(form.descuento_sindical)||0
  const otros = parseFloat(form.otros_descuentos)||0
  const totalDescuentos = jubilacion + obraSocial + sindical + otros
  const neto = bruto - totalDescuentos
  return { bruto, jubilacion, obraSocial, totalDescuentos, neto }
}

function Sueldos() {
  const [liquidaciones, setLiquidaciones] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [verDetalle, setVerDetalle] = useState(null)
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7))
  const [form, setForm] = useState({
    empleado_id: '', periodo: new Date().toISOString().slice(0, 7),
    fecha_pago: '', sueldo_basico: '', horas_extra: '0',
    bonificaciones: '0', descuento_sindical: '0', otros_descuentos: '0', observaciones: ''
  })

  useEffect(() => { cargarDatos() }, [periodo])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: liqs }, { data: emps }] = await Promise.all([
      supabase.from('liquidaciones_sueldo').select('*, empleados(nombre, apellido, puesto, tipo_contrato)').eq('periodo', periodo).order('creado_en', { ascending: false }),
      supabase.from('empleados').select('id, nombre, apellido, puesto, salario_base, tipo_contrato').eq('activo', true).order('apellido')
    ])
    if (liqs) setLiquidaciones(liqs)
    if (emps) setEmpleados(emps)
    setLoading(false)
  }

  function autocompletar(empleado_id) {
    const emp = empleados.find(e => e.id === empleado_id)
    if (emp) setForm(f => ({ ...f, empleado_id, sueldo_basico: emp.salario_base || '' }))
    else setForm(f => ({ ...f, empleado_id }))
  }

  async function guardarLiquidacion(e) {
    e.preventDefault()
    const { bruto, jubilacion, obraSocial, totalDescuentos, neto } = calcularLiquidacion(form)
    const { error } = await supabase.from('liquidaciones_sueldo').insert([{
      empleado_id: form.empleado_id,
      periodo: form.periodo,
      fecha_pago: form.fecha_pago || null,
      sueldo_basico: parseFloat(form.sueldo_basico)||0,
      horas_extra: parseFloat(form.horas_extra)||0,
      bonificaciones: parseFloat(form.bonificaciones)||0,
      descuento_jubilacion: jubilacion,
      descuento_obra_social: obraSocial,
      descuento_sindical: parseFloat(form.descuento_sindical)||0,
      otros_descuentos: parseFloat(form.otros_descuentos)||0,
      total_bruto: bruto,
      total_descuentos: totalDescuentos,
      total_neto: neto,
      observaciones: form.observaciones
    }])
    if (error) { alert('Error: ' + error.message); return }
    setMostrarForm(false)
    setForm({ empleado_id:'', periodo:new Date().toISOString().slice(0,7), fecha_pago:'', sueldo_basico:'', horas_extra:'0', bonificaciones:'0', descuento_sindical:'0', otros_descuentos:'0', observaciones:'' })
    cargarDatos()
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('liquidaciones_sueldo').update({ estado }).eq('id', id)
    cargarDatos()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta liquidación?')) return
    await supabase.from('liquidaciones_sueldo').delete().eq('id', id)
    cargarDatos()
  }

  const calc = calcularLiquidacion(form)
  const totalNeto = liquidaciones.reduce((a, l) => a + Number(l.total_neto), 0)
  const totalBruto = liquidaciones.reduce((a, l) => a + Number(l.total_bruto), 0)
  const pagadas = liquidaciones.filter(l => l.estado === 'pagada').length

  const estadoColor = {
    pendiente: { bg: '#fef3c7', color: '#d97706' },
    pagada:    { bg: '#d1fae5', color: '#059669' },
    cancelada: { bg: '#fee2e2', color: '#dc2626' },
  }

  // Empleados que ya tienen liquidacion este periodo
  const empleadosLiquidados = liquidaciones.map(l => l.empleado_id)
  const empleadosSinLiquidar = empleados.filter(e => !empleadosLiquidados.includes(e.id))

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>

      {/* CABECERA */}
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><Briefcase size={19} /> Liquidación de Sueldos</h3>
          <p style={s.cabeceraSubtexto}>{liquidaciones.length} liquidaciones · {periodo}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
            style={{ ...s.input, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', maxWidth: '180px' }} />
          <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nueva liquidación</>}
          </button>
        </div>
      </div>

      {/* ALERTA EMPLEADOS SIN LIQUIDAR */}
      {empleadosSinLiquidar.length > 0 && !mostrarForm && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, color: '#d97706', fontWeight: '600', fontSize: '13px' }}>
            {empleadosSinLiquidar.length} empleado(s) sin liquidar este período: {empleadosSinLiquidar.map(e => e.apellido + ' ' + e.nombre).join(', ')}
          </p>
          <button style={s.btnPrimario('#d97706')} onClick={() => setMostrarForm(true)}>Liquidar ahora</button>
        </div>
      )}

      {/* RESUMEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '20px' }}>
        <div style={{ ...s.card, background: '#f5f3ff', border: '1.5px solid #c4b5fd' }}>
          <p style={{ ...s.label, color: '#7c3aed' }}>Total bruto</p>
          <p style={{ fontSize: '20px', fontWeight: '800', color: '#7c3aed', margin: '4px 0 0' }}>{totalBruto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
        </div>
        <div style={{ ...s.card, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
          <p style={{ ...s.label, color: '#059669' }}>Total neto a pagar</p>
          <p style={{ fontSize: '20px', fontWeight: '800', color: '#059669', margin: '4px 0 0' }}>{totalNeto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
        </div>
        <div style={{ ...s.card, background: '#fef3c7', border: '1.5px solid #fcd34d' }}>
          <p style={{ ...s.label, color: '#d97706' }}>Pendientes de pago</p>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#d97706', margin: '4px 0 0' }}>{liquidaciones.length - pagadas}</p>
        </div>
        <div style={{ ...s.card, background: '#d1fae5', border: '1.5px solid #6ee7b7' }}>
          <p style={{ ...s.label, color: '#059669' }}>Pagadas</p>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#059669', margin: '4px 0 0' }}>{pagadas}</p>
        </div>
      </div>

      {/* FORMULARIO */}
      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>Nueva liquidación de sueldo</h4>
          <form onSubmit={guardarLiquidacion}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Empleado</label>
                <select style={s.input} value={form.empleado_id} onChange={e => autocompletar(e.target.value)} required>
                  <option value="">Seleccionar empleado</option>
                  {empleados.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.apellido}, {e.nombre} {empleadosLiquidados.includes(e.id) ? 'Ya liquidado' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>Período</label>
                <input type="month" style={s.input} value={form.periodo}
                  onChange={e => setForm({...form, periodo: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Fecha de pago</label>
                <input type="date" style={s.input} value={form.fecha_pago}
                  onChange={e => setForm({...form, fecha_pago: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>

            {/* HABERES */}
            <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', margin: '16px 0', border: '1px solid #86efac' }}>
              <p style={{ ...s.label, color: '#059669', marginBottom: '14px', fontSize: '13px' }}>Haberes</p>
              <div style={s.grid3}>
                <div>
                  <label style={s.label}>Sueldo básico ($)</label>
                  <input type="number" style={s.input} value={form.sueldo_basico}
                    onChange={e => setForm({...form, sueldo_basico: e.target.value})} required
                    onFocus={e => e.target.style.borderColor = '#059669'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div>
                  <label style={s.label}>Horas extra ($)</label>
                  <input type="number" style={s.input} value={form.horas_extra}
                    onChange={e => setForm({...form, horas_extra: e.target.value})}
                    onFocus={e => e.target.style.borderColor = '#059669'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div>
                  <label style={s.label}>Bonificaciones ($)</label>
                  <input type="number" style={s.input} value={form.bonificaciones}
                    onChange={e => setForm({...form, bonificaciones: e.target.value})}
                    onFocus={e => e.target.style.borderColor = '#059669'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>
            </div>

            {/* DESCUENTOS */}
            <div style={{ background: '#fff1f2', borderRadius: '12px', padding: '16px', margin: '0 0 16px', border: '1px solid #fca5a5' }}>
              <p style={{ ...s.label, color: '#dc2626', marginBottom: '14px', fontSize: '13px' }}>Descuentos</p>
              <div style={s.grid3}>
                <div>
                  <label style={s.label}>Jubilación 11% ($)</label>
                  <input type="text" style={{ ...s.input, background: '#f8fafc', color: '#94a3b8' }}
                    value={calc.jubilacion.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} readOnly />
                </div>
                <div>
                  <label style={s.label}>Obra social 3% ($)</label>
                  <input type="text" style={{ ...s.input, background: '#f8fafc', color: '#94a3b8' }}
                    value={calc.obraSocial.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} readOnly />
                </div>
                <div>
                  <label style={s.label}>Descuento sindical ($)</label>
                  <input type="number" style={s.input} value={form.descuento_sindical}
                    onChange={e => setForm({...form, descuento_sindical: e.target.value})}
                    onFocus={e => e.target.style.borderColor = '#dc2626'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div>
                  <label style={s.label}>Otros descuentos ($)</label>
                  <input type="number" style={s.input} value={form.otros_descuentos}
                    onChange={e => setForm({...form, otros_descuentos: e.target.value})}
                    onFocus={e => e.target.style.borderColor = '#dc2626'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>
            </div>

            {/* RESUMEN EN TIEMPO REAL */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#059669', fontWeight: '700', textTransform: 'uppercase' }}>Total bruto</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#059669' }}>
                  {calc.bruto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </p>
              </div>
              <div style={{ background: '#fff1f2', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#dc2626', fontWeight: '700', textTransform: 'uppercase' }}>Total descuentos</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#dc2626' }}>
                  {calc.totalDescuentos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </p>
              </div>
              <div style={{ background: '#f5f3ff', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '2px solid #a78bfa' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase' }}>Neto a cobrar</p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#7c3aed' }}>
                  {calc.neto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </p>
              </div>
            </div>

            <div>
              <label style={s.label}>Observaciones</label>
              <input style={s.input} value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})}
                onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>Guardar liquidación</button>
            </div>
          </form>
        </div>
      )}

      {/* TABLA */}
      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : liquidaciones.length === 0 ? <div style={s.empty}>No hay liquidaciones para este período</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Empleado','Puesto','Sueldo básico','Bruto','Descuentos','Neto','Estado',''].map(h => (
                <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {liquidaciones.map((l, i) => {
                const ec = estadoColor[l.estado] || { bg: '#f1f5f9', color: '#64748b' }
                return (
                  <tr key={l.id} style={s.tablaFila(i)}>
                    <td style={s.tablaCellBold}>{l.empleados?.apellido}, {l.empleados?.nombre}</td>
                    <td style={s.tablaCell}>{l.empleados?.puesto || '—'}</td>
                    <td style={s.tablaCell}>{Number(l.sueldo_basico).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={{ ...s.tablaCell, color: '#059669', fontWeight: '600' }}>{Number(l.total_bruto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={{ ...s.tablaCell, color: '#dc2626' }}>{Number(l.total_descuentos).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={{ ...s.tablaCellBold, color: '#7c3aed', fontSize: '15px' }}>{Number(l.total_neto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={s.tablaCell}>
                      <select value={l.estado} onChange={e => cambiarEstado(l.id, e.target.value)}
                        style={{ ...s.badge(ec.bg, ec.color), border: 'none', cursor: 'pointer', fontWeight: '700' }}>
                        <option value="pendiente">Pendiente</option>
                        <option value="pagada">Pagada</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                    </td>
                    <td style={s.tablaCell}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={{ ...s.btnPrimario(c.main), padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => setVerDetalle(l)}>Ver</button>
                        <button style={s.btnPeligro} onClick={() => eliminar(l.id)}><X size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: '#f5f3ff' }}>
                <td colSpan={4} style={{ ...s.tablaCellBold, color: '#7c3aed', textAlign: 'right' }}>Totales del período:</td>
                <td style={{ ...s.tablaCell, color: '#dc2626', fontWeight: '700' }}>{liquidaciones.reduce((a,l)=>a+Number(l.total_descuentos),0).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</td>
                <td style={{ ...s.tablaCellBold, color: '#7c3aed', fontSize: '15px' }}>{totalNeto.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL DETALLE */}
      {verDetalle && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
          <div style={{ background:'#fff', borderRadius:'20px', padding:'32px', width:'100%', maxWidth:'480px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div>
                <h4 style={{ margin:0, fontWeight:'800', color:'#0f172a', fontSize:'16px' }}>Recibo de sueldo</h4>
                <p style={{ margin:'4px 0 0', fontSize:'13px', color:'#64748b' }}>{verDetalle.empleados?.apellido}, {verDetalle.empleados?.nombre} · {verDetalle.periodo}</p>
              </div>
              <button onClick={() => setVerDetalle(null)} style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:'#94a3b8' }}><X size={16} /></button>
            </div>

            <div style={{ background:'#f0fdf4', borderRadius:'12px', padding:'16px', marginBottom:'12px' }}>
              <p style={{ margin:'0 0 8px', fontWeight:'700', color:'#059669', fontSize:'13px', textTransform:'uppercase' }}>Haberes</p>
              {[['Sueldo básico', verDetalle.sueldo_basico], ['Horas extra', verDetalle.horas_extra], ['Bonificaciones', verDetalle.bonificaciones]].map(([lbl, val]) => (
                Number(val) > 0 && <div key={lbl} style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'4px 0', color:'#374151' }}>
                  <span>{lbl}</span><span style={{ fontWeight:'600' }}>{Number(val).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid #86efac', marginTop:'8px', paddingTop:'8px', fontWeight:'800', color:'#059669' }}>
                <span>Total bruto</span><span>{Number(verDetalle.total_bruto).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
              </div>
            </div>

            <div style={{ background:'#fff1f2', borderRadius:'12px', padding:'16px', marginBottom:'12px' }}>
              <p style={{ margin:'0 0 8px', fontWeight:'700', color:'#dc2626', fontSize:'13px', textTransform:'uppercase' }}>Descuentos</p>
              {[['Jubilación (11%)', verDetalle.descuento_jubilacion], ['Obra social (3%)', verDetalle.descuento_obra_social], ['Sindical', verDetalle.descuento_sindical], ['Otros', verDetalle.otros_descuentos]].map(([lbl, val]) => (
                Number(val) > 0 && <div key={lbl} style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'4px 0', color:'#374151' }}>
                  <span>{lbl}</span><span style={{ fontWeight:'600', color:'#dc2626' }}>-{Number(val).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid #fca5a5', marginTop:'8px', paddingTop:'8px', fontWeight:'800', color:'#dc2626' }}>
                <span>Total descuentos</span><span>-{Number(verDetalle.total_descuentos).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
              </div>
            </div>

            <div style={{ background:'#f5f3ff', borderRadius:'12px', padding:'16px', border:'2px solid #a78bfa', textAlign:'center' }}>
              <p style={{ margin:'0 0 4px', fontSize:'12px', color:'#7c3aed', fontWeight:'700', textTransform:'uppercase' }}>Neto a cobrar</p>
              <p style={{ margin:0, fontSize:'32px', fontWeight:'900', color:'#7c3aed' }}>{Number(verDetalle.total_neto).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
            </div>

            {verDetalle.observaciones && (
              <p style={{ margin:'12px 0 0', fontSize:'12px', color:'#64748b' }}>{verDetalle.observaciones}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Sueldos
