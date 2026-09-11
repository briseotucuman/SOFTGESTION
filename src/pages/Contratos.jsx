import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { FileText, Pencil, Plus, X } from 'lucide-react'

const c = colores.contratos

function Contratos() {
  const [contratos, setContratos] = useState([])
  const [clientes, setClientes] = useState([])
  const [tiposServicio, setTiposServicio] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null) // contrato que se está editando
  const [form, setForm] = useState({
    cliente_id: '', tipo_servicio_id: '', numero_contrato: '',
    descripcion: '', fecha_inicio: '', fecha_fin: '',
    frecuencia: 'mensual', tipo_facturacion: 'precio_fijo',
    precio_acordado: '', valor_hora: '', horas_estimadas_mes: '',
    direccion_servicio: '', observaciones: '', estado: 'activo'
  })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: cont }, { data: clis }, { data: tipos }] = await Promise.all([
      supabase.from('contratos').select(`*, clientes(razon_social,nombre_contacto), tipos_servicio(nombre)`).order('creado_en', { ascending: false }),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true),
      supabase.from('tipos_servicio').select('*').eq('activo', true)
    ])
    if (cont) setContratos(cont)
    if (clis) setClientes(clis)
    if (tipos) setTiposServicio(tipos)
    setLoading(false)
  }

  function generarNumero() {
    return 'CONT-' + new Date().getFullYear() + '-' + (Math.floor(Math.random() * 900) + 100)
  }

  function precioEstimado() {
    if (form.tipo_facturacion === 'por_hora') {
      return (parseFloat(form.valor_hora)||0) * (parseFloat(form.horas_estimadas_mes)||0)
    }
    return parseFloat(form.precio_acordado)||0
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ cliente_id:'', tipo_servicio_id:'', numero_contrato:'', descripcion:'', fecha_inicio:'', fecha_fin:'', frecuencia:'mensual', tipo_facturacion:'precio_fijo', precio_acordado:'', valor_hora:'', horas_estimadas_mes:'', direccion_servicio:'', observaciones:'', estado:'activo' })
    setMostrarForm(true)
  }

  function abrirEdicion(contrato) {
    setEditando(contrato)
    setForm({
      cliente_id: contrato.cliente_id || '',
      tipo_servicio_id: contrato.tipo_servicio_id || '',
      numero_contrato: contrato.numero_contrato || '',
      descripcion: contrato.descripcion || '',
      fecha_inicio: contrato.fecha_inicio || '',
      fecha_fin: contrato.fecha_fin || '',
      frecuencia: contrato.frecuencia || 'mensual',
      tipo_facturacion: contrato.tipo_facturacion || 'precio_fijo',
      precio_acordado: contrato.precio_acordado || '',
      valor_hora: contrato.valor_hora || '',
      horas_estimadas_mes: contrato.horas_estimadas_mes || '',
      direccion_servicio: contrato.direccion_servicio || '',
      observaciones: contrato.observaciones || '',
      estado: contrato.estado || 'activo'
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false)
    setEditando(null)
  }

  async function guardarContrato(e) {
    e.preventDefault()
    const datos = {
      ...form,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      precio_acordado: form.tipo_facturacion === 'por_hora' ? precioEstimado() : parseFloat(form.precio_acordado)||0,
      valor_hora: parseFloat(form.valor_hora)||0,
      horas_estimadas_mes: parseFloat(form.horas_estimadas_mes)||0,
    }

    if (editando) {
      // EDITAR
      const { error } = await supabase.from('contratos').update(datos).eq('id', editando.id)
      if (error) { alert('Error al actualizar: ' + error.message); return }
    } else {
      // NUEVO
      const { error } = await supabase.from('contratos').insert([{
        ...datos,
        numero_contrato: form.numero_contrato || generarNumero(),
      }])
      if (error) { alert('Error al crear: ' + error.message); return }
    }

    cancelar()
    cargarDatos()
  }

  const estadoColor = {
    activo:     { bg: '#d1fae5', color: '#059669' },
    pausado:    { bg: '#fef3c7', color: '#d97706' },
    finalizado: { bg: '#f1f5f9', color: '#64748b' },
    cancelado:  { bg: '#fee2e2', color: '#dc2626' },
  }

  const facturacionColor = {
    precio_fijo: { bg: '#dbeafe', color: '#1d4ed8', label: 'Precio fijo' },
    por_hora:    { bg: '#fef3c7', color: '#d97706',  label: 'Por hora' },
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><FileText size={19} /> Contratos</h3>
          <p style={s.cabeceraSubtexto}>{contratos.length} contratos · {contratos.filter(ct=>ct.tipo_facturacion==='por_hora').length} por hora</p>
        </div>
        <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={mostrarForm ? cancelar : abrirNuevo}>
          {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo contrato</>}
        </button>
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>
            {editando ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando — {editando.numero_contrato}</> : 'Nuevo contrato'}
          </h4>
          <form onSubmit={guardarContrato}>
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
                <select style={s.input} value={form.tipo_servicio_id} onChange={e => setForm({...form, tipo_servicio_id: e.target.value})} required>
                  <option value="">Seleccionar servicio</option>
                  {tiposServicio.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Número de contrato</label>
                <input style={s.input} value={form.numero_contrato} onChange={e => setForm({...form, numero_contrato: e.target.value})}
                  placeholder="Se genera automáticamente"
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Frecuencia</label>
                <select style={s.input} value={form.frecuencia} onChange={e => setForm({...form, frecuencia: e.target.value})}>
                  <option value="unico">Único</option>
                  <option value="diario">Diario</option>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Fecha inicio</label>
                <input type="date" style={s.input} value={form.fecha_inicio} onChange={e => setForm({...form, fecha_inicio: e.target.value})} required
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Fecha fin (opcional)</label>
                <input type="date" style={s.input} value={form.fecha_fin} onChange={e => setForm({...form, fecha_fin: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Estado</label>
                <select style={s.input} value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  <option value="activo">Activo</option>
                  <option value="pausado">Pausado</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Dirección del servicio</label>
                <input style={s.input} value={form.direccion_servicio} onChange={e => setForm({...form, direccion_servicio: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>

              {/* TIPO DE FACTURACION */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Tipo de facturación</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[['precio_fijo','Precio fijo mensual'],['por_hora','⏱ Por hora trabajada']].map(([val, lbl]) => (
                    <button key={val} type="button"
                      onClick={() => setForm({...form, tipo_facturacion: val})}
                      style={{ flex:1, padding:'14px', borderRadius:'12px', border:'2px solid', borderColor: form.tipo_facturacion===val ? c.main : '#e2e8f0', background: form.tipo_facturacion===val ? c.light : '#f8fafc', color: form.tipo_facturacion===val ? c.main : '#64748b', fontWeight:'700', fontSize:'14px', cursor:'pointer', transition:'all 0.2s' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {form.tipo_facturacion === 'precio_fijo' && (
                <div>
                  <label style={s.label}>Precio mensual acordado ($)</label>
                  <input type="number" style={s.input} value={form.precio_acordado} onChange={e => setForm({...form, precio_acordado: e.target.value})} required
                    onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              )}

              {form.tipo_facturacion === 'por_hora' && (
                <>
                  <div>
                    <label style={s.label}>Valor hora acordado ($)</label>
                    <input type="number" style={s.input} value={form.valor_hora} onChange={e => setForm({...form, valor_hora: e.target.value})} required
                      onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={s.label}>Horas estimadas por mes</label>
                    <input type="number" style={s.input} value={form.horas_estimadas_mes} onChange={e => setForm({...form, horas_estimadas_mes: e.target.value})}
                      placeholder="Referencia estimada" step="0.5"
                      onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  {form.valor_hora && form.horas_estimadas_mes && (
                    <div style={{ gridColumn: '1 / -1', background: c.light, borderRadius: '12px', padding: '14px 18px', border: `1px solid ${c.main}40` }}>
                      <p style={{ margin: '0 0 4px', fontSize: '12px', color: c.main, fontWeight: '700', textTransform: 'uppercase' }}>Facturación estimada mensual</p>
                      <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: c.main }}>
                        {precioEstimado().toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                        {form.horas_estimadas_mes} hs × {Number(form.valor_hora).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}/h (varía según horas reales)
                      </p>
                    </div>
                  )}
                </>
              )}

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Descripción / Observaciones</label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={form.descripcion}
                  onChange={e => setForm({...form, descripcion: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={cancelar}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>
                {editando ? 'Guardar cambios' : '+ Crear contrato'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : contratos.length === 0 ? <div style={s.empty}>No hay contratos registrados</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Número','Cliente','Servicio','Facturación','Valor hora','Precio ref.','Inicio','Estado',''].map(h => (
                <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {contratos.map((ct, i) => {
                const ec = estadoColor[ct.estado] || { bg: '#f1f5f9', color: '#64748b' }
                const fc = facturacionColor[ct.tipo_facturacion] || facturacionColor.precio_fijo
                return (
                  <tr key={ct.id} style={s.tablaFila(i)}>
                    <td style={{ ...s.tablaCell, fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>{ct.numero_contrato}</td>
                    <td style={s.tablaCellBold}>{ct.clientes?.razon_social || ct.clientes?.nombre_contacto}</td>
                    <td style={s.tablaCell}>{ct.tipos_servicio?.nombre}</td>
                    <td style={s.tablaCell}><span style={s.badge(fc.bg, fc.color)}>{fc.label}</span></td>
                    <td style={s.tablaCell}>
                      {ct.tipo_facturacion === 'por_hora'
                        ? <span style={{ fontWeight:'700', color:'#d97706' }}>{Number(ct.valor_hora).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}/h</span>
                        : '—'}
                    </td>
                    <td style={{ ...s.tablaCellBold, color: c.main }}>
                      {Number(ct.precio_acordado).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </td>
                    <td style={s.tablaCell}>{ct.fecha_inicio ? new Date(ct.fecha_inicio).toLocaleDateString('es-AR') : '—'}</td>
                    <td style={s.tablaCell}><span style={s.badge(ec.bg, ec.color)}>{ct.estado}</span></td>
                    <td style={s.tablaCell}>
                      <button style={{ ...s.btnPrimario(c.main), padding: '6px 14px', fontSize: '12px' }}
                        onClick={() => abrirEdicion(ct)}>
                        <Pencil size={13} style={{ marginRight: 4, verticalAlign: "-2px" }} />Editar
                      </button>
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

export default Contratos
