import { useEffect, useMemo, useState } from 'react'
import { supabase, emitirCambioDatos } from '../supabase.js'
import { s } from '../estilos.js'
import { Plus, X, Search, Landmark, HandCoins, AlertTriangle, CalendarClock } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const hoyISO = () => new Date().toISOString().split('T')[0]
const fmtFecha = f => (f ? String(f).split('T')[0].split('-').reverse().join('/') : '—')
const diasHasta = f => Math.round((new Date(String(f).split('T')[0] + 'T12:00:00') - new Date(hoyISO() + 'T12:00:00')) / 86400000)

const ESTADOS = {
  cartera: { label: 'En cartera', bg: '#EFF6FF', fg: '#1D4ED8' },
  depositado: { label: 'Depositado', bg: '#FEF3C7', fg: '#B45309' },
  cobrado: { label: 'Cobrado', bg: '#DCFCE7', fg: '#15803D' },
  endosado: { label: 'Endosado', bg: '#F3E8FF', fg: '#7E22CE' },
  emitido: { label: 'Emitido', bg: '#EFF6FF', fg: '#1D4ED8' },
  debitado: { label: 'Debitado', bg: '#DCFCE7', fg: '#15803D' },
  rechazado: { label: 'Rechazado', bg: '#FEE2E2', fg: '#B91C1C' },
  anulado: { label: 'Anulado', bg: '#F1F5F9', fg: '#64748B' }
}
const ABIERTOS = ['cartera', 'depositado', 'emitido']

const FORM_VACIO = { tipo: 'tercero', numero: '', banco: '', librador: '', cuit_librador: '', importe: '', fecha_emision: hoyISO(), fecha_pago: hoyISO(), cliente_id: '', proveedor_id: '', cuenta_id: '', factura_id: '', factura_compra_id: '', observaciones: '' }

