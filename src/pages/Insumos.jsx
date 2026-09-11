import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { Package, Pencil, Plus, Trash2, X } from 'lucide-react'

const c = colores.insumos

function Insumos() {
  const [insumos, setInsumos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('insumos')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarMovimiento, setMostrarMovimiento] = useState(null)
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({ nombre:'', descripcion:'', unidad_medida:'unidad', categoria:'', stock_actual:'0', stock_minimo:'0', precio_costo:'', proveedor_id:'' })
  const [formMov, setFormMov] = useState({ tipo_movimiento:'entrada', cantidad:'', motivo:'compra', precio_unitario:'', observaciones:'' })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: ins }, { data: prov }, { data: mov }] = await Promise.all([
      supabase.from('insumos').select('*, proveedores(razon_social)').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('*').eq('activo', true),
      supabase.from('movimientos_stock').select('*, insumos(nombre)').order('creado_en', { ascending: false }).limit(50)
    ])
    if (ins) setInsumos(ins)
    if (prov) setProveedores(prov)
    if (mov) setMovimientos(mov)
    setLoading(false)
  }

  function abrirEdicion(ins) {
    setEditando(ins)
    setForm({
      nombre: ins.nombre || '',
      descripcion: ins.descripcion || '',
      unidad_medida: ins.unidad_medida || 'unidad',
      categoria: ins.categoria || '',
      stock_actual: ins.stock_actual || '0',
      stock_minimo: ins.stock_minimo || '0',
      precio_costo: ins.precio_costo || '',
      proveedor_id: ins.proveedor_id || ''
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false)
    setEditando(null)
    setForm({ nombre:'', descripcion:'', unidad_medida:'unidad', categoria:'', stock_actual:'0', stock_minimo:'0', precio_costo:'', proveedor_id:'' })
  }


  function abrirEdicion(ins) {
    setEditando(ins)
    setForm({
      nombre: ins.nombre || '',
      descripcion: ins.descripcion || '',
      unidad_medida: ins.unidad_medida || 'unidad',
      categoria: ins.categoria || '',
      stock_actual: ins.stock_actual || '0',
      stock_minimo: ins.stock_minimo || '0',
      precio_costo: ins.precio_costo || '',
      proveedor_id: ins.proveedor_id || ''
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarIns() {
    setMostrarForm(false)
    setEditando(null)
    setForm({ nombre:'', descripcion:'', unidad_medida:'unidad', categoria:'', stock_actual:'0', stock_minimo:'0', precio_costo:'', proveedor_id:'' })
  }

    async function guardarInsumo(e) {
    e.preventDefault()
    const datos = {
      ...form,
      stock_actual: parseFloat(form.stock_actual) || 0,
      stock_minimo: parseFloat(form.stock_minimo) || 0,
      precio_costo: form.precio_costo ? parseFloat(form.precio_costo) : null,
      proveedor_id: form.proveedor_id || null
    }
    if (editando) {
      const { error } = await supabase.from('insumos').update(datos).eq('id', editando.id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('insumos').insert([datos])
      if (error) { alert('Error: ' + error.message); return }
    }
    cancelar()
    cargarDatos()
  }

  async function eliminarInsumo(id) {
    if (!confirm('¿Eliminar este insumo? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('insumos').update({ activo: false }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    cargarDatos()
  }

  async function registrarMovimiento(e) {
    e.preventDefault()
    const ins = mostrarMovimiento
    const cantidad = parseFloat(formMov.cantidad)
    const stockAnterior = Number(ins.stock_actual)
    const stockNuevo = formMov.tipo_movimiento === 'entrada' ? stockAnterior + cantidad : stockAnterior - cantidad
    if (stockNuevo < 0) { alert('Stock insuficiente'); return }
    await supabase.from('movimientos_stock').insert([{ insumo_id: ins.id, tipo_movimiento: formMov.tipo_movimiento, cantidad, stock_anterior: stockAnterior, stock_nuevo: stockNuevo, motivo: formMov.motivo, precio_unitario: formMov.precio_unitario ? parseFloat(formMov.precio_unitario) : null }])
    await supabase.from('insumos').update({ stock_actual: stockNuevo }).eq('id', ins.id)
    setMostrarMovimiento(null)
    setFormMov({ tipo_movimiento:'entrada', cantidad:'', motivo:'compra', precio_unitario:'', observaciones:'' })
    cargarDatos()
  }

  const filtrados = insumos.filter(i => i.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (i.categoria||'').toLowerCase().includes(busqueda.toLowerCase()))
  const bajoMinimo = insumos.filter(i => Number(i.stock_actual) <= Number(i.stock_minimo))
  const movColor = { entrada: { bg: '#d1fae5', color: '#059669' }, salida: { bg: '#fee2e2', color: '#dc2626' }, ajuste: { bg: '#fef3c7', color: '#d97706' } }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><Package size={19} /> Insumos y Stock</h3>
          <p style={s.cabeceraSubtexto}>{insumos.length} insumos registrados</p>
        </div>
        <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => { if (mostrarForm) { cancelar() } else { setMostrarForm(true) } }}>
          {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Nuevo insumo</>}
        </button>
      </div>

      {bajoMinimo.length > 0 && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px' }}>
          <p style={{ margin: 0, color: '#dc2626', fontWeight: '600', fontSize: '13px' }}>{bajoMinimo.length} insumo(s) bajo stock mínimo: {bajoMinimo.map(i => i.nombre).join(', ')}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {['insumos','movimientos'].map(v => (
          <button key={v} onClick={() => setVista(v)} style={vista === v ? s.btnPrimario(c.main) : s.btnSecundario}>{v === 'insumos' ? 'Insumos' : 'Movimientos'}</button>
        ))}
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>
            {editando ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando — {editando.nombre}</> : 'Nuevo insumo'}
          </h4>
          <form onSubmit={guardarInsumo}>
            <div style={s.grid2}>
              <div><label style={s.label}>Nombre</label><input style={s.input} value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} /></div>
              <div><label style={s.label}>Categoría</label><input style={s.input} value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} /></div>
              <div><label style={s.label}>Unidad de medida</label><select style={s.input} value={form.unidad_medida} onChange={e => setForm({...form, unidad_medida: e.target.value})}><option value="unidad">Unidad</option><option value="litro">Litro</option><option value="kg">Kilogramo</option><option value="rollo">Rollo</option><option value="caja">Caja</option></select></div>
              <div><label style={s.label}>Proveedor</label><select style={s.input} value={form.proveedor_id} onChange={e => setForm({...form, proveedor_id: e.target.value})}><option value="">Sin proveedor</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}</select></div>
              <div><label style={s.label}>Stock actual</label><input type="number" style={s.input} value={form.stock_actual} onChange={e => setForm({...form, stock_actual: e.target.value})} onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} /></div>
              <div><label style={s.label}>Stock mínimo</label><input type="number" style={s.input} value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: e.target.value})} onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} /></div>
              <div><label style={s.label}>Precio de costo ($)</label><input type="number" style={s.input} value={form.precio_costo} onChange={e => setForm({...form, precio_costo: e.target.value})} onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={cancelar}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>{editando ? 'Guardar cambios' : 'Guardar insumo'}</button>
            </div>
          </form>
        </div>
      )}

      {mostrarMovimiento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>Movimiento — {mostrarMovimiento.nombre}</h4>
              <button onClick={() => setMostrarMovimiento(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>Stock actual: <strong style={{ color: '#0f172a' }}>{mostrarMovimiento.stock_actual} {mostrarMovimiento.unidad_medida}</strong></p>
            <form onSubmit={registrarMovimiento}>
              <div style={s.grid2}>
                <div><label style={s.label}>Tipo</label><select style={s.input} value={formMov.tipo_movimiento} onChange={e => setFormMov({...formMov, tipo_movimiento: e.target.value})}><option value="entrada">Entrada</option><option value="salida">Salida</option><option value="ajuste">Ajuste</option></select></div>
                <div><label style={s.label}>Cantidad</label><input type="number" style={s.input} value={formMov.cantidad} onChange={e => setFormMov({...formMov, cantidad: e.target.value})} required onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} /></div>
                <div><label style={s.label}>Motivo</label><input style={s.input} value={formMov.motivo} onChange={e => setFormMov({...formMov, motivo: e.target.value})} onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} /></div>
                <div><label style={s.label}>Precio unitario ($)</label><input type="number" style={s.input} value={formMov.precio_unitario} onChange={e => setFormMov({...formMov, precio_unitario: e.target.value})} onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setMostrarMovimiento(null)}>Cancelar</button>
                <button type="submit" style={s.btnPrimario(c.main)}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {vista === 'insumos' && (
        <>
          <div style={{ marginBottom: '16px' }}><input style={s.buscador} placeholder=" Buscar insumo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            {loading ? <div style={s.empty}>Cargando...</div>
            : filtrados.length === 0 ? <div style={s.empty}>No hay insumos registrados</div>
            : (
              <table style={s.tabla}>
                <thead><tr>{['Insumo','Categoría','Stock actual','Stock mínimo','Precio costo','Proveedor',''].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtrados.map((ins, i) => (
                    <tr key={ins.id} style={s.tablaFila(i)}>
                      <td style={s.tablaCellBold}>{ins.nombre}</td>
                      <td style={s.tablaCell}>{ins.categoria || '—'}</td>
                      <td style={s.tablaCell}><span style={s.badge(Number(ins.stock_actual) <= Number(ins.stock_minimo) ? '#fee2e2' : '#d1fae5', Number(ins.stock_actual) <= Number(ins.stock_minimo) ? '#dc2626' : '#059669')}>{ins.stock_actual} {ins.unidad_medida}</span></td>
                      <td style={s.tablaCell}>{ins.stock_minimo} {ins.unidad_medida}</td>
                      <td style={s.tablaCell}>{ins.precio_costo ? Number(ins.precio_costo).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : '—'}</td>
                      <td style={s.tablaCell}>{ins.proveedores?.razon_social || '—'}</td>
                      <td style={s.tablaCell}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button style={{ ...s.btnPrimario(c.main), padding: '5px 10px', fontSize: '12px' }} onClick={() => setMostrarMovimiento(ins)}>+ Mov.</button>
                          <button style={{ ...s.btnPrimario('#0077cc'), padding: '5px 10px', fontSize: '12px' }} onClick={() => abrirEdicion(ins)}><Pencil size={14} /></button>
                          <button style={s.btnPeligro} onClick={() => eliminarInsumo(ins.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {vista === 'movimientos' && (
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          {movimientos.length === 0 ? <div style={s.empty}>No hay movimientos registrados</div>
          : (
            <table style={s.tabla}>
              <thead><tr>{['Fecha','Insumo','Tipo','Cantidad','Ant.','Nuevo','Motivo'].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
              <tbody>
                {movimientos.map((m, i) => {
                  const mc = movColor[m.tipo_movimiento] || { bg: '#f1f5f9', color: '#64748b' }
                  return (
                    <tr key={m.id} style={s.tablaFila(i)}>
                      <td style={s.tablaCell}>{new Date(m.creado_en).toLocaleDateString('es-AR')}</td>
                      <td style={s.tablaCellBold}>{m.insumos?.nombre}</td>
                      <td style={s.tablaCell}><span style={s.badge(mc.bg, mc.color)}>{m.tipo_movimiento}</span></td>
                      <td style={s.tablaCellBold}>{m.cantidad}</td>
                      <td style={s.tablaCell}>{m.stock_anterior}</td>
                      <td style={s.tablaCellBold}>{m.stock_nuevo}</td>
                      <td style={s.tablaCell}>{m.motivo || '—'}</td>
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

export default Insumos
