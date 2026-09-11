import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { ClipboardList, Plus, X } from 'lucide-react'

const c = colores.costos

function Costos() {
  const [vista, setVista] = useState('fijos')
  const [costosFijos, setCostosFijos] = useState([])
  const [costosVariables, setCostosVariables] = useState([])
  const [clientes, setClientes] = useState([])
  const [contratos, setContratos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormFijo, setMostrarFormFijo] = useState(false)
  const [mostrarFormVariable, setMostrarFormVariable] = useState(false)
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))

  const [formFijo, setFormFijo] = useState({ nombre: '', categoria: '', monto: '', frecuencia: 'mensual', mes: new Date().toISOString().slice(0, 7), observaciones: '' })
  const [formVariable, setFormVariable] = useState({ cliente_id: '', contrato_id: '', nombre: '', categoria: '', monto: '', fecha: new Date().toISOString().split('T')[0], observaciones: '' })

  const categoriasFijos = ['Sueldos y cargas', 'Alquiler', 'Servicios (luz/gas/agua)', 'Seguro', 'Administración', 'Transporte fijo', 'Otros fijos']
  const categoriasVariables = ['Insumos de limpieza', 'Mano de obra extra', 'Traslado', 'Equipamiento', 'Subcontratación', 'Otros variables']

  useEffect(() => { cargarDatos() }, [mes])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: fijos }, { data: variables }, { data: clis }, { data: conts }] = await Promise.all([
      supabase.from('costos_fijos').select('*').eq('activo', true).eq('mes', mes).order('creado_en', { ascending: false }),
      supabase.from('costos_variables').select('*, clientes(razon_social,nombre_contacto), contratos(numero_contrato)').gte('fecha', mes + '-01').lte('fecha', mes+'-'+new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()).order('fecha', { ascending: false }),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true),
      supabase.from('contratos').select('id, numero_contrato, cliente_id, clientes(razon_social,nombre_contacto)').eq('estado', 'activo')
    ])
    if (fijos) setCostosFijos(fijos)
    if (variables) setCostosVariables(variables)
    if (clis) setClientes(clis)
    if (conts) setContratos(conts)
    setLoading(false)
  }

  async function guardarFijo(e) {
    e.preventDefault()
    const { error } = await supabase.from('costos_fijos').insert([{ ...formFijo, monto: parseFloat(formFijo.monto) }])
    if (error) { alert('Error: ' + error.message); return }
    setMostrarFormFijo(false)
    setFormFijo({ nombre: '', categoria: '', monto: '', frecuencia: 'mensual', mes: new Date().toISOString().slice(0, 7), observaciones: '' })
    cargarDatos()
  }

  async function guardarVariable(e) {
    e.preventDefault()
    const { error } = await supabase.from('costos_variables').insert([{ ...formVariable, monto: parseFloat(formVariable.monto), cliente_id: formVariable.cliente_id || null, contrato_id: formVariable.contrato_id || null }])
    if (error) { alert('Error: ' + error.message); return }
    setMostrarFormVariable(false)
    setFormVariable({ cliente_id: '', contrato_id: '', nombre: '', categoria: '', monto: '', fecha: new Date().toISOString().split('T')[0], observaciones: '' })
    cargarDatos()
  }

  async function eliminarFijo(id) {
    if (!confirm('¿Eliminar este costo?')) return
    await supabase.from('costos_fijos').update({ activo: false }).eq('id', id)
    cargarDatos()
  }

  async function eliminarVariable(id) {
    if (!confirm('¿Eliminar este costo?')) return
    await supabase.from('costos_variables').delete().eq('id', id)
    cargarDatos()
  }

  const totalFijos = costosFijos.reduce((a, c) => a + Number(c.monto), 0)
  const totalVariables = costosVariables.reduce((a, c) => a + Number(c.monto), 0)
  const totalCostos = totalFijos + totalVariables

  // Agrupar variables por cliente
  const variablesPorCliente = {}
  costosVariables.forEach(cv => {
    const nombre = cv.clientes?.razon_social || cv.clientes?.nombre_contacto || 'Sin asignar'
    if (!variablesPorCliente[nombre]) variablesPorCliente[nombre] = 0
    variablesPorCliente[nombre] += Number(cv.monto)
  })
  const rankingClientes = Object.entries(variablesPorCliente)
    .map(([cliente, monto]) => ({ cliente, monto }))
    .sort((a, b) => b.monto - a.monto)
  const maxCosto = rankingClientes[0]?.monto || 1

  // Agrupar fijos por categoria
  const fijosPorCategoria = {}
  costosFijos.forEach(cf => {
    const cat = cf.categoria || 'Sin categoría'
    if (!fijosPorCategoria[cat]) fijosPorCategoria[cat] = 0
    fijosPorCategoria[cat] += Number(cf.monto)
  })

  const contratosFiltrados = formVariable.cliente_id
    ? contratos.filter(ct => ct.cliente_id === formVariable.cliente_id)
    : contratos

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* CABECERA */}
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><ClipboardList size={19} /> Costos</h3>
          <p style={s.cabeceraSubtexto}>Costos fijos y variables del mes</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          style={{ ...s.input, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', maxWidth: '180px' }} />
      </div>

      {/* RESUMEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '20px' }}>
        <div style={{ ...s.card, background: '#f0fdfa', border: '1.5px solid #99f6e4' }}>
          <p style={{ ...s.label, color: '#0f766e' }}>Costos fijos del mes</p>
          <p style={{ fontSize: '24px', fontWeight: '800', color: '#0f766e', margin: '4px 0 0' }}>
            {totalFijos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </p>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>{costosFijos.length} ítems</p>
        </div>
        <div style={{ ...s.card, background: '#fff7ed', border: '1.5px solid #fed7aa' }}>
          <p style={{ ...s.label, color: '#c2410c' }}>Costos variables del mes</p>
          <p style={{ fontSize: '24px', fontWeight: '800', color: '#c2410c', margin: '4px 0 0' }}>
            {totalVariables.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </p>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>{costosVariables.length} ítems</p>
        </div>
        <div style={{ ...s.card, background: '#fef2f2', border: '1.5px solid #fecaca' }}>
          <p style={{ ...s.label, color: '#dc2626' }}>Total costos del mes</p>
          <p style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626', margin: '4px 0 0' }}>
            {totalCostos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </p>
          <div style={{ marginTop: '8px', background: '#e2e8f0', borderRadius: '99px', height: '6px' }}>
            <div style={{ background: '#0f766e', height: '6px', borderRadius: '99px', width: totalCostos > 0 ? (totalFijos/totalCostos*100)+'%' : '0%' }} />
          </div>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0' }}>
            Fijos {totalCostos > 0 ? (totalFijos/totalCostos*100).toFixed(0) : 0}% / Variables {totalCostos > 0 ? (totalVariables/totalCostos*100).toFixed(0) : 0}%
          </p>
        </div>
      </div>

      {/* PESTAÑAS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {[['fijos','Costos fijos'],['variables','Costos variables'],['analisis','Análisis por cliente']].map(([v, lbl]) => (
          <button key={v} onClick={() => setVista(v)} style={vista === v ? s.btnPrimario(c.main) : s.btnSecundario}>{lbl}</button>
        ))}
      </div>

      {/* COSTOS FIJOS */}
      {vista === 'fijos' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
            <button style={s.btnPrimario(c.main)} onClick={() => setMostrarFormFijo(!mostrarFormFijo)}>
              {mostrarFormFijo ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo costo fijo</>}
            </button>
          </div>

          {mostrarFormFijo && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 16px', color: c.main, fontWeight: '700' }}>Nuevo costo fijo</h4>
              <form onSubmit={guardarFijo}>
                <div style={s.grid2}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>Nombre</label>
                    <input style={s.input} value={formFijo.nombre} onChange={e => setFormFijo({...formFijo, nombre: e.target.value})} required
                      placeholder="Ej: Sueldo Juan Pérez, Alquiler depósito..." onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={s.label}>Categoría</label>
                    <select style={s.input} value={formFijo.categoria} onChange={e => setFormFijo({...formFijo, categoria: e.target.value})}>
                      <option value="">Seleccionar categoría</option>
                      {categoriasFijos.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Mes</label>
                    <input type="month" style={s.input} value={formFijo.mes} onChange={e => setFormFijo({...formFijo, mes: e.target.value})}
                      onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={s.label}>Monto ($)</label>
                    <input type="number" style={s.input} value={formFijo.monto} onChange={e => setFormFijo({...formFijo, monto: e.target.value})} required
                      onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={s.label}>Frecuencia</label>
                    <select style={s.input} value={formFijo.frecuencia} onChange={e => setFormFijo({...formFijo, frecuencia: e.target.value})}>
                      <option value="mensual">Mensual</option>
                      <option value="anual">Anual</option>
                      <option value="unico">Único</option>
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Observaciones</label>
                    <input style={s.input} value={formFijo.observaciones} onChange={e => setFormFijo({...formFijo, observaciones: e.target.value})}
                      onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button type="button" style={s.btnSecundario} onClick={() => setMostrarFormFijo(false)}>Cancelar</button>
                  <button type="submit" style={s.btnPrimario(c.main)}>Guardar costo fijo</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            {loading ? <div style={s.empty}>Cargando...</div>
            : costosFijos.length === 0 ? <div style={s.empty}>No hay costos fijos cargados para este mes</div>
            : (
              <table style={s.tabla}>
                <thead><tr>{['Nombre','Categoría','Frecuencia','Monto',''].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                <tbody>
                  {costosFijos.map((cf, i) => (
                    <tr key={cf.id} style={s.tablaFila(i)}>
                      <td style={s.tablaCellBold}>{cf.nombre}</td>
                      <td style={s.tablaCell}><span style={s.badge('#f0fdfa', '#0f766e')}>{cf.categoria || '—'}</span></td>
                      <td style={s.tablaCell}><span style={s.badge('#f1f5f9', '#64748b')}>{cf.frecuencia}</span></td>
                      <td style={{ ...s.tablaCellBold, color: '#dc2626' }}>{Number(cf.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                      <td style={s.tablaCell}><button style={s.btnPeligro} onClick={() => eliminarFijo(cf.id)}>Eliminar</button></td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f0fdfa' }}>
                    <td colSpan={3} style={{ ...s.tablaCellBold, color: '#0f766e', textAlign: 'right' }}>Total costos fijos:</td>
                    <td style={{ ...s.tablaCellBold, color: '#0f766e', fontSize: '16px' }}>{totalFijos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* COSTOS VARIABLES */}
      {vista === 'variables' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
            <button style={s.btnPrimario(c.main)} onClick={() => setMostrarFormVariable(!mostrarFormVariable)}>
              {mostrarFormVariable ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo costo variable</>}
            </button>
          </div>

          {mostrarFormVariable && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 16px', color: c.main, fontWeight: '700' }}>Nuevo costo variable</h4>
              <form onSubmit={guardarVariable}>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Cliente (opcional)</label>
                    <select style={s.input} value={formVariable.cliente_id} onChange={e => setFormVariable({...formVariable, cliente_id: e.target.value, contrato_id: ''})}>
                      <option value="">Sin cliente / General</option>
                      {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Contrato (opcional)</label>
                    <select style={s.input} value={formVariable.contrato_id} onChange={e => setFormVariable({...formVariable, contrato_id: e.target.value})}>
                      <option value="">Sin contrato</option>
                      {contratosFiltrados.map(ct => <option key={ct.id} value={ct.id}>{ct.numero_contrato} — {ct.clientes?.razon_social || ct.clientes?.nombre_contacto}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>Descripción del costo</label>
                    <input style={s.input} value={formVariable.nombre} onChange={e => setFormVariable({...formVariable, nombre: e.target.value})} required
                      placeholder="Ej: Insumos limpieza profunda, Horas extra operario..." onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={s.label}>Categoría</label>
                    <select style={s.input} value={formVariable.categoria} onChange={e => setFormVariable({...formVariable, categoria: e.target.value})}>
                      <option value="">Seleccionar categoría</option>
                      {categoriasVariables.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Fecha</label>
                    <input type="date" style={s.input} value={formVariable.fecha} onChange={e => setFormVariable({...formVariable, fecha: e.target.value})} required
                      onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={s.label}>Monto ($)</label>
                    <input type="number" style={s.input} value={formVariable.monto} onChange={e => setFormVariable({...formVariable, monto: e.target.value})} required
                      onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={s.label}>Observaciones</label>
                    <input style={s.input} value={formVariable.observaciones} onChange={e => setFormVariable({...formVariable, observaciones: e.target.value})}
                      onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button type="button" style={s.btnSecundario} onClick={() => setMostrarFormVariable(false)}>Cancelar</button>
                  <button type="submit" style={s.btnPrimario(c.main)}>Guardar costo variable</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            {loading ? <div style={s.empty}>Cargando...</div>
            : costosVariables.length === 0 ? <div style={s.empty}>No hay costos variables cargados para este mes</div>
            : (
              <table style={s.tabla}>
                <thead><tr>{['Fecha','Cliente','Contrato','Descripción','Categoría','Monto',''].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                <tbody>
                  {costosVariables.map((cv, i) => (
                    <tr key={cv.id} style={s.tablaFila(i)}>
                      <td style={s.tablaCell}>{new Date(cv.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                      <td style={s.tablaCellBold}>{cv.clientes?.razon_social || cv.clientes?.nombre_contacto || <span style={{ color: '#94a3b8' }}>General</span>}</td>
                      <td style={{ ...s.tablaCell, fontSize: '12px', color: '#94a3b8' }}>{cv.contratos?.numero_contrato || '—'}</td>
                      <td style={s.tablaCell}>{cv.nombre}</td>
                      <td style={s.tablaCell}><span style={s.badge('#fff7ed', '#c2410c')}>{cv.categoria || '—'}</span></td>
                      <td style={{ ...s.tablaCellBold, color: '#dc2626' }}>{Number(cv.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                      <td style={s.tablaCell}><button style={s.btnPeligro} onClick={() => eliminarVariable(cv.id)}>Eliminar</button></td>
                    </tr>
                  ))}
                  <tr style={{ background: '#fff7ed' }}>
                    <td colSpan={5} style={{ ...s.tablaCellBold, color: '#c2410c', textAlign: 'right' }}>Total costos variables:</td>
                    <td style={{ ...s.tablaCellBold, color: '#c2410c', fontSize: '16px' }}>{totalVariables.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ANÁLISIS POR CLIENTE */}
      {vista === 'analisis' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 16px', color: '#0f172a', fontWeight: '700', fontSize: '14px' }}>Costos variables por cliente</h4>
            {rankingClientes.length === 0
              ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>Sin costos variables asignados este mes</p>
              : rankingClientes.map((r, i) => (
                <div key={i} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '13px', color: '#374151', fontWeight: '600' }}>{r.cliente}</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#dc2626' }}>{r.monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: '99px', height: '8px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #dc2626, #f87171)', height: '8px', borderRadius: '99px', width: ((r.monto/maxCosto)*100)+'%', transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))
            }
          </div>

          <div style={s.card}>
            <h4 style={{ margin: '0 0 16px', color: '#0f172a', fontWeight: '700', fontSize: '14px' }}>Costos fijos por categoría</h4>
            {Object.keys(fijosPorCategoria).length === 0
              ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>Sin costos fijos cargados este mes</p>
              : Object.entries(fijosPorCategoria).sort((a,b) => b[1]-a[1]).map(([cat, monto], i) => (
                <div key={i} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '13px', color: '#374151', fontWeight: '600' }}>{cat}</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f766e' }}>{monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: '99px', height: '8px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #0f766e, #14b8a6)', height: '8px', borderRadius: '99px', width: ((monto/Math.max(...Object.values(fijosPorCategoria)))*100)+'%', transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))
            }
            {totalCostos > 0 && (
              <div style={{ marginTop: '20px', background: '#f0fdfa', borderRadius: '12px', padding: '14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#0f766e', fontWeight: '700' }}>RESUMEN DEL MES</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <div><p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Costos fijos</p><p style={{ margin: 0, fontWeight: '700', color: '#0f766e' }}>{totalFijos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p></div>
                  <div><p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Costos variables</p><p style={{ margin: 0, fontWeight: '700', color: '#c2410c' }}>{totalVariables.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p></div>
                  <div style={{ gridColumn: '1/-1', borderTop: '1px solid #99f6e4', paddingTop: '8px', marginTop: '4px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Total costos</p>
                    <p style={{ margin: 0, fontWeight: '800', color: '#dc2626', fontSize: '18px' }}>{totalCostos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Costos


