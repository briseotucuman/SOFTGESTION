import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { BarChart3, Pencil, Plus, Trash2, X, TrendingDown, TrendingUp, Wallet2, ArrowRightLeft } from 'lucide-react'

const c = colores.finanzas

const CATEGORIAS = {
  ingreso: ['Cobranzas', 'Otro ingreso'],
  egreso: ['Insumos', 'Servicios', 'Haberes', 'Impuestos', 'Alquileres', 'Socios', 'Marketing', 'Otro egreso']
}
const CATEGORIAS_COMPRA = ['Insumos', 'Servicios', 'Alquiler', 'Impuestos', 'Mantenimiento', 'Otro']
const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta', 'Otro']

const ESTADO_COLOR = {
  pendiente: { bg: '#fef3c7', color: '#d97706' },
  parcial:   { bg: '#dbeafe', color: '#1d4ed8' },
  pagada:    { bg: '#d1fae5', color: '#059669' },
  vencida:   { bg: '#fee2e2', color: '#dc2626' },
  anulada:   { bg: '#f1f5f9', color: '#64748b' },
}

function Finanzas() {
  const [vista, setVista] = useState('movimientos') // movimientos | por-cobrar | por-pagar | proyeccion
  const [movimientos, setMovimientos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [facturas, setFacturas] = useState([])
  const [facturasCobrarTodas, setFacturasCobrarTodas] = useState([])
  const [pagosVenta, setPagosVenta] = useState([])
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

  // ---- Cuentas por pagar ----
  const [facturasCompra, setFacturasCompra] = useState([])
  const [pagosCompra, setPagosCompra] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [clientes, setClientes] = useState([])
  const [mostrarFormCompra, setMostrarFormCompra] = useState(false)
  const [formCompra, setFormCompra] = useState({ proveedor_id: '', cliente_id: '', numero_factura: '', fecha_emision: new Date().toISOString().split('T')[0], fecha_vencimiento: '', categoria: 'Insumos', total: '', observaciones: '' })
  const [pagandoFactura, setPagandoFactura] = useState(null)
  const [formPagoCompra, setFormPagoCompra] = useState({ monto: '', medio_pago: 'transferencia', cuenta_id: '', referencia: '' })

  // ---- Cuentas por cobrar ----
  const [cobrandoFactura, setCobrandoFactura] = useState(null)
  const [formCobro, setFormCobro] = useState({ monto: '', medio_pago: 'transferencia', cuenta_id: '', referencia: '' })
  const [diasCobroPago, setDiasCobroPago] = useState({ diasCobro: null, diasPago: null })

  // ---- Indicador de flujo (cobrar/pagar) ----
  const [porCobrar, setPorCobrar] = useState(0)
  const [porPagar, setPorPagar] = useState(0)
  const [proyeccion, setProyeccion] = useState(null)

  // ---- Estado de cuenta ----
  const [cuentaEstadoId, setCuentaEstadoId] = useState('')
  const [rangoDesde, setRangoDesde] = useState(new Date().toISOString().slice(0,7) + '-01')
  const [rangoHasta, setRangoHasta] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => { if (vista === 'proyeccion' && !proyeccion) cargarProyeccion() }, [vista])

  const BUCKETS = [
    { id: 'vencido', label: 'Vencido', desde: -99999, hasta: -1 },
    { id: 'b30', label: '0-30 días', desde: 0, hasta: 30 },
    { id: 'b60', label: '31-60 días', desde: 31, hasta: 60 },
    { id: 'b90', label: '61-90 días', desde: 61, hasta: 90 },
    { id: 'mas90', label: '+90 días', desde: 91, hasta: 99999 },
    { id: 'sinfecha', label: 'Sin fecha', desde: null, hasta: null },
  ]

  async function cargarProyeccion() {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const [{ data: fact }, { data: pagosV }, { data: factC }, { data: pagosC }, { data: cf }] = await Promise.all([
      supabase.from('facturas').select('id,total,fecha_vencimiento').in('estado', ['emitida','pendiente','parcial','vencida']),
      supabase.from('pagos').select('factura_id,monto'),
      supabase.from('facturas_compra').select('id,total,fecha_vencimiento').neq('estado','pagada').neq('estado','anulada'),
      supabase.from('pagos_compra').select('factura_compra_id,monto'),
      supabase.from('costos_fijos').select('monto').eq('activo', true).eq('mes', new Date().toISOString().slice(0,7)),
    ])
    const pagadoV = {}; (pagosV||[]).forEach(p => { pagadoV[p.factura_id] = (pagadoV[p.factura_id]||0) + Number(p.monto) })
    const pagadoC = {}; (pagosC||[]).forEach(p => { pagadoC[p.factura_compra_id] = (pagadoC[p.factura_compra_id]||0) + Number(p.monto) })

    function bucketDe(fechaVenc) {
      if (!fechaVenc) return 'sinfecha'
      const dias = Math.floor((new Date(fechaVenc + 'T00:00:00') - hoy) / (1000*60*60*24))
      const b = BUCKETS.find(bk => bk.desde !== null && dias >= bk.desde && dias <= bk.hasta)
      return b ? b.id : 'mas90'
    }

    const porBucket = {}
    BUCKETS.forEach(b => { porBucket[b.id] = { cobrar: 0, pagar: 0 } })
    ;(fact||[]).forEach(f => {
      const saldo = Number(f.total) - (pagadoV[f.id]||0)
      if (saldo > 0) porBucket[bucketDe(f.fecha_vencimiento)].cobrar += saldo
    })
    ;(factC||[]).forEach(f => {
      const saldo = Number(f.total) - (pagadoC[f.id]||0)
      if (saldo > 0) porBucket[bucketDe(f.fecha_vencimiento)].pagar += saldo
    })

    const costoFijoMensual = (cf||[]).reduce((a,x) => a + Number(x.monto), 0)
    setProyeccion({ buckets: BUCKETS.map(b => ({ ...b, ...porBucket[b.id] })), costoFijoMensual })
  }

  async function cargarDatos() {
    setLoading(true)
    const [
      { data: movData }, { data: cuentasData }, { data: facturasData },
      { data: factCompraData }, { data: pagosCompraData }, { data: provData }, { data: cliData },
      { data: factVentaTodas }, { data: pagosVentaData }
    ] = await Promise.all([
      supabase.from('movimientos_financieros').select('*').order('fecha', { ascending: false }),
      supabase.from('cuentas_bancarias').select('*').eq('activa', true),
      supabase.from('facturas').select('id, numero_factura, clientes(razon_social), total, estado').eq('estado', 'emitida').order('fecha_emision', { ascending: false }),
      supabase.from('facturas_compra').select('*, proveedores(razon_social), clientes(razon_social,nombre_contacto)').order('fecha_emision', { ascending: false }),
      supabase.from('pagos_compra').select('*'),
      supabase.from('proveedores').select('id, razon_social').eq('activo', true),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true),
      supabase.from('facturas').select('id,numero_factura,total,estado,fecha_emision,fecha_vencimiento,clientes(razon_social,nombre_contacto)').order('fecha_emision', { ascending: false }),
      supabase.from('pagos').select('*, facturas(fecha_emision)'),
    ])
    if (movData) setMovimientos(movData)
    if (cuentasData) setCuentas(cuentasData)
    if (facturasData) setFacturas(facturasData)
    if (factCompraData) setFacturasCompra(factCompraData)
    if (pagosCompraData) setPagosCompra(pagosCompraData)
    if (provData) setProveedores(provData)
    if (cliData) setClientes(cliData)
    if (factVentaTodas) setFacturasCobrarTodas(factVentaTodas)
    if (pagosVentaData) setPagosVenta(pagosVentaData)

    // Por cobrar: total facturado pendiente/parcial/vencida, neto de lo ya cobrado
    const pagadoPorFacturaVenta = {}
    ;(pagosVentaData || []).forEach(p => { pagadoPorFacturaVenta[p.factura_id] = (pagadoPorFacturaVenta[p.factura_id] || 0) + Number(p.monto) })
    const facturasVentaPendientes = (factVentaTodas || []).filter(f => ['emitida','pendiente','parcial','vencida'].includes(f.estado))
    const cobrar = facturasVentaPendientes.reduce((acc, f) => acc + Math.max(0, Number(f.total) - (pagadoPorFacturaVenta[f.id] || 0)), 0)
    setPorCobrar(cobrar)

    // Por pagar: total facturas de compra pendiente/parcial/vencida, neto de lo ya pagado
    const pagadoPorFacturaCompra = {}
    ;(pagosCompraData || []).forEach(p => { pagadoPorFacturaCompra[p.factura_compra_id] = (pagadoPorFacturaCompra[p.factura_compra_id] || 0) + Number(p.monto) })
    const pendientesCompra = (factCompraData || []).filter(f => f.estado !== 'pagada' && f.estado !== 'anulada')
    const pagar = pendientesCompra.reduce((acc, f) => acc + Math.max(0, Number(f.total) - (pagadoPorFacturaCompra[f.id] || 0)), 0)
    setPorPagar(pagar)

    // Días de cobro (DSO real): promedio de días entre emisión de la factura y cada cobro registrado
    const diffs = (pagosVentaData || [])
      .filter(p => p.facturas?.fecha_emision && p.fecha_pago)
      .map(p => Math.round((new Date(p.fecha_pago) - new Date(p.facturas.fecha_emision)) / (1000*60*60*24)))
      .filter(d => d >= 0)
    const diasCobro = diffs.length > 0 ? diffs.reduce((a,d)=>a+d,0) / diffs.length : null

    // Días de pago (DPO real): promedio de días entre emisión de la factura de compra y cada pago registrado
    const factCompraPorId = {}
    ;(factCompraData || []).forEach(f => { factCompraPorId[f.id] = f })
    const diffsPago = (pagosCompraData || [])
      .filter(p => factCompraPorId[p.factura_compra_id]?.fecha_emision && p.fecha_pago)
      .map(p => Math.round((new Date(p.fecha_pago) - new Date(factCompraPorId[p.factura_compra_id].fecha_emision)) / (1000*60*60*24)))
      .filter(d => d >= 0)
    const diasPago = diffsPago.length > 0 ? diffsPago.reduce((a,d)=>a+d,0) / diffsPago.length : null

    setDiasCobroPago({ diasCobro, diasPago, muestraCobro: diffs.length, muestraPago: diffsPago.length })

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

  function saldoPendiente(factura) {
    const pagado = pagosCompra.filter(p => p.factura_compra_id === factura.id).reduce((a, p) => a + Number(p.monto), 0)
    return Math.max(0, Number(factura.total) - pagado)
  }

  function saldoPendienteVenta(factura) {
    const pagado = pagosVenta.filter(p => p.factura_id === factura.id).reduce((a, p) => a + Number(p.monto), 0)
    return Math.max(0, Number(factura.total) - pagado)
  }

  // Reconstruye el saldo corrido de una cuenta a partir de su historial completo de movimientos
  // (el saldo actual guardado es el punto de llegada; se reconstruye hacia atrás y luego hacia adelante)
  function calcularEstadoCuenta(cuentaId, desde, hasta) {
    const cuenta = cuentas.find(ct => ct.id === cuentaId)
    if (!cuenta) return null
    const delCuenta = movimientos
      .filter(m => m.cuenta_id === cuentaId)
      .slice()
      .sort((a, b) => a.fecha === b.fecha ? new Date(a.creado_en) - new Date(b.creado_en) : new Date(a.fecha) - new Date(b.fecha))
    const sumaDeltas = delCuenta.reduce((acc, m) => acc + (m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)), 0)
    let saldoCorrido = Number(cuenta.saldo) - sumaDeltas // saldo antes del primer movimiento jamás registrado
    const filas = delCuenta.map(m => {
      const delta = m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)
      saldoCorrido += delta
      return { ...m, saldoCorrido }
    })
    const enRango = filas.filter(f => f.fecha >= desde && f.fecha <= hasta)
    const saldoInicial = enRango.length > 0
      ? enRango[0].saldoCorrido - (enRango[0].tipo === 'ingreso' ? Number(enRango[0].monto) : -Number(enRango[0].monto))
      : (filas.filter(f => f.fecha < desde).slice(-1)[0]?.saldoCorrido ?? Number(cuenta.saldo) - sumaDeltas)
    const saldoFinal = enRango.length > 0 ? enRango[enRango.length - 1].saldoCorrido : saldoInicial
    return { cuenta, filas: enRango, saldoInicial, saldoFinal }
  }

  // ---------- Movimientos ----------
  function abrirEdicion(m) {
    setEditando(m)
    setForm({
      fecha: m.fecha || new Date().toISOString().split('T')[0],
      tipo: m.tipo || 'ingreso', categoria: m.categoria || '', descripcion: m.descripcion || '',
      monto: m.monto || '', cuenta_id: m.cuenta_id || '', comprobante: m.comprobante || '',
      forma_pago: m.forma_pago || 'Efectivo', factura_id: m.factura_id || ''
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false); setEditando(null)
    setForm({ fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', categoria: '', descripcion: '', monto: '', cuenta_id: '', comprobante: '', forma_pago: 'Efectivo', factura_id: '' })
  }

  async function guardarMovimiento(e) {
    e.preventDefault()
    const datos = { ...form, monto: parseFloat(form.monto), cuenta_id: form.cuenta_id || null, factura_id: form.factura_id || null }
    if (editando) {
      if (editando.cuenta_id) await ajustarSaldo(editando.cuenta_id, -efectoEnSaldo(editando.tipo, editando.monto))
      const { error } = await supabase.from('movimientos_financieros').update(datos).eq('id', editando.id)
      if (error) { alert('Error: ' + error.message); return }
      if (datos.cuenta_id) await ajustarSaldo(datos.cuenta_id, efectoEnSaldo(datos.tipo, datos.monto))
    } else {
      const { error } = await supabase.from('movimientos_financieros').insert([datos])
      if (error) { alert('Error: ' + error.message); return }
      if (datos.cuenta_id) await ajustarSaldo(datos.cuenta_id, efectoEnSaldo(datos.tipo, datos.monto))
      if (form.categoria === 'Cobranzas' && form.factura_id) {
        await supabase.from('facturas').update({ estado: 'cobrada' }).eq('id', form.factura_id)
      }
    }
    cancelar(); cargarDatos()
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

  // ---------- Cuentas por pagar ----------
  async function guardarFacturaCompra(e) {
    e.preventDefault()
    const { error } = await supabase.from('facturas_compra').insert([{
      ...formCompra,
      proveedor_id: formCompra.proveedor_id || null,
      cliente_id: formCompra.cliente_id || null,
      total: parseFloat(formCompra.total) || 0,
      subtotal: parseFloat(formCompra.total) || 0,
      fecha_vencimiento: formCompra.fecha_vencimiento || null,
      estado: 'pendiente'
    }])
    if (error) { alert('Error: ' + error.message); return }
    setMostrarFormCompra(false)
    setFormCompra({ proveedor_id: '', cliente_id: '', numero_factura: '', fecha_emision: new Date().toISOString().split('T')[0], fecha_vencimiento: '', categoria: 'Insumos', total: '', observaciones: '' })
    cargarDatos()
  }

  function abrirPago(factura) {
    setPagandoFactura(factura)
    setFormPagoCompra({ monto: saldoPendiente(factura).toFixed(2), medio_pago: 'transferencia', cuenta_id: '', referencia: '' })
  }

  async function registrarPagoCompra(e) {
    e.preventDefault()
    const monto = parseFloat(formPagoCompra.monto)
    if (!formPagoCompra.cuenta_id) { alert('Elegí de qué cuenta sale el pago'); return }
    await supabase.from('pagos_compra').insert([{
      factura_compra_id: pagandoFactura.id, monto,
      medio_pago: formPagoCompra.medio_pago, cuenta_id: formPagoCompra.cuenta_id, referencia: formPagoCompra.referencia
    }])
    await supabase.from('movimientos_financieros').insert([{
      fecha: new Date().toISOString().split('T')[0], tipo: 'egreso',
      categoria: pagandoFactura.categoria || 'Otro egreso',
      descripcion: `Pago factura ${pagandoFactura.numero_factura || 's/n'} — ${pagandoFactura.proveedores?.razon_social || ''}`,
      monto, cuenta_id: formPagoCompra.cuenta_id, comprobante: formPagoCompra.referencia,
      forma_pago: formPagoCompra.medio_pago.charAt(0).toUpperCase() + formPagoCompra.medio_pago.slice(1)
    }])
    await ajustarSaldo(formPagoCompra.cuenta_id, -monto)
    const totalPagado = pagosCompra.filter(p => p.factura_compra_id === pagandoFactura.id).reduce((a, p) => a + Number(p.monto), 0) + monto
    const nuevoEstado = totalPagado >= Number(pagandoFactura.total) ? 'pagada' : 'parcial'
    await supabase.from('facturas_compra').update({ estado: nuevoEstado }).eq('id', pagandoFactura.id)
    setPagandoFactura(null)
    cargarDatos()
  }

  // ---------- Cuentas por cobrar ----------
  function abrirCobro(factura) {
    setCobrandoFactura(factura)
    setFormCobro({ monto: saldoPendienteVenta(factura).toFixed(2), medio_pago: 'transferencia', cuenta_id: '', referencia: '' })
  }

  async function registrarCobro(e) {
    e.preventDefault()
    const monto = parseFloat(formCobro.monto)
    if (!formCobro.cuenta_id) { alert('Elegí a qué cuenta entra el cobro'); return }
    await supabase.from('pagos').insert([{
      factura_id: cobrandoFactura.id, fecha_pago: new Date().toISOString().split('T')[0], monto,
      medio_pago: formCobro.medio_pago, cuenta_id: formCobro.cuenta_id, referencia: formCobro.referencia
    }])
    await supabase.from('movimientos_financieros').insert([{
      fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', categoria: 'Cobranzas',
      descripcion: `Cobro factura ${cobrandoFactura.numero_factura || 's/n'} — ${cobrandoFactura.clientes?.razon_social || cobrandoFactura.clientes?.nombre_contacto || ''}`,
      monto, cuenta_id: formCobro.cuenta_id, comprobante: formCobro.referencia,
      forma_pago: formCobro.medio_pago.charAt(0).toUpperCase() + formCobro.medio_pago.slice(1),
      factura_id: cobrandoFactura.id
    }])
    await ajustarSaldo(formCobro.cuenta_id, monto)
    const totalCobrado = pagosVenta.filter(p => p.factura_id === cobrandoFactura.id).reduce((a, p) => a + Number(p.monto), 0) + monto
    const nuevoEstado = totalCobrado >= Number(cobrandoFactura.total) ? 'cobrada' : 'parcial'
    await supabase.from('facturas').update({ estado: nuevoEstado }).eq('id', cobrandoFactura.id)
    setCobrandoFactura(null)
    cargarDatos()
  }

  const movMes = movimientos.filter(m => m.fecha && m.fecha.startsWith(filtroMes))
  const totalIngresos = movMes.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0)
  const totalEgresos = movMes.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0)
  const balance = totalIngresos - totalEgresos
  const saldoTotal = cuentas.reduce((a, ct) => a + Number(ct.saldo), 0)
  const flujoProyectado = porCobrar - porPagar

  return (
    <div>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><BarChart3 size={19} /> Finanzas</h3>
          <p style={s.cabeceraSubtexto}>{movimientos.length} movimientos · {facturasCompra.filter(f=>f.estado!=='pagada'&&f.estado!=='anulada').length} facturas de compra pendientes</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ ...s.btnPrimario('rgba(255,255,255,0.2)'), border: '1px solid rgba(255,255,255,0.4)' }} onClick={() => setMostrarCuenta(true)}>+ Cuenta</button>
          {vista === 'movimientos' && (
            <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => { if (mostrarForm) { cancelar() } else { setMostrarForm(true) } }}>
              {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Movimiento</>}
            </button>
          )}
          {vista === 'por-pagar' && (
            <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => setMostrarFormCompra(!mostrarFormCompra)}>
              {mostrarFormCompra ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Factura de compra</>}
            </button>
          )}
        </div>
      </div>

      {/* INDICADOR DE FLUJO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '14px' }}>
        <div style={{ ...s.card, background: '#eff6ff', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><TrendingUp size={18} color="#1d4ed8" /></div>
          <div>
            <p style={{ ...s.label, color: '#1d4ed8', margin: 0 }}>Por cobrar</p>
            <p style={{ fontSize: '19px', fontWeight: '800', color: '#1d4ed8', margin: 0 }}>{porCobrar.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
          </div>
        </div>
        <div style={{ ...s.card, background: '#fff7ed', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><TrendingDown size={18} color="#c2410c" /></div>
          <div>
            <p style={{ ...s.label, color: '#c2410c', margin: 0 }}>Por pagar</p>
            <p style={{ fontSize: '19px', fontWeight: '800', color: '#c2410c', margin: 0 }}>{porPagar.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
          </div>
        </div>
        <div style={{ ...s.card, background: flujoProyectado >= 0 ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: flujoProyectado >= 0 ? '#bbf7d0' : '#fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ArrowRightLeft size={18} color={flujoProyectado >= 0 ? '#15803d' : '#b91c1c'} /></div>
          <div>
            <p style={{ ...s.label, color: flujoProyectado >= 0 ? '#15803d' : '#b91c1c', margin: 0 }}>Flujo proyectado (cobrar − pagar)</p>
            <p style={{ fontSize: '19px', fontWeight: '800', color: flujoProyectado >= 0 ? '#15803d' : '#b91c1c', margin: 0 }}>{flujoProyectado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
          </div>
        </div>
      </div>

      {/* RESUMEN DEL MES */}
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

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button onClick={() => setVista('movimientos')} style={vista === 'movimientos' ? s.btnPrimario(c.main) : s.btnSecundario}>Movimientos</button>
        <button onClick={() => setVista('por-cobrar')} style={vista === 'por-cobrar' ? s.btnPrimario(c.main) : s.btnSecundario}>
          <TrendingUp size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cuentas por cobrar
        </button>
        <button onClick={() => setVista('por-pagar')} style={vista === 'por-pagar' ? s.btnPrimario(c.main) : s.btnSecundario}>
          <Wallet2 size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cuentas por pagar
        </button>
        <button onClick={() => setVista('estado-cuenta')} style={vista === 'estado-cuenta' ? s.btnPrimario(c.main) : s.btnSecundario}>
          <ArrowRightLeft size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Estado de cuenta
        </button>
        <button onClick={() => setVista('proyeccion')} style={vista === 'proyeccion' ? s.btnPrimario(c.main) : s.btnSecundario}>
          <BarChart3 size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Proyección de caja
        </button>
      </div>

      {/* FORM MOVIMIENTO */}
      {vista === 'movimientos' && mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>
            {editando ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando movimiento</> : 'Nuevo movimiento'}
          </h4>
          <form onSubmit={guardarMovimiento}>
            <div style={s.grid2}>
              <div><label style={s.label}>Fecha</label><input type="date" style={s.input} value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} required /></div>
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
              <div><label style={s.label}>Monto ($)</label><input type="number" style={s.input} value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} required /></div>
              <div>
                <label style={s.label}>Cuenta bancaria</label>
                <select style={s.input} value={form.cuenta_id} onChange={e => setForm({...form, cuenta_id: e.target.value})} required>
                  <option value="">Seleccionar cuenta</option>
                  {cuentas.map(ct => <option key={ct.id} value={ct.id}>{ct.banco} — {ct.tipo}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Comprobante</label><input style={s.input} value={form.comprobante} onChange={e => setForm({...form, comprobante: e.target.value})} placeholder="Nro. factura, recibo..." /></div>
              {form.tipo === 'ingreso' && form.categoria === 'Cobranzas' && (
                <div>
                  <label style={s.label}>Asociar a factura</label>
                  <select style={s.input} value={form.factura_id} onChange={e => setForm({...form, factura_id: e.target.value})}>
                    <option value="">Sin factura</option>
                    {facturas.map(f => <option key={f.id} value={f.id}>#{f.numero_factura} — {f.clientes?.razon_social} — {Number(f.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</option>)}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Descripción</label><input style={s.input} value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={cancelar}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>{editando ? 'Guardar cambios' : 'Guardar movimiento'}</button>
            </div>
          </form>
        </div>
      )}

      {/* FORM NUEVA FACTURA DE COMPRA */}
      {vista === 'por-pagar' && mostrarFormCompra && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 20px', color: c.main, fontWeight: '700' }}>Nueva factura de compra</h4>
          <form onSubmit={guardarFacturaCompra}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Proveedor</label>
                <select style={s.input} value={formCompra.proveedor_id} onChange={e => setFormCompra({...formCompra, proveedor_id: e.target.value})}>
                  <option value="">Sin especificar</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Nº de factura</label><input style={s.input} value={formCompra.numero_factura} onChange={e => setFormCompra({...formCompra, numero_factura: e.target.value})} /></div>
              <div><label style={s.label}>Fecha de emisión</label><input type="date" style={s.input} value={formCompra.fecha_emision} onChange={e => setFormCompra({...formCompra, fecha_emision: e.target.value})} required /></div>
              <div><label style={s.label}>Fecha de vencimiento</label><input type="date" style={s.input} value={formCompra.fecha_vencimiento} onChange={e => setFormCompra({...formCompra, fecha_vencimiento: e.target.value})} /></div>
              <div>
                <label style={s.label}>Categoría</label>
                <select style={s.input} value={formCompra.categoria} onChange={e => setFormCompra({...formCompra, categoria: e.target.value})}>
                  {CATEGORIAS_COMPRA.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Imputar a cliente (opcional)</label>
                <select style={s.input} value={formCompra.cliente_id} onChange={e => setFormCompra({...formCompra, cliente_id: e.target.value})}>
                  <option value="">Sin asignar</option>
                  {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Total ($)</label><input type="number" style={s.input} value={formCompra.total} onChange={e => setFormCompra({...formCompra, total: e.target.value})} required /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Observaciones</label><input style={s.input} value={formCompra.observaciones} onChange={e => setFormCompra({...formCompra, observaciones: e.target.value})} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={() => setMostrarFormCompra(false)}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>Guardar factura</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL REGISTRAR PAGO DE COMPRA */}
      {pagandoFactura && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>Registrar pago</h4>
              <button onClick={() => setPagandoFactura(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#64748b' }}>
              {pagandoFactura.numero_factura || 's/n'} — {pagandoFactura.proveedores?.razon_social || 'Sin proveedor'} · Saldo pendiente: <strong>{saldoPendiente(pagandoFactura).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
            </p>
            <form onSubmit={registrarPagoCompra}>
              <div style={s.grid2}>
                <div><label style={s.label}>Monto ($)</label><input type="number" style={s.input} value={formPagoCompra.monto} onChange={e => setFormPagoCompra({...formPagoCompra, monto: e.target.value})} required /></div>
                <div>
                  <label style={s.label}>Medio de pago</label>
                  <select style={s.input} value={formPagoCompra.medio_pago} onChange={e => setFormPagoCompra({...formPagoCompra, medio_pago: e.target.value})}>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Cuenta que paga</label>
                  <select style={s.input} value={formPagoCompra.cuenta_id} onChange={e => setFormPagoCompra({...formPagoCompra, cuenta_id: e.target.value})} required>
                    <option value="">Seleccionar cuenta</option>
                    {cuentas.map(ct => <option key={ct.id} value={ct.id}>{ct.banco} — {ct.tipo}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Referencia</label><input style={s.input} value={formPagoCompra.referencia} onChange={e => setFormPagoCompra({...formPagoCompra, referencia: e.target.value})} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setPagandoFactura(null)}>Cancelar</button>
                <button type="submit" style={s.btnPrimario(c.main)}>Confirmar pago</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CUENTA */}
      {mostrarCuenta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>Nueva cuenta bancaria</h4>
              <button onClick={() => setMostrarCuenta(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <form onSubmit={guardarCuenta}>
              <div style={s.grid2}>
                <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Banco / Descripción</label><input style={s.input} value={formCuenta.banco} onChange={e => setFormCuenta({...formCuenta, banco: e.target.value})} required /></div>
                <div>
                  <label style={s.label}>Tipo</label>
                  <select style={s.input} value={formCuenta.tipo} onChange={e => setFormCuenta({...formCuenta, tipo: e.target.value})}>
                    <option value="caja_ahorro">Caja de ahorro</option>
                    <option value="cuenta_corriente">Cuenta corriente</option>
                    <option value="caja_chica">Caja chica</option>
                  </select>
                </div>
                <div><label style={s.label}>Saldo inicial ($)</label><input type="number" style={s.input} value={formCuenta.saldo} onChange={e => setFormCuenta({...formCuenta, saldo: e.target.value})} /></div>
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

      {/* VISTA MOVIMIENTOS */}
      {vista === 'movimientos' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <input type="month" style={{ ...s.buscador, maxWidth: '200px' }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
            <span style={{ color: '#64748b', fontSize: '13px' }}>{movMes.length} movimientos este mes</span>
          </div>
          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            {loading ? <div style={s.empty}>Cargando...</div>
            : movMes.length === 0 ? <div style={s.empty}>No hay movimientos este mes</div>
            : (
              <table style={s.tabla}>
                <thead><tr>{['Fecha','Tipo','Categoría','Descripción','Cuenta','Forma de pago','Comprobante','Monto',''].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
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
                      <td style={{ ...s.tablaCellBold, textAlign: 'right', color: m.tipo === 'ingreso' ? '#059669' : '#dc2626' }}>{m.tipo === 'ingreso' ? '+' : '-'}{Number(m.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
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
        </>
      )}

      {/* VISTA CUENTAS POR COBRAR */}
      {vista === 'por-cobrar' && (
        <div>
          <div style={{ ...s.card, background: '#eff6ff', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><TrendingUp size={18} color="#1d4ed8" /></div>
            <div>
              <p style={{ ...s.label, color: '#1d4ed8', margin: 0 }}>Días de cobro (DSO)</p>
              <p style={{ fontSize: '19px', fontWeight: '800', color: '#1d4ed8', margin: 0 }}>
                {diasCobroPago.diasCobro != null ? `${diasCobroPago.diasCobro.toFixed(0)} días` : 'Sin cobros registrados aún'}
              </p>
              {diasCobroPago.diasCobro != null && <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#3b82f6' }}>Promedio real entre emisión y cobro, sobre {diasCobroPago.muestraCobro} cobro(s) registrado(s)</p>}
            </div>
          </div>
          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            {loading ? <div style={s.empty}>Cargando...</div>
            : facturasCobrarTodas.length === 0 ? <div style={s.empty}>No hay facturas registradas</div>
            : (
              <table style={s.tabla}>
                <thead><tr>{['Cliente','Nº factura','Emisión','Vencimiento','Total','Saldo','Estado',''].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                <tbody>
                  {facturasCobrarTodas.filter(f => f.estado !== 'anulada').map((f, i) => {
                    const ec = ESTADO_COLOR[f.estado] || ESTADO_COLOR.pendiente
                    const saldo = saldoPendienteVenta(f)
                    const puedeCobrar = !['pagada','cobrada','anulada'].includes(f.estado)
                    return (
                      <tr key={f.id} style={s.tablaFila(i)}>
                        <td style={s.tablaCellBold}>{f.clientes?.razon_social || f.clientes?.nombre_contacto || '—'}</td>
                        <td style={{ ...s.tablaCell, fontSize: '12px', color: '#94a3b8' }}>{f.numero_factura || '—'}</td>
                        <td style={s.tablaCell}>{f.fecha_emision ? new Date(f.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
                        <td style={s.tablaCell}>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
                        <td style={s.tablaCell}>{Number(f.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                        <td style={{ ...s.tablaCellBold, color: saldo > 0 ? '#dc2626' : '#059669' }}>{saldo.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                        <td style={s.tablaCell}><span style={s.badge(ec.bg, ec.color)}>{f.estado}</span></td>
                        <td style={s.tablaCell}>
                          {puedeCobrar && <button style={{ ...s.btnPrimario(c.main), padding: '6px 12px', fontSize: '12px' }} onClick={() => abrirCobro(f)}>Registrar cobro</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR COBRO */}
      {cobrandoFactura && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>Registrar cobro</h4>
              <button onClick={() => setCobrandoFactura(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#64748b' }}>
              {cobrandoFactura.numero_factura || 's/n'} — {cobrandoFactura.clientes?.razon_social || cobrandoFactura.clientes?.nombre_contacto || 'Sin cliente'} · Saldo pendiente: <strong>{saldoPendienteVenta(cobrandoFactura).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
            </p>
            <form onSubmit={registrarCobro}>
              <div style={s.grid2}>
                <div><label style={s.label}>Monto ($)</label><input type="number" style={s.input} value={formCobro.monto} onChange={e => setFormCobro({...formCobro, monto: e.target.value})} required /></div>
                <div>
                  <label style={s.label}>Medio de pago</label>
                  <select style={s.input} value={formCobro.medio_pago} onChange={e => setFormCobro({...formCobro, medio_pago: e.target.value})}>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Cuenta que recibe el cobro</label>
                  <select style={s.input} value={formCobro.cuenta_id} onChange={e => setFormCobro({...formCobro, cuenta_id: e.target.value})} required>
                    <option value="">Seleccionar cuenta</option>
                    {cuentas.map(ct => <option key={ct.id} value={ct.id}>{ct.banco} — {ct.tipo}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Referencia</label><input style={s.input} value={formCobro.referencia} onChange={e => setFormCobro({...formCobro, referencia: e.target.value})} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setCobrandoFactura(null)}>Cancelar</button>
                <button type="submit" style={s.btnPrimario(c.main)}>Confirmar cobro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VISTA CUENTAS POR PAGAR */}
      {vista === 'por-pagar' && (
        <div>
          <div style={{ ...s.card, background: '#fff7ed', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><TrendingDown size={18} color="#c2410c" /></div>
            <div>
              <p style={{ ...s.label, color: '#c2410c', margin: 0 }}>Días de pago (DPO)</p>
              <p style={{ fontSize: '19px', fontWeight: '800', color: '#c2410c', margin: 0 }}>
                {diasCobroPago.diasPago != null ? `${diasCobroPago.diasPago.toFixed(0)} días` : 'Sin pagos registrados aún'}
              </p>
              {diasCobroPago.diasPago != null && <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#ea580c' }}>Promedio real entre emisión y pago, sobre {diasCobroPago.muestraPago} pago(s) registrado(s)</p>}
            </div>
          </div>
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          {loading ? <div style={s.empty}>Cargando...</div>
          : facturasCompra.length === 0 ? <div style={s.empty}>No hay facturas de compra registradas</div>
          : (
            <table style={s.tabla}>
              <thead><tr>{['Proveedor','Nº factura','Categoría','Cliente imputado','Emisión','Vencimiento','Total','Saldo','Estado',''].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
              <tbody>
                {facturasCompra.map((f, i) => {
                  const ec = ESTADO_COLOR[f.estado] || ESTADO_COLOR.pendiente
                  const saldo = saldoPendiente(f)
                  return (
                    <tr key={f.id} style={s.tablaFila(i)}>
                      <td style={s.tablaCellBold}>{f.proveedores?.razon_social || '—'}</td>
                      <td style={{ ...s.tablaCell, fontSize: '12px', color: '#94a3b8' }}>{f.numero_factura || '—'}</td>
                      <td style={s.tablaCell}>{f.categoria}</td>
                      <td style={{ ...s.tablaCell, fontSize: '12px' }}>{f.clientes?.razon_social || f.clientes?.nombre_contacto || '—'}</td>
                      <td style={s.tablaCell}>{f.fecha_emision ? new Date(f.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
                      <td style={s.tablaCell}>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
                      <td style={s.tablaCell}>{Number(f.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                      <td style={{ ...s.tablaCellBold, color: saldo > 0 ? '#dc2626' : '#059669' }}>{saldo.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                      <td style={s.tablaCell}><span style={s.badge(ec.bg, ec.color)}>{f.estado}</span></td>
                      <td style={s.tablaCell}>
                        {f.estado !== 'pagada' && f.estado !== 'anulada' && (
                          <button style={{ ...s.btnPrimario(c.main), padding: '6px 12px', fontSize: '12px' }} onClick={() => abrirPago(f)}>Registrar pago</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        </div>
      )}

      {/* VISTA ESTADO DE CUENTA */}
      {vista === 'estado-cuenta' && (() => {
        const cuentaActivaId = cuentaEstadoId || cuentas[0]?.id || ''
        const estado = cuentaActivaId ? calcularEstadoCuenta(cuentaActivaId, rangoDesde, rangoHasta) : null
        const totalIng = estado ? estado.filas.filter(f=>f.tipo==='ingreso').reduce((a,f)=>a+Number(f.monto),0) : 0
        const totalEgr = estado ? estado.filas.filter(f=>f.tipo==='egreso').reduce((a,f)=>a+Number(f.monto),0) : 0
        return (
          <div>
            {cuentas.length === 0 ? <div style={s.empty}>Todavía no hay cuentas cargadas.</div> : (
              <>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '18px', flexWrap: 'wrap' }}>
                  <div>
                    <label style={s.label}>Cuenta</label>
                    <select style={s.input} value={cuentaActivaId} onChange={e => setCuentaEstadoId(e.target.value)}>
                      {cuentas.map(ct => <option key={ct.id} value={ct.id}>{ct.banco} — {ct.tipo}</option>)}
                    </select>
                  </div>
                  <div><label style={s.label}>Desde</label><input type="date" style={s.input} value={rangoDesde} onChange={e => setRangoDesde(e.target.value)} /></div>
                  <div><label style={s.label}>Hasta</label><input type="date" style={s.input} value={rangoHasta} onChange={e => setRangoHasta(e.target.value)} /></div>
                </div>

                {estado && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '18px' }}>
                      <div style={s.card}>
                        <p style={{ ...s.label, color: '#64748b' }}>Saldo al inicio del período</p>
                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{estado.saldoInicial.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
                      </div>
                      <div style={{ ...s.card, background: '#f0fdf4' }}>
                        <p style={{ ...s.label, color: '#059669' }}>Ingresos del período</p>
                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#059669', margin: 0 }}>{totalIng.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
                      </div>
                      <div style={{ ...s.card, background: '#fff1f2' }}>
                        <p style={{ ...s.label, color: '#dc2626' }}>Egresos del período</p>
                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626', margin: 0 }}>{totalEgr.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
                      </div>
                      <div style={{ ...s.card, background: c.main, border: 'none' }}>
                        <p style={{ ...s.label, color: 'rgba(255,255,255,0.85)' }}>Saldo al final del período</p>
                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>{estado.saldoFinal.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
                      </div>
                    </div>

                    <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                      {estado.filas.length === 0 ? <div style={s.empty}>Sin movimientos en este período.</div> : (
                        <table style={s.tabla}>
                          <thead><tr>{['Fecha','Descripción','Categoría','Ingreso','Egreso','Saldo'].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                          <tbody>
                            {estado.filas.map((f,i) => (
                              <tr key={f.id} style={s.tablaFila(i)}>
                                <td style={s.tablaCell}>{new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                <td style={s.tablaCell}>{f.descripcion || f.categoria || '—'}</td>
                                <td style={{ ...s.tablaCell, fontSize:'12px' }}>{f.categoria || '—'}</td>
                                <td style={{ ...s.tablaCell, color:'#059669', fontWeight:'600' }}>{f.tipo==='ingreso' ? Number(f.monto).toLocaleString('es-AR',{style:'currency',currency:'ARS'}) : ''}</td>
                                <td style={{ ...s.tablaCell, color:'#dc2626', fontWeight:'600' }}>{f.tipo==='egreso' ? Number(f.monto).toLocaleString('es-AR',{style:'currency',currency:'ARS'}) : ''}</td>
                                <td style={s.tablaCellBold}>{f.saldoCorrido.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )
      })()}

      {/* VISTA PROYECCIÓN DE CAJA */}
      {vista === 'proyeccion' && (
        <div>
          {!proyeccion ? <div style={s.empty}>Calculando…</div> : (
            <>
              <div style={{ ...s.card, background: '#eff6ff', marginBottom: '18px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#1d4ed8' }}>
                  Proyecta el saldo disponible sumando <strong>lo que hoy tenés en cuentas</strong> ({saldoTotal.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}) más lo que se espera cobrar, menos lo que se espera pagar, según la fecha de vencimiento de cada factura.
                  {proyeccion.costoFijoMensual > 0 && <> No incluye costos fijos recurrentes (alquiler, sueldos, etc.) — estos rondan <strong>{proyeccion.costoFijoMensual.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}/mes</strong> adicionales según lo cargado en Costos.</>}
                </p>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <p style={{ ...s.label, marginBottom: '10px' }}>Punto de partida — saldo actual por cuenta</p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(cuentas.length,1)}, 1fr)`, gap: '12px' }}>
                  {cuentas.map(ct => (
                    <div key={ct.id} style={{ ...s.card, margin: 0, padding: '12px 14px' }}>
                      <p style={{ ...s.label, color: '#64748b', margin: '0 0 4px' }}>{ct.banco} · {ct.tipo.replace('_',' ')}</p>
                      <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{Number(ct.saldo).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '11.5px', color: paleta.muted, marginTop: '8px' }}>
                  La proyección de abajo es a nivel consolidado: una factura pendiente todavía no tiene asignada una cuenta específica (eso se define recién al registrar el cobro o el pago), así que no es posible proyectar el saldo futuro cuenta por cuenta — sí el punto de partida de cada una.
                </p>
              </div>

              <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                <table style={s.tabla}>
                  <thead><tr>{['Período','Por cobrar','Por pagar','Neto del período','Saldo proyectado acumulado'].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(() => {
                      let acumulado = saldoTotal
                      return proyeccion.buckets.map((b, i) => {
                        const neto = b.cobrar - b.pagar
                        if (b.id !== 'sinfecha') acumulado += neto
                        return (
                          <tr key={b.id} style={s.tablaFila(i)}>
                            <td style={s.tablaCellBold}>{b.label}</td>
                            <td style={{ ...s.tablaCell, color: '#059669' }}>{b.cobrar.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</td>
                            <td style={{ ...s.tablaCell, color: '#dc2626' }}>{b.pagar.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</td>
                            <td style={{ ...s.tablaCellBold, color: neto >= 0 ? '#059669' : '#dc2626' }}>{neto >= 0 ? '+' : ''}{neto.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</td>
                            <td style={{ ...s.tablaCellBold, color: b.id === 'sinfecha' ? '#94a3b8' : (acumulado >= 0 ? paleta.ink : '#dc2626') }}>
                              {b.id === 'sinfecha' ? '—' : acumulado.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Finanzas
