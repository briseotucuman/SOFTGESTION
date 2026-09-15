import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { Pencil, Plus, Receipt, X, FileUp } from 'lucide-react'
import ImportarARCA from './ImportarARCA.jsx'

const c = colores.facturacion

function Facturacion()  {
  const [facturas, setFacturas] = useState([])
  const [vista, setVista] = useState('facturas')
  const [contratos, setContratos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarPagos, setMostrarPagos] = useState(null)
  const [mostrarGenerador, setMostrarGenerador] = useState(false)
  const [editando, setEditando] = useState(null)
  const [pagos, setPagos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [formPago, setFormPago] = useState({ monto: '', medio_pago: 'transferencia', referencia: '', cuenta_id: '' })
  const [form, setForm] = useState({ contrato_id: '', periodo_desde: '', periodo_hasta: '', fecha_vencimiento: '', subtotal: '', impuestos: '0', observaciones: '', estado: 'emitida' })

  const [contratosHora, setContratosHora] = useState([])
  const [mesGenerador, setMesGenerador] = useState(new Date().toISOString().slice(0, 7))
  const [resumenHoras, setResumenHoras] = useState([])
  const [loadingResumen, setLoadingResumen] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: facts }, { data: conts }, { data: cuentasData }] = await Promise.all([
      supabase.from('facturas').select(`*, clientes(razon_social,nombre_contacto), contratos(numero_contrato, tipo_facturacion, valor_hora)`).order('creado_en', { ascending: false }),
      supabase.from('contratos').select(`id, numero_contrato, precio_acordado, tipo_facturacion, valor_hora, clientes(id,razon_social,nombre_contacto)`).eq('estado', 'activo'),
      supabase.from('cuentas_bancarias').select('*').eq('activa', true)
    ])
    if (facts) setFacturas(facts)
    if (cuentasData) setCuentas(cuentasData)
    if (conts) {
      setContratos(conts)
      setContratosHora(conts.filter(ct => ct.tipo_facturacion === 'por_hora'))
    }
    setLoading(false)
  }

  function abrirEdicion(f) {
    setEditando(f)
    setForm({
      contrato_id: f.contrato_id || '',
      periodo_desde: f.periodo_desde || '',
      periodo_hasta: f.periodo_hasta || '',
      fecha_vencimiento: f.fecha_vencimiento || '',
      subtotal: f.subtotal || '',
      impuestos: f.impuestos || '0',
      observaciones: f.observaciones || '',
      estado: f.estado || 'emitida'
    })
    setMostrarForm(true)
    setMostrarGenerador(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false)
    setEditando(null)
    setForm({ contrato_id: '', periodo_desde: '', periodo_hasta: '', fecha_vencimiento: '', subtotal: '', impuestos: '0', observaciones: '', estado: 'emitida' })
  }

  async function calcularResumenHoras() {
    setLoadingResumen(true)
    const desde = mesGenerador + '-01'
    const hasta = mesGenerador+'-'+new Date(+mesGenerador.split('-')[0], +mesGenerador.split('-')[1], 0).getDate()
    const resultados = []
    for (const ct of contratosHora) {
      const { data: ordenes } = await supabase.from('ordenes_trabajo').select('id, numero_orden, fecha_programada').eq('contrato_id', ct.id).eq('estado', 'completada').gte('fecha_programada', desde).lte('fecha_programada', hasta)
      if (!ordenes || ordenes.length === 0) continue
      let totalHoras = 0
      const detalleOrdenes = []
      for (const orden of ordenes) {
        const { data: empOrdenes } = await supabase.from('orden_empleados').select('horas_trabajadas').eq('orden_id', orden.id)
        const horasOrden = (empOrdenes || []).reduce((a, eo) => a + Number(eo.horas_trabajadas || 0), 0)
        totalHoras += horasOrden
        detalleOrdenes.push({ ...orden, horas: horasOrden })
      }
      if (totalHoras > 0) {
        const subtotal = totalHoras * Number(ct.valor_hora)
        resultados.push({ contrato: ct, ordenes: detalleOrdenes, totalHoras, valorHora: Number(ct.valor_hora), subtotal, cliente: ct.clientes })
      }
    }
    setResumenHoras(resultados)
    setLoadingResumen(false)
  }

  async function generarFacturaDesdeHoras(resumen) {
    const desde = mesGenerador + '-01'
    const hasta = mesGenerador+'-'+new Date(+mesGenerador.split('-')[0], +mesGenerador.split('-')[1], 0).getDate()
    const detalle = resumen.ordenes.map(o => `${o.numero_orden} (${new Date(o.fecha_programada + 'T00:00:00').toLocaleDateString('es-AR')}): ${o.horas}hs`).join(' | ')
    const { error } = await supabase.from('facturas').insert([{
      numero_factura: 'FAC-' + new Date().getFullYear() + '-' + (Math.floor(Math.random() * 900) + 100),
      contrato_id: resumen.contrato.id,
      cliente_id: resumen.cliente.id,
      fecha_emision: new Date().toISOString().split('T')[0],
      periodo_desde: desde, periodo_hasta: hasta,
      fecha_vencimiento: null,
      subtotal: resumen.subtotal, impuestos: 0, total: resumen.subtotal,
      observaciones: `Facturación por horas — ${resumen.totalHoras}hs × $${resumen.valorHora}/h | ${detalle}`
    }])
    if (error) { alert('Error: ' + error.message); return }
    alert(`Factura generada para ${resumen.cliente.razon_social || resumen.cliente.nombre_contacto}`)
    cargarDatos()
  }


  function abrirEdicion(f) {
    setEditando(f)
    setForm({
      contrato_id: f.contrato_id || '',
      periodo_desde: f.periodo_desde || '',
      periodo_hasta: f.periodo_hasta || '',
      fecha_vencimiento: f.fecha_vencimiento || '',
      subtotal: f.subtotal || '',
      impuestos: f.impuestos || '0',
      observaciones: f.observaciones || '',
      estado: f.estado || 'emitida'
    })
    setMostrarForm(true)
    setMostrarGenerador(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false)
    setEditando(null)
    setForm({ contrato_id: '', periodo_desde: '', periodo_hasta: '', fecha_vencimiento: '', subtotal: '', impuestos: '0', observaciones: '', estado: 'emitida' })
  }

    async function guardarFactura(e) {
    e.preventDefault()
    const subtotal = parseFloat(form.subtotal)
    const impuestos = parseFloat(form.impuestos) || 0
    if (editando) {
      const { error } = await supabase.from('facturas').update({
        ...form,
        subtotal, impuestos, total: subtotal + impuestos,
        contrato_id: form.contrato_id || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        periodo_desde: form.periodo_desde || null,
        periodo_hasta: form.periodo_hasta || null,
      }).eq('id', editando.id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const contrato = contratos.find(ct => ct.id === form.contrato_id)
      const { error } = await supabase.from('facturas').insert([{
        ...form,
        numero_factura: 'FAC-' + new Date().getFullYear() + '-' + (Math.floor(Math.random() * 900) + 100),
        fecha_emision: new Date().toISOString().split('T')[0],
        cliente_id: contrato?.clientes?.id,
        subtotal, impuestos, total: subtotal + impuestos
      }])
      if (error) { alert('Error: ' + error.message); return }
    }
    cancelar()
    cargarDatos()
  }

  async function anularFactura(id) {
    if (!confirm('¿Anular esta factura?')) return
    await supabase.from('facturas').update({ estado: 'anulada' }).eq('id', id)
    cargarDatos()
  }

  async function verPagos(factura) {
    setMostrarPagos(factura)
    const { data } = await supabase.from('pagos').select('*').eq('factura_id', factura.id).order('fecha_pago', { ascending: false })
    if (data) setPagos(data)
  }

  const FORMA_PAGO_LABEL = { transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque', tarjeta: 'Tarjeta' }

  async function ajustarSaldo(cuenta_id, delta) {
    if (!cuenta_id) return
    const { data } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuenta_id).single()
    if (data) await supabase.from('cuentas_bancarias').update({ saldo: Number(data.saldo) + delta }).eq('id', cuenta_id)
  }

  async function registrarPago(e) {
    e.preventDefault()
    const monto = parseFloat(formPago.monto)
    await supabase.from('pagos').insert([{
      factura_id: mostrarPagos.id,
      fecha_pago: new Date().toISOString().split('T')[0],
      monto,
      medio_pago: formPago.medio_pago,
      referencia: formPago.referencia,
      cuenta_id: formPago.cuenta_id || null
    }])
    await supabase.from('movimientos_financieros').insert([{
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'ingreso',
      categoria: 'Cobranzas',
      descripcion: `Cobro factura ${mostrarPagos.numero_factura}`,
      monto,
      cuenta_id: formPago.cuenta_id || null,
      comprobante: formPago.referencia,
      forma_pago: FORMA_PAGO_LABEL[formPago.medio_pago] || formPago.medio_pago,
      factura_id: mostrarPagos.id
    }])
    await ajustarSaldo(formPago.cuenta_id, monto)
    const totalPagado = pagos.reduce((acc, p) => acc + Number(p.monto), 0) + monto
    const nuevoEstado = totalPagado >= mostrarPagos.total ? 'pagada' : 'parcial'
    await supabase.from('facturas').update({ estado: nuevoEstado }).eq('id', mostrarPagos.id)
    setFormPago({ monto: '', medio_pago: 'transferencia', referencia: '', cuenta_id: '' })
    verPagos(mostrarPagos)
    cargarDatos()
  }

  const estadoColor = {
    emitida:  { bg: '#fef3c7', color: '#d97706' },
    pendiente:{ bg: '#fef3c7', color: '#d97706' },
    pagada:   { bg: '#d1fae5', color: '#059669' },
    cobrada:  { bg: '#d1fae5', color: '#059669' },
    parcial:  { bg: '#dbeafe', color: '#1d4ed8' },
    vencida:  { bg: '#fee2e2', color: '#dc2626' },
    anulada:  { bg: '#f1f5f9', color: '#64748b' },
  }

  const totalPendiente = facturas.filter(f => ['pendiente','parcial','vencida','emitida'].includes(f.estado)).reduce((a, f) => a + Number(f.total), 0)

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><Receipt size={19} /> Facturación</h3>
          <p style={s.cabeceraSubtexto}>{facturas.length} facturas · {contratosHora.length} contratos por hora</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {contratosHora.length > 0 && (
            <button style={{ ...s.btnPrimario('rgba(255,255,255,0.2)'), border: '1px solid rgba(255,255,255,0.4)' }}
              onClick={() => { setMostrarGenerador(!mostrarGenerador); cancelar() }}>
              Facturar por horas
            </button>
          )}
          <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => { if (mostrarForm) { cancelar() } else { setMostrarForm(true); setMostrarGenerador(false) } }}>
            {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Factura manual</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button onClick={() => setVista('facturas')} style={vista === 'facturas' ? s.btnPrimario(c.main) : s.btnSecundario}>Facturas</button>
        <button onClick={() => setVista('importar-arca')} style={vista === 'importar-arca' ? s.btnPrimario(c.main) : s.btnSecundario}>
          <FileUp size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Importar desde ARCA
        </button>
      </div>

      {vista === 'importar-arca' && <ImportarARCA onImportado={cargarDatos} />}

      {vista === 'facturas' && (<>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '20px' }}>
        <div style={s.card}>
          <p style={{ ...s.label, color: '#64748b' }}>Total facturas</p>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{facturas.length}</p>
        </div>
        <div style={{ ...s.card, background: '#f0fdf4' }}>
          <p style={{ ...s.label, color: '#059669' }}>Pagadas / Cobradas</p>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#059669', margin: 0 }}>{facturas.filter(f => ['pagada','cobrada'].includes(f.estado)).length}</p>
        </div>
        <div style={{ ...s.card, background: '#fff1f2' }}>
          <p style={{ ...s.label, color: '#dc2626' }}>Pendiente de cobro</p>
          <p style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', margin: 0 }}>{totalPendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
        </div>
      </div>

      {/* GENERADOR POR HORAS */}
      {mostrarGenerador && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 6px', color: '#d97706', fontWeight: '800' }}>⏱ Generador de facturas por horas</h4>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>Suma las horas registradas en la Agenda y genera la factura automáticamente.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={s.label}>Período a facturar</label>
              <input type="month" style={{ ...s.input, maxWidth: '200px' }} value={mesGenerador} onChange={e => { setMesGenerador(e.target.value); setResumenHoras([]) }} />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button style={s.btnPrimario('#d97706')} onClick={calcularResumenHoras} disabled={loadingResumen}>
                {loadingResumen ? 'Calculando...' : 'Calcular horas'}
              </button>
            </div>
          </div>
          {resumenHoras.length === 0 && !loadingResumen && (
            <div style={{ background: '#fef9c3', borderRadius: '12px', padding: '16px', textAlign: 'center', color: '#854d0e', fontSize: '13px' }}>
              Presioná "Calcular horas" para ver las órdenes completadas del período.
            </div>
          )}
          {resumenHoras.map((r, i) => (
            <div key={i} style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '14px', padding: '20px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>{r.cliente.razon_social || r.cliente.nombre_contacto}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{r.contrato.numero_contrato}</p>
                </div>
                <button style={s.btnPrimario('#d97706')} onClick={() => generarFacturaDesdeHoras(r)}>Generar factura</button>
              </div>
              <div style={{ background: 'white', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                <p style={{ ...s.label, marginBottom: '8px', color: '#d97706' }}>Detalle de servicios</p>
                {r.ordenes.map((o, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                    <span>{new Date(o.fecha_programada + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>{o.numero_orden}</span>
                    <span style={{ fontWeight: '700', color: '#d97706' }}>{o.horas} hs</span>
                    <span style={{ fontWeight: '700', color: '#059669' }}>{(o.horas * r.valorHora).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#d97706', fontWeight: '700', textTransform: 'uppercase' }}>Total horas</p>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#d97706' }}>{r.totalHoras} hs</p>
                </div>
                <div style={{ background: '#dbeafe', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#1d4ed8', fontWeight: '700', textTransform: 'uppercase' }}>Valor hora</p>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#1d4ed8' }}>{r.valorHora.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
                </div>
                <div style={{ background: '#d1fae5', borderRadius: '10px', padding: '12px', textAlign: 'center', border: '2px solid #6ee7b7' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#059669', fontWeight: '700', textTransform: 'uppercase' }}>Total a facturar</p>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#059669' }}>{r.subtotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FORMULARIO */}
      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>
            {editando ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando — {editando.numero_factura}</> : 'Nueva factura manual'}
          </h4>
          <form onSubmit={guardarFactura}>
            <div style={s.grid2}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Contrato</label>
                <select style={s.input} value={form.contrato_id}
                  onChange={e => {
                    const ct = contratos.find(c => c.id === e.target.value)
                    setForm({ ...form, contrato_id: e.target.value, subtotal: ct?.precio_acordado || '' })
                  }} required={!editando}>
                  <option value="">Seleccionar contrato</option>
                  {contratos.map(ct => <option key={ct.id} value={ct.id}>{ct.numero_contrato} — {ct.clientes?.razon_social || ct.clientes?.nombre_contacto}</option>)}
                </select>
              </div>
              {[['Período desde','periodo_desde','date'],['Período hasta','periodo_hasta','date'],['Fecha vencimiento','fecha_vencimiento','date']].map(([lbl,key,type]) => (
                <div key={key}>
                  <label style={s.label}>{lbl}</label>
                  <input type={type} style={s.input} value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})}
                    onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              ))}
              <div>
                <label style={s.label}>Subtotal ($)</label>
                <input type="number" style={s.input} value={form.subtotal} onChange={e => setForm({...form, subtotal: e.target.value})} required
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label style={s.label}>Impuestos ($)</label>
                <input type="number" style={s.input} value={form.impuestos} onChange={e => setForm({...form, impuestos: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              {editando && (
                <div>
                  <label style={s.label}>Estado</label>
                  <select style={s.input} value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                    <option value="emitida">Emitida</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="parcial">Pago parcial</option>
                    <option value="pagada">Pagada</option>
                    <option value="cobrada">Cobrada</option>
                    <option value="vencida">Vencida</option>
                    <option value="anulada">Anulada</option>
                  </select>
                </div>
              )}
              <div style={{ background: c.light, borderRadius: '12px', padding: '14px 18px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: c.main, fontWeight: '700', textTransform: 'uppercase' }}>Total</p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: c.main }}>
                  {((parseFloat(form.subtotal)||0) + (parseFloat(form.impuestos)||0)).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Observaciones</label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={form.observaciones}
                  onChange={e => setForm({...form, observaciones: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={cancelar}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>{editando ? 'Guardar cambios' : 'Emitir factura'}</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL PAGOS */}
      {mostrarPagos && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#0f172a', fontWeight: '700' }}>Pagos — {mostrarPagos.numero_factura}</h4>
              <button onClick={() => setMostrarPagos(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px', fontSize: '13px' }}>
              <p style={{ margin: '0 0 4px', color: '#64748b' }}>Total: <strong style={{ color: '#0f172a' }}>{Number(mostrarPagos.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></p>
              <p style={{ margin: '0 0 4px', color: '#64748b' }}>Cobrado: <strong style={{ color: '#059669' }}>{pagos.reduce((a,p) => a+Number(p.monto),0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></p>
              <p style={{ margin: 0, color: '#64748b' }}>Pendiente: <strong style={{ color: '#dc2626' }}>{(Number(mostrarPagos.total) - pagos.reduce((a,p) => a+Number(p.monto),0)).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></p>
            </div>
            {pagos.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>{new Date(p.fecha_pago).toLocaleDateString('es-AR')}</span>
                <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{p.medio_pago}{p.cuenta_id ? ` · ${cuentas.find(ct => ct.id === p.cuenta_id)?.banco || ''}` : ''}</span>
                <strong style={{ color: '#059669' }}>{Number(p.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
              </div>
            ))}
            <form onSubmit={registrarPago} style={{ marginTop: '16px' }}>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Monto ($)</label>
                  <input type="number" style={s.input} value={formPago.monto} onChange={e => setFormPago({...formPago, monto: e.target.value})} required />
                </div>
                <div>
                  <label style={s.label}>Medio de pago</label>
                  <select style={s.input} value={formPago.medio_pago} onChange={e => setFormPago({...formPago, medio_pago: e.target.value})}>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Cuenta / caja que recibe el pago</label>
                  <select style={s.input} value={formPago.cuenta_id} onChange={e => setFormPago({...formPago, cuenta_id: e.target.value})} required>
                    <option value="">Seleccionar cuenta</option>
                    {cuentas.map(ct => <option key={ct.id} value={ct.id}>{ct.banco} — {ct.tipo}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Referencia</label>
                  <input style={s.input} value={formPago.referencia} onChange={e => setFormPago({...formPago, referencia: e.target.value})} placeholder="Nro. transferencia, cheque..." />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setMostrarPagos(null)}>Cerrar</button>
                <button type="submit" style={s.btnPrimario('#059669')}>Registrar pago</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLA */}
      <div style={{ ...s.card, padding: 0, overflow: 'hidden', marginTop: '20px' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : facturas.length === 0 ? <div style={s.empty}>No hay facturas registradas</div>
        : (
          <table style={s.tabla}>
            <thead>
              <tr>{['Número','Cliente','Tipo','Emisión','Vencimiento','Total','Estado',''].map(h => (
                <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {facturas.map((f, i) => {
                const ec = estadoColor[f.estado] || { bg: '#f1f5f9', color: '#64748b' }
                const esPorHora = f.contratos?.tipo_facturacion === 'por_hora'
                return (
                  <tr key={f.id} style={s.tablaFila(i)}>
                    <td style={{ ...s.tablaCell, fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>{f.numero_factura}</td>
                    <td style={s.tablaCellBold}>{f.clientes?.razon_social || f.clientes?.nombre_contacto}</td>
                    <td style={s.tablaCell}>
                      <span style={s.badge(esPorHora ? '#fef3c7' : '#dbeafe', esPorHora ? '#d97706' : '#1d4ed8')}>
                        {esPorHora ? '⏱ Por hora' : 'Fijo'}
                      </span>
                    </td>
                    <td style={s.tablaCell}>{new Date(f.fecha_emision).toLocaleDateString('es-AR')}</td>
                    <td style={s.tablaCell}>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-AR') : '—'}</td>
                    <td style={{ ...s.tablaCellBold, color: '#0f172a' }}>{Number(f.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={s.tablaCell}><span style={s.badge(ec.bg, ec.color)}>{f.estado}</span></td>
                    <td style={s.tablaCell}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => verPagos(f)} style={{ ...s.btnPrimario('#059669'), padding: '5px 10px', fontSize: '12px' }}>Pagos</button>
                        <button onClick={() => abrirEdicion(f)} style={{ ...s.btnPrimario(c.main), padding: '5px 10px', fontSize: '12px' }}><Pencil size={14} /></button>
                        {f.estado !== 'anulada' && (
                          <button onClick={() => anularFactura(f.id)} style={{ ...s.btnPeligro, padding: '5px 10px', fontSize: '12px' }}>Anular</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      </>)}
    </div>
  )
}

export default Facturacion