export default function Cheques() {
  const [cheques, setCheques] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [clientes, setClientes] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [facturasVenta, setFacturasVenta] = useState([])
  const [facturasCompra, setFacturasCompra] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('abiertos')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(null)
  const [accion, setAccion] = useState(null) // { cheque, tipo, cuenta_id, proveedor_id, factura_compra_id, fecha }
  const [trabajando, setTrabajando] = useState(false)

  async function cargar() {
    setCargando(true)
    const [ch, ct, cl, pr, fv, fc] = await Promise.all([
      supabase.from('cheques').select('*, clientes(razon_social, nombre_contacto), proveedores(razon_social), cuentas_bancarias(banco, tipo)').order('fecha_pago', { ascending: true }),
      supabase.from('cuentas_bancarias').select('id, banco, tipo').eq('activa', true),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').order('razon_social'),
      supabase.from('proveedores').select('id, razon_social').order('razon_social'),
      supabase.from('facturas').select('id, numero_factura, total, cliente_id, estado').in('estado', ['emitida', 'pendiente', 'parcial', 'vencida']),
      supabase.from('facturas_compra').select('id, numero_factura, total, proveedor_id, estado').not('estado', 'in', '(pagada,anulada)')
    ])
    setCheques(ch.data || []); setCuentas(ct.data || []); setClientes(cl.data || []); setProveedores(pr.data || [])
    setFacturasVenta(fv.data || []); setFacturasCompra(fc.data || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const nombreCliente = c => c?.razon_social || c?.nombre_contacto || ''

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return cheques.filter(c => {
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false
      if (filtroEstado === 'abiertos' && !ABIERTOS.includes(c.estado)) return false
      if (!['abiertos', 'todos'].includes(filtroEstado) && c.estado !== filtroEstado) return false
      if (!q) return true
      return [c.numero, c.banco, c.librador, nombreCliente(c.clientes), c.proveedores?.razon_social].some(v => (v || '').toLowerCase().includes(q))
    })
  }, [cheques, filtroTipo, filtroEstado, busqueda])

  const resumen = useMemo(() => {
    const suma = fn => cheques.filter(fn).reduce((a, c) => a + Number(c.importe), 0)
    const abierto = c => ABIERTOS.includes(c.estado)
    return {
      cartera: suma(c => c.tipo === 'tercero' && c.estado === 'cartera'),
      depositados: suma(c => c.tipo === 'tercero' && c.estado === 'depositado'),
      propios: suma(c => c.tipo === 'propio' && c.estado === 'emitido'),
      vencenSemana: cheques.filter(c => abierto(c) && diasHasta(c.fecha_pago) >= 0 && diasHasta(c.fecha_pago) <= 7).length,
      vencidos: cheques.filter(c => abierto(c) && diasHasta(c.fecha_pago) < 0).length
    }
  }, [cheques])

  async function guardarNuevo(e) {
    e.preventDefault()
    if (form.tipo === 'propio' && !form.cuenta_id) { alert('Elegí la cuenta bancaria que emite el cheque'); return }
    setTrabajando(true)
    const { error } = await supabase.from('cheques').insert([{
      tipo: form.tipo, numero: form.numero.trim(), banco: form.banco || null, librador: form.librador || null, cuit_librador: form.cuit_librador || null,
      importe: parseFloat(form.importe), fecha_emision: form.fecha_emision, fecha_pago: form.fecha_pago,
      estado: form.tipo === 'tercero' ? 'cartera' : 'emitido',
      cuenta_id: form.tipo === 'propio' ? form.cuenta_id : null,
      cliente_id: form.tipo === 'tercero' ? (form.cliente_id || null) : null,
      factura_id: form.tipo === 'tercero' ? (form.factura_id || null) : null,
      proveedor_id: form.tipo === 'propio' ? (form.proveedor_id || null) : null,
      factura_compra_id: form.tipo === 'propio' ? (form.factura_compra_id || null) : null,
      observaciones: form.observaciones || null
    }])
    setTrabajando(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setForm(null)
    await cargar()
  }

  // ---------- helpers contables ----------
  async function ajustarSaldo(cuenta_id, delta) {
    if (!cuenta_id) return
    const { data } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuenta_id).single()
    if (data) await supabase.from('cuentas_bancarias').update({ saldo: Number(data.saldo) + delta }).eq('id', cuenta_id)
  }
  async function actualizarEstadoVenta(factura_id) {
    const [{ data: f }, { data: ps }] = await Promise.all([
      supabase.from('facturas').select('total').eq('id', factura_id).single(),
      supabase.from('pagos').select('monto').eq('factura_id', factura_id)
    ])
    const pagado = (ps || []).reduce((a, p) => a + Number(p.monto), 0)
    if (f) await supabase.from('facturas').update({ estado: pagado >= Number(f.total) - 0.01 ? 'pagada' : 'parcial' }).eq('id', factura_id)
  }
  async function actualizarEstadoCompra(factura_compra_id) {
    const [{ data: f }, { data: ps }] = await Promise.all([
      supabase.from('facturas_compra').select('total').eq('id', factura_compra_id).single(),
      supabase.from('pagos_compra').select('monto').eq('factura_compra_id', factura_compra_id)
    ])
    const pagado = (ps || []).reduce((a, p) => a + Number(p.monto), 0)
    if (f) await supabase.from('facturas_compra').update({ estado: pagado >= Number(f.total) - 0.01 ? 'pagada' : 'parcial' }).eq('id', factura_compra_id)
  }
  async function cobroVenta(ch, fecha, cuenta_id) {
    const ref = `Cheque ${ch.numero}${ch.banco ? ' · ' + ch.banco : ''}`
    if (ch.factura_id) {
      await supabase.from('pagos').insert([{ factura_id: ch.factura_id, fecha_pago: fecha, monto: ch.importe, monto_retenciones: 0, medio_pago: 'cheque', cuenta_id: cuenta_id || null, referencia: ref }])
      await actualizarEstadoVenta(ch.factura_id)
    }
    await supabase.from('movimientos_financieros').insert([{
      fecha, tipo: 'ingreso', categoria: ch.factura_id ? 'Cobranzas' : 'Otro ingreso',
      descripcion: `Cobro con cheque ${ch.numero} — ${nombreCliente(ch.clientes) || ch.librador || ''}`,
      monto: ch.importe, cuenta_id: cuenta_id || null, comprobante: ref, forma_pago: 'Cheque', factura_id: ch.factura_id || null, cliente_id: ch.cliente_id || null
    }])
  }
  async function pagoCompra(ch, fecha, cuenta_id, proveedorId, facturaCompraId, medio) {
    const ref = `Cheque ${ch.numero}${ch.banco ? ' · ' + ch.banco : ''}`
    if (facturaCompraId) {
      await supabase.from('pagos_compra').insert([{ factura_compra_id: facturaCompraId, fecha_pago: fecha, monto: ch.importe, medio_pago: medio, cuenta_id: cuenta_id || null, referencia: ref }])
      await actualizarEstadoCompra(facturaCompraId)
    }
    const prov = proveedores.find(p => p.id === proveedorId)
    await supabase.from('movimientos_financieros').insert([{
      fecha, tipo: 'egreso', categoria: 'Pago a proveedores',
      descripcion: `Pago con cheque ${ch.numero} — ${prov?.razon_social || ''}`,
      monto: ch.importe, cuenta_id: cuenta_id || null, comprobante: ref, forma_pago: 'Cheque'
    }])
  }

  async function confirmarAccion() {
    const { cheque: ch, tipo } = accion
    const fecha = accion.fecha || hoyISO()
    setTrabajando(true)
    try {
      if (tipo === 'depositar') {
        if (!accion.cuenta_id) { alert('Elegí la cuenta donde se deposita'); setTrabajando(false); return }
        await supabase.from('cheques').update({ estado: 'depositado', cuenta_id: accion.cuenta_id, fecha_movimiento: fecha }).eq('id', ch.id)
      } else if (tipo === 'cobrar') {
        const cuenta = accion.cuenta_id || ch.cuenta_id
        if (!cuenta) { alert('Elegí la cuenta que recibe el dinero'); setTrabajando(false); return }
        await cobroVenta(ch, fecha, cuenta)
        await ajustarSaldo(cuenta, Number(ch.importe))
        await supabase.from('cheques').update({ estado: 'cobrado', cuenta_id: cuenta, fecha_movimiento: fecha }).eq('id', ch.id)
      } else if (tipo === 'endosar') {
        if (!accion.proveedor_id) { alert('Elegí a qué proveedor se lo entregás'); setTrabajando(false); return }
        // Cobra la factura del cliente (sin tocar bancos) y paga la del proveedor con el mismo cheque
        await cobroVenta(ch, fecha, null)
        await pagoCompra(ch, fecha, null, accion.proveedor_id, accion.factura_compra_id || null, 'cheque')
        await supabase.from('cheques').update({ estado: 'endosado', proveedor_id: accion.proveedor_id, factura_compra_id: accion.factura_compra_id || null, fecha_movimiento: fecha }).eq('id', ch.id)
      } else if (tipo === 'debitar') {
        await pagoCompra(ch, fecha, ch.cuenta_id, ch.proveedor_id, ch.factura_compra_id, 'cheque')
        await ajustarSaldo(ch.cuenta_id, -Number(ch.importe))
        await supabase.from('cheques').update({ estado: 'debitado', fecha_movimiento: fecha }).eq('id', ch.id)
      } else if (tipo === 'rechazar') {
        await supabase.from('cheques').update({ estado: 'rechazado', fecha_movimiento: fecha }).eq('id', ch.id)
      } else if (tipo === 'anular') {
        await supabase.from('cheques').update({ estado: 'anulado', fecha_movimiento: fecha }).eq('id', ch.id)
      }
    } catch (err) {
      alert('No se pudo completar: ' + (err.message || err)); setTrabajando(false); return
    }
    setTrabajando(false)
    setAccion(null)
    await cargar()
    emitirCambioDatos('finanzas')
  }

  const abrirAccion = (cheque, tipo) => setAccion({ cheque, tipo, cuenta_id: cheque.cuenta_id || '', proveedor_id: '', factura_compra_id: '', fecha: hoyISO() })

  function acciones(c) {
    if (c.tipo === 'tercero') {
      if (c.estado === 'cartera') return [['depositar', 'Depositar'], ['cobrar', 'Cobrar'], ['endosar', 'Endosar'], ['rechazar', 'Rechazar'], ['anular', 'Anular']]
      if (c.estado === 'depositado') return [['cobrar', 'Acreditado'], ['rechazar', 'Rechazado']]
    } else if (c.estado === 'emitido') return [['debitar', 'Debitado'], ['anular', 'Anular']]
    return []
  }

  const TITULOS = { depositar: 'Depositar cheque', cobrar: 'Registrar cobro del cheque', endosar: 'Endosar a un proveedor', debitar: 'Registrar débito del cheque', rechazar: 'Marcar como rechazado', anular: 'Anular cheque' }
  const ayuda = {
    cobrar: 'Se acredita en la cuenta, se suma al saldo y, si estaba vinculado a una factura, se registra su cobro.',
    endosar: 'El cheque pasa al proveedor. Se registra el cobro al cliente y el pago al proveedor, sin mover los bancos.',
    debitar: 'Se descuenta de la cuenta que emitió el cheque y, si estaba vinculado a una factura de compra, se registra el pago.',
    depositar: 'Todavía no impacta en el saldo: se acredita cuando lo marcás como acreditado.',
    rechazar: 'No se registra ningún cobro.', anular: 'No se registra ningún movimiento.'
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {[
          { t: 'Cartera de terceros', v: ars(resumen.cartera), c: '#1D4ED8', i: <HandCoins size={15} /> },
          { t: 'Depositados (a acreditar)', v: ars(resumen.depositados), c: '#B45309', i: <Landmark size={15} /> },
          { t: 'Propios emitidos', v: ars(resumen.propios), c: '#7E22CE', i: <Landmark size={15} /> },
          { t: 'Vencen en 7 días', v: String(resumen.vencenSemana), c: '#0F766E', i: <CalendarClock size={15} /> },
          { t: 'Vencidos sin cerrar', v: String(resumen.vencidos), c: resumen.vencidos ? '#B91C1C' : '#64748B', i: <AlertTriangle size={15} /> }
        ].map(k => (
          <div key={k.t} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>{k.i}{k.t}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: k.c, fontFamily: 'monospace', marginTop: '2px' }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        {[['todos', 'Todos'], ['tercero', 'De terceros'], ['propio', 'Propios']].map(([id, l]) => (
          <button key={id} onClick={() => setFiltroTipo(id)} style={filtroTipo === id ? s.btnPrimario('#0F766E') : s.btnSecundario}>{l}</button>
        ))}
        <select style={{ ...s.input, width: 'auto' }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="abiertos">Pendientes</option>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
          <input style={{ ...s.input, paddingLeft: '30px' }} placeholder="Buscar nº, banco, librador, cliente…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <button style={{ ...s.btnPrimario('#0F766E'), marginLeft: 'auto' }} onClick={() => setForm({ ...FORM_VACIO })}><Plus size={14} style={{ verticalAlign: '-2px' }} /> Nuevo cheque</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#64748B' }}>
              <th style={{ padding: '10px' }}>Vence</th><th style={{ padding: '10px' }}>Tipo</th><th style={{ padding: '10px' }}>Nº / Banco</th>
              <th style={{ padding: '10px' }}>Cliente / Proveedor</th><th style={{ padding: '10px', textAlign: 'right' }}>Importe</th>
              <th style={{ padding: '10px' }}>Estado</th><th style={{ padding: '10px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={7} style={{ padding: '16px', color: '#64748B' }}>Cargando…</td></tr>}
            {!cargando && filtrados.length === 0 && <tr><td colSpan={7} style={{ padding: '16px', color: '#64748B' }}>No hay cheques para mostrar. Cargá uno con "Nuevo cheque".</td></tr>}
            {filtrados.map(c => {
              const d = diasHasta(c.fecha_pago)
              const abierto = ABIERTOS.includes(c.estado)
              const est = ESTADOS[c.estado]
              return (
                <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                    {fmtFecha(c.fecha_pago)}
                    {abierto && <div style={{ fontSize: '11px', color: d < 0 ? '#B91C1C' : d <= 7 ? '#B45309' : '#64748B' }}>{d < 0 ? `vencido hace ${-d} d` : d === 0 ? 'vence hoy' : `en ${d} d`}</div>}
                  </td>
                  <td style={{ padding: '10px' }}>{c.tipo === 'tercero' ? 'Terceros' : 'Propio'}</td>
                  <td style={{ padding: '10px' }}>{c.numero}<div style={{ fontSize: '11px', color: '#64748B' }}>{c.banco || (c.cuentas_bancarias?.banco) || ''}</div></td>
                  <td style={{ padding: '10px' }}>{c.tipo === 'tercero' ? (nombreCliente(c.clientes) || c.librador || '—') : (c.proveedores?.razon_social || '—')}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{ars(c.importe)}</td>
                  <td style={{ padding: '10px' }}><span style={{ background: est.bg, color: est.fg, borderRadius: '5px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 700 }}>{est.label}</span></td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {acciones(c).map(([t, l]) => <button key={t} onClick={() => abrirAccion(c, t)} style={{ ...s.btnSecundario, padding: '3px 8px', fontSize: '11.5px' }}>{l}</button>)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* NUEVO CHEQUE */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '12px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontWeight: 700 }}>Nuevo cheque</h4>
              <button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
            </div>
            <form onSubmit={guardarNuevo}>
              <div style={s.grid2}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Tipo</label>
                  <select style={s.input} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    <option value="tercero">Recibido de un cliente (de terceros)</option>
                    <option value="propio">Emitido por Briseo (propio)</option>
                  </select>
                </div>
                <div><label style={s.label}>Número</label><input style={s.input} value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} required /></div>
                <div><label style={s.label}>Importe ($)</label><input type="number" step="0.01" min="0.01" style={s.input} value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })} required /></div>
                <div><label style={s.label}>Fecha de emisión</label><input type="date" style={s.input} value={form.fecha_emision} onChange={e => setForm({ ...form, fecha_emision: e.target.value })} required /></div>
                <div><label style={s.label}>Fecha de pago (vencimiento)</label><input type="date" style={s.input} value={form.fecha_pago} onChange={e => setForm({ ...form, fecha_pago: e.target.value })} required /></div>
                {form.tipo === 'tercero' ? (
                  <>
                    <div><label style={s.label}>Banco del cheque</label><input style={s.input} value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} /></div>
                    <div><label style={s.label}>Librador (firmante)</label><input style={s.input} value={form.librador} onChange={e => setForm({ ...form, librador: e.target.value })} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={s.label}>Cliente que lo entrega</label>
                      <select style={s.input} value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value, factura_id: '' })}>
                        <option value="">Sin asignar</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{nombreCliente(c)}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={s.label}>Factura que cancela (opcional)</label>
                      <select style={s.input} value={form.factura_id} onChange={e => setForm({ ...form, factura_id: e.target.value })}>
                        <option value="">Ninguna</option>
                        {facturasVenta.filter(f => !form.cliente_id || f.cliente_id === form.cliente_id).map(f => <option key={f.id} value={f.id}>{f.numero_factura || 's/n'} — {ars(f.total)}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={s.label}>Cuenta que emite el cheque</label>
                      <select style={s.input} value={form.cuenta_id} onChange={e => setForm({ ...form, cuenta_id: e.target.value })} required>
                        <option value="">Seleccionar cuenta</option>
                        {cuentas.map(c => <option key={c.id} value={c.id}>{c.banco} — {c.tipo}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={s.label}>Proveedor al que se entrega</label>
                      <select style={s.input} value={form.proveedor_id} onChange={e => setForm({ ...form, proveedor_id: e.target.value, factura_compra_id: '' })}>
                        <option value="">Sin asignar</option>
                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={s.label}>Factura de compra que paga (opcional)</label>
                      <select style={s.input} value={form.factura_compra_id} onChange={e => setForm({ ...form, factura_compra_id: e.target.value })}>
                        <option value="">Ninguna</option>
                        {facturasCompra.filter(f => !form.proveedor_id || f.proveedor_id === form.proveedor_id).map(f => <option key={f.id} value={f.id}>{f.numero_factura || 's/n'} — {ars(f.total)}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Observaciones</label><input style={s.input} value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} /></div>
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '10px 0 0' }}>Cargar el cheque no mueve saldos: el cobro o el pago se registran cuando se acredita o se debita.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setForm(null)}>Cancelar</button>
                <button type="submit" disabled={trabajando} style={s.btnPrimario('#0F766E')}>Guardar cheque</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCIÓN SOBRE UN CHEQUE */}
      {accion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '12px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '460px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <h4 style={{ margin: 0, fontWeight: 700 }}>{TITULOS[accion.tipo]}</h4>
              <button onClick={() => setAccion(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748B' }}>Cheque {accion.cheque.numero} · <strong>{ars(accion.cheque.importe)}</strong></p>
            <div style={s.grid2}>
              <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Fecha</label><input type="date" style={s.input} value={accion.fecha} max={hoyISO()} onChange={e => setAccion({ ...accion, fecha: e.target.value })} /></div>
              {['depositar', 'cobrar'].includes(accion.tipo) && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>{accion.tipo === 'depositar' ? 'Cuenta donde se deposita' : 'Cuenta que recibe el dinero'}</label>
                  <select style={s.input} value={accion.cuenta_id} onChange={e => setAccion({ ...accion, cuenta_id: e.target.value })}>
                    <option value="">Seleccionar cuenta</option>
                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.banco} — {c.tipo}</option>)}
                  </select>
                </div>
              )}
              {accion.tipo === 'endosar' && (
                <>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>Proveedor</label>
                    <select style={s.input} value={accion.proveedor_id} onChange={e => setAccion({ ...accion, proveedor_id: e.target.value, factura_compra_id: '' })}>
                      <option value="">Seleccionar proveedor</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>Factura de compra que paga (opcional)</label>
                    <select style={s.input} value={accion.factura_compra_id} onChange={e => setAccion({ ...accion, factura_compra_id: e.target.value })}>
                      <option value="">Ninguna</option>
                      {facturasCompra.filter(f => f.proveedor_id === accion.proveedor_id).map(f => <option key={f.id} value={f.id}>{f.numero_factura || 's/n'} — {ars(f.total)}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '10px 0 0' }}>{ayuda[accion.tipo]}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button style={s.btnSecundario} onClick={() => setAccion(null)}>Cancelar</button>
              <button disabled={trabajando} style={s.btnPrimario(['rechazar', 'anular'].includes(accion.tipo) ? '#DC2626' : '#0F766E')} onClick={confirmarAccion}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
