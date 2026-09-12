import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { BarChart3, Pencil, Plus, Trash2, X } from 'lucide-react'

const c = colores.finanzas

const CATEGORIAS = {
  ingreso: ['Cobranzas', 'Otro ingreso'],
  egreso: ['Insumos', 'Servicios', 'Haberes', 'Impuestos', 'Alquileres', 'Socios', 'Marketing', 'Otro egreso']
}

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta', 'Otro']

function Finanzas() {
  const [movimientos, setMovimientos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarCuenta, setMostrarCuenta] = useState(false)
  const [editando, setEditando] = useState(null)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'ingreso', categoria: '', descripcion: '',
    monto: '', cuenta_id: '', comprobante: '',
    forma_pago: 'Efectivo', factura_id: ''
  })
  const [formCuenta, setFormCuenta] = useState({ banco: '', tipo: 'caja_ahorro', numero: '', cbu: '', saldo: '0' })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: movData }, { data: cuentasData }, { data: facturasData }] = await Promise.all([
      supabase.from('movimientos_financieros').select('*').order('fecha', { ascending: false }),
      supabase.from('cuentas_bancarias').select('*').eq('activa', true),
      supabase.from('facturas').select('id, numero_factura, clientes(razon_social), total, estado').eq('estado', 'emitida').order('fecha_emision', { ascending: false })
    ])
    if (movData) setMovimientos(movData)
    if (cuentasData) setCuentas(cuentasData)
    if (facturasData) setFacturas(facturasData)
    setLoading(false)
  }

  // Ajusta el saldo de una cuenta bancaria en +/- delta (positivo = entra plata, negativo = sale)
  async function ajustarSaldo(cuenta_id, delta) {
    if (!cuenta_id || !delta) return
    const { data } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuenta_id).single()
    if (data) await supabase.from('cuentas_bancarias').update({ saldo: Number(data.saldo) + delta }).eq('id', cuenta_id)
  }

  function efectoEnSaldo(tipo, monto) {
    return tipo === 'ingreso' ? Number(monto) : -Number(monto)
  }

  function abrirEdicion(m) {
    setEditando(m)
    setForm({
      fecha: m.fecha || new Date().toISOString().split('T')[0],
      tipo: m.tipo || 'ingreso',
      categoria: m.categoria || '',
      descripcion: m.descripcion || '',
      monto: m.monto || '',
      cuenta_id: m.cuenta_id || '',
      comprobante: m.comprobante || '',
      forma_pago: m.forma_pago || 'Efectivo',
      factura_id: m.factura_id || ''
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false)
    setEditando(null)
    setForm({ fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', categoria: '', descripcion: '', monto: '', cuenta_id: '', comprobante: '', forma_pago: 'Efectivo', factura_id: '' })
  }

  async function guardarMovimiento(e) {
    e.preventDefault()
    const datos = {
      ...form,
      monto: parseFloat(form.monto),
      cuenta_id: form.cuenta_id || null,
      factura_id: form.factura_id || null
    }
    if (editando) {
      // Revierte el efecto viejo sobre la cuenta anterior, luego aplica el nuevo
      if (editando.cuenta_id) await ajustarSaldo(editando.cuenta_id, -efectoEnSaldo(editando.tipo, editando.monto))
      const { error } = await supabase.from('movimientos_financieros').update(datos).eq('id', editando.id)
      if (error) { alert('Error: ' + error.message); return }
      if (datos.cuenta_id) await ajustarSaldo(datos.cuenta_id, efectoEnSaldo(datos.tipo, datos.monto))
    } else {
      const { error } = await supabase.from('movimientos_financieros').insert([datos])
      if (error) { alert('Error: ' + error.message); return }
      if (datos.cuenta_id) await ajustarSaldo(datos.cuenta_id, efectoEnSaldo(datos.tipo, datos.monto))
      // Si es cobranza asociada a factura, marcar factura como cobrada
      if (form.categoria === 'Cobranzas' && form.factura_id) {
        await supabase.from('facturas').update({ estado: 'cobrada' }).eq('id', form.factura_id)
      }
    }
    cancelar()
    cargarDatos()
  }

  async function eliminarMovimiento(m) {
    if (!confirm('¿Eliminar este movimiento?')) return
    if (m.cuenta_id) await ajustarSaldo(m.cuenta_id, -efectoEnSaldo(m.tipo, m.monto))
    await supabase.from('movimientos_financieros').delete().eq('id', m.id)
    cargarDatos()
  }

  async function guardarCuenta(e) {
    e.preventDefault()
    const { error } = await supabase.from('cuentas_bancarias').insert([{ ...formCuenta, saldo: parseFloat(formCuenta.saldo) || 0 }])
    if (error) { alert('Error: ' + error.message); return }
    setMostrarCuenta(false)
    setFormCuenta({ banco: '', tipo: 'caja_ahorro', numero: '', cbu: '', saldo: '0' })
    cargarDatos()
  }

  const movMes = movimientos.filter(m => m.fecha && m.fecha.startsWith(filtroMes))
  const totalIngresos = movMes.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0)
  const totalEgresos = movMes.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0)
  const balance = totalIngresos - totalEgresos
  const saldoTotal = cuentas.reduce((a, ct) => a + Number(ct.saldo), 0)

  return (
    <div>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><BarChart3 size={19} /> Finanzas</h3>
          <p style={s.cabeceraSubtexto}>{movimientos.length} movimientos registrados</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ ...s.btnPrimario('rgba(255,255,255,0.2)'), border: '1px solid rgba(255,255,255,0.4)' }} onClick={() => setMostrarCuenta(true)}>+ Cuenta</button>
          <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => { if (mostrarForm) { cancelar() } else { setMostrarForm(true) } }}>
            {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Movimiento</>}
          </button>
        </div>
      </div>

      {/* RESUMEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '20px' }}>
        <div style={{ ...s.card, background: '#f0fdf4' }}>
          <p style={{ ...s.label, color: '#059669' }}>Ingresos del mes</p>
          <p style={{ fontSize: '20px', fontWeight: '800', color: '#059669', margin: 0 }}>{totalIngresos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
        </div>
        <div style={{ ...s.card, background: '#fff1f2' }}>
          <p style={{ ...s.label, color: '#dc2626' }}>Egresos del mes</p>
          <p style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', margin: 0 }}>{totalEgresos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
        </div>
        <div style={{ ...s.card, background: balance >= 0 ? '#eff6ff' : '#fff7ed' }}>
          <p style={{ ...s.label, color: balance >= 0 ? '#1d4ed8' : '#d97706' }}>Balance del mes</p>
          <p style={{ fontSize: '20px', fontWeight: '800', color: balance >= 0 ? '#1d4ed8' : '#d97706', margin: 0 }}>{balance.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
        </div>
        <div style={s.card}>
          <p style={{ ...s.label, color: '#64748b' }}>Saldo en cuentas</p>
          <p style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{saldoTotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
        </div>
      </div>

      {/* FORM MOVIMIENTO */}
      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>
            {editando ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando movimiento</> : 'Nuevo movimiento'}
          </h4>
          <form onSubmit={guardarMovimiento}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Fecha</label>
                <input type="date" style={s.input} value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} required />
              </div>
              <div>
                <label style={s.label}>Tipo</label>
                <select style={s.input} value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value, categoria: '', factura_id: ''})}>
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Categoría</label>
                <select style={s.input} value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} required>
                  <option value="">Seleccionar</option>
                  {CATEGORIAS[form.tipo].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Forma de pago</label>
                <select style={s.input} value={form.forma_pago} onChange={e => setForm({...form, forma_pago: e.target.value})}>
                  {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Monto ($)</label>
                <input type="number" style={s.input} value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} required />
              </div>
              <div>
                <label style={s.label}>Cuenta bancaria</label>
                <select style={s.input} value={form.cuenta_id} onChange={e => setForm({...form, cuenta_id: e.target.value})} required>
                  <option value="">Seleccionar cuenta</option>
                  {cuentas.map(ct => <option key={ct.id} value={ct.id}>{ct.banco} — {ct.tipo}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Comprobante</label>
                <input style={s.input} value={form.comprobante} onChange={e => setForm({...form, comprobante: e.target.value})} placeholder="Nro. factura, recibo..." />
              </div>
              {form.tipo === 'ingreso' && form.categoria === 'Cobranzas' && (
                <div>
                  <label style={s.label}>Asociar a factura</label>
                  <select style={s.input} value={form.factura_id} onChange={e => setForm({...form, factura_id: e.target.value})}>
                    <option value="">Sin factura</option>
                    {facturas.map(f => <option key={f.id} value={f.id}>#{f.numero_factura} — {f.clientes?.razon_social} — {Number(f.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</option>)}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Descripción</label>
                <input style={s.input} value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={cancelar}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>{editando ? 'Guardar cambios' : 'Guardar movimiento'}</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CUENTA */}
      {mostrarCuenta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>Nueva cuenta bancaria</h4>
              <button onClick={() => setMostrarCuenta(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <form onSubmit={guardarCuenta}>
              <div style={s.grid2}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Banco / Descripción</label>
                  <input style={s.input} value={formCuenta.banco} onChange={e => setFormCuenta({...formCuenta, banco: e.target.value})} required />
                </div>
                <div>
                  <label style={s.label}>Tipo</label>
                  <select style={s.input} value={formCuenta.tipo} onChange={e => setFormCuenta({...formCuenta, tipo: e.target.value})}>
                    <option value="caja_ahorro">Caja de ahorro</option>
                    <option value="cuenta_corriente">Cuenta corriente</option>
                    <option value="caja_chica">Caja chica</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Saldo inicial ($)</label>
                  <input type="number" style={s.input} value={formCuenta.saldo} onChange={e => setFormCuenta({...formCuenta, saldo: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setMostrarCuenta(false)}>Cancelar</button>
                <button type="submit" style={s.btnPrimario(c.main)}>Guardar cuenta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUENTAS */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(cuentas.length,1)}, 1fr)`, gap: '14px', marginBottom: '20px' }}>
        {cuentas.map(ct => (
          <div key={ct.id} style={s.card}>
            <p style={{ ...s.label, color: '#64748b' }}>{ct.banco} · {ct.tipo.replace('_',' ')}</p>
            <p style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{Number(ct.saldo).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
          </div>
        ))}
      </div>

      {/* FILTRO MES */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <input type="month" style={{ ...s.buscador, maxWidth: '200px' }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
        <span style={{ color: '#64748b', fontSize: '13px' }}>{movMes.length} movimientos este mes</span>
      </div>

      {/* TABLA */}
      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : movMes.length === 0 ? <div style={s.empty}>No hay movimientos este mes</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Fecha','Tipo','Categoría','Descripción','Cuenta','Forma de pago','Comprobante','Monto',''].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {movMes.map((m, i) => (
                <tr key={m.id} style={s.tablaFila(i)}>
                  <td style={s.tablaCell}>{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                  <td style={s.tablaCell}><span style={s.badge(m.tipo === 'ingreso' ? '#d1fae5' : '#fee2e2', m.tipo === 'ingreso' ? '#059669' : '#dc2626')}>{m.tipo}</span></td>
                  <td style={s.tablaCell}>{m.categoria || '—'}</td>
                  <td style={s.tablaCell}>{m.descripcion || '—'}</td>
                  <td style={{ ...s.tablaCell, fontSize: '12px' }}>{cuentas.find(ct => ct.id === m.cuenta_id)?.banco || '—'}</td>
                  <td style={s.tablaCell}>{m.forma_pago || '—'}</td>
                  <td style={{ ...s.tablaCell, fontSize: '12px', color: '#94a3b8' }}>{m.comprobante || '—'}</td>
                  <td style={{ ...s.tablaCellBold, textAlign: 'right', color: m.tipo === 'ingreso' ? '#059669' : '#dc2626' }}>
                    {m.tipo === 'ingreso' ? '+' : '-'}{Number(m.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </td>
                  <td style={s.tablaCell}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={{ ...s.btnPrimario(c.main), padding: '5px 10px', fontSize: '12px' }} onClick={() => abrirEdicion(m)}><Pencil size={14} /></button>
                      <button style={s.btnPeligro} onClick={() => eliminarMovimiento(m)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Finanzas
