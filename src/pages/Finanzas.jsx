import { registrarCobroConRetenciones, retencionesVacias, totalRetenciones, listaChequesVacia, totalCheques, validarCheques, crearChequesTercero, crearChequesPropios } from '../cobrosUtils.js'
import RetencionesCobro from './RetencionesCobro.jsx'
import DatosCheque from './DatosCheque.jsx'
import VistaRetenciones from './VistaRetenciones.jsx'
import Cheques from './Cheques.jsx'
import CuentaCorriente from './CuentaCorriente.jsx'
import { useEffect, useState, useRef } from 'react'
import { supabase, emitirCambioDatos, escucharCambiosDatos } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import {
  BarChart3, Pencil, Plus, Trash2, X, TrendingDown, TrendingUp, Wallet2, ArrowRightLeft,
  FileUp, AlertTriangle, Loader2, ShieldCheck, RefreshCw, Landmark, Banknote, Building2,
  SlidersHorizontal, Check, CheckCircle2, DollarSign, UploadCloud, FileSpreadsheet, Eye, Search
} from 'lucide-react'
import ImportarARCA from './ImportarARCA.jsx'
import ConciliacionBancaria from './ConciliacionBancaria.jsx'
import { esCuentaBancaria } from '../finanzasUtils.js'
import Compromisos from './Compromisos.jsx'
import Resultados from './Resultados.jsx'
import ResumenSemanal from './ResumenSemanal.jsx'
import RentabilidadClientes from './RentabilidadClientes.jsx'
import AsignacionPersonal from './AsignacionPersonal.jsx'
import HorariosServicio from './HorariosServicio.jsx'
import {
  construirItems, agruparPorTramos, agruparPorMes, totalEgresos as totalEgresosProy, isoLocal, NOMBRE_RUBRO, RUBROS_EGRESO,
} from '../proyeccionCaja.js'

const c = colores.finanzas

const CATEGORIAS = {
  ingreso: ['Cobranzas', 'Otro ingreso', 'Ajuste de saldo'],
  egreso: ['Insumos', 'Servicios', 'Haberes', 'Impuestos', 'Préstamos', 'Alquileres', 'Socios', 'Marketing', 'Otro egreso', 'Ajuste de saldo']
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

function Finanzas({ vistaInicial = 'movimientos' }) {
  const [vista, setVista] = useState(vistaInicial) // movimientos | por-cobrar | por-pagar | conciliacion | estado-cuenta | proyeccion
  const [movimientos, setMovimientos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [facturas, setFacturas] = useState([])
  const [facturasCobrarTodas, setFacturasCobrarTodas] = useState([])
  const [pagosVenta, setPagosVenta] = useState([])
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarCuenta, setMostrarCuenta] = useState(false)
  const [editando, setEditando] = useState(null)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'ingreso', categoria: '', descripcion: '',
    monto: '', cuenta_id: '', comprobante: '',
    forma_pago: 'Efectivo', factura_id: '', cliente_id: ''
  })
  const [formCuenta, setFormCuenta] = useState({ banco: '', tipo: 'caja_ahorro', numero: '', cbu: '', saldo: '0' })

  // ---- Actualización y edición de saldos de bancos y efectivo ----
  const [cuentaEditando, setCuentaEditando] = useState(null)
  const [formEditCuenta, setFormEditCuenta] = useState({
    banco: '', tipo: 'caja_ahorro', numero: '', cbu: '', saldoNuevo: '',
    registrarMovimiento: true, motivoAjuste: 'Ajuste manual de saldo / Arqueo'
  })
  const [modalAjusteSaldos, setModalAjusteSaldos] = useState(false)
  const [saldosRapidos, setSaldosRapidos] = useState({})
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)

  const [prevVistaInicial, setPrevVistaInicial] = useState(vistaInicial)
  if (vistaInicial !== prevVistaInicial) {
    setPrevVistaInicial(vistaInicial)
    setVista(vistaInicial)
  }

  // ---- Cuentas por pagar ----
  const [facturasCompra, setFacturasCompra] = useState([])
  const [pagosCompra, setPagosCompra] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [clientes, setClientes] = useState([])
  const [mostrarFormCompra, setMostrarFormCompra] = useState(false)
  const [mostrarImportarCompras, setMostrarImportarCompras] = useState(false)
  const [formCompra, setFormCompra] = useState({ proveedor_id: '', cliente_id: '', numero_factura: '', fecha_emision: new Date().toISOString().split('T')[0], fecha_vencimiento: '', categoria: 'Insumos', total: '', observaciones: '' })
  const [pagandoFactura, setPagandoFactura] = useState(null)
  const [datosCheque, setDatosCheque] = useState(listaChequesVacia())
  const [formPagoCompra, setFormPagoCompra] = useState({ monto: '', medio_pago: 'transferencia', cuenta_id: '', referencia: '', fecha_pago: new Date().toISOString().split('T')[0] })
  const [filtroPagar, setFiltroPagar] = useState('todas') // 'todas' | 'pendientes' | 'pagadas'
  const [busquedaPagar, setBusquedaPagar] = useState('')

  // ---- Cuentas por cobrar ----
  const [cobrandoFactura, setCobrandoFactura] = useState(null)
  const guardandoCobro = useRef(false)
  const guardandoPagoCompra = useRef(false)
  const [formCobro, setFormCobro] = useState({ monto: '', medio_pago: 'transferencia', cuenta_id: '', referencia: '', fecha_pago: new Date().toISOString().split('T')[0], retenciones: retencionesVacias(), certificado: '' })
  const [diasCobroPago, setDiasCobroPago] = useState({ diasCobro: null, diasPago: null })
  const [filtroCobrar, setFiltroCobrar] = useState('todas') // 'todas' | 'pendientes' | 'cobradas'
  const [busquedaCobrar, setBusquedaCobrar] = useState('')

  // ---- Indicador de flujo (cobrar/pagar) ----
  const [porCobrar, setPorCobrar] = useState(0)
  const [porPagar, setPorPagar] = useState(0)
  const [proyeccion, setProyeccion] = useState(null)
  const [vistaProy, setVistaProy] = useState('tramos') // tramos | meses
  const [incluirCostosMesActual, setIncluirCostosMesActual] = useState(true)

  // ---- Estado de cuenta ----
  const [cuentaEstadoId, setCuentaEstadoId] = useState('')
  const [rangoDesde, setRangoDesde] = useState(new Date().toISOString().slice(0,7) + '-01')
  const [rangoHasta, setRangoHasta] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    cargarDatos()

    // 1. Escuchar evento de datos global en memoria
    const desuscribir = escucharCambiosDatos(() => {
      cargarDatos()
    })

    // 2. Refrescar al re-enfocar la ventana
    const alEnfocar = () => {
      cargarDatos()
    }
    window.addEventListener('focus', alEnfocar)
    const alVisibilidad = () => {
      if (document.visibilityState === 'visible') cargarDatos()
    }
    document.addEventListener('visibilitychange', alVisibilidad)

    // 3. Heartbeat periódico para que las finanzas siempre estén actualizadas
    const timerSync = setInterval(() => {
      cargarDatos()
    }, 25000)

    // 4. Canal Realtime de Supabase
    let canalRealtime = null
    try {
      canalRealtime = supabase.channel('finanzas_auto_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos_financieros' }, () => cargarDatos())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => cargarDatos())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => cargarDatos())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas_bancarias' }, () => cargarDatos())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas_compra' }, () => cargarDatos())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos_compra' }, () => cargarDatos())
        .subscribe()
    } catch (e) {
      console.warn('Realtime notice in finanzas:', e)
    }

    return () => {
      desuscribir()
      window.removeEventListener('focus', alEnfocar)
      document.removeEventListener('visibilitychange', alVisibilidad)
      clearInterval(timerSync)
      if (canalRealtime) supabase.removeChannel(canalRealtime)
    }
  }, [])
  useEffect(() => { if (vista === 'proyeccion') cargarProyeccion() }, [vista])

  async function cargarProyeccion() {
    const [{ data: facturas }, { data: pagosVenta }, { data: facturasCompra }, { data: pagosCompra }, { data: compromisos }, { data: costosFijos }, { data: liquidaciones }] = await Promise.all([
      supabase.from('facturas').select('id,total,fecha_vencimiento').in('estado', ['emitida','pendiente','parcial','vencida']),
      supabase.from('pagos').select('factura_id,monto'),
      supabase.from('facturas_compra').select('id,total,fecha_vencimiento').neq('estado','pagada').neq('estado','anulada'),
      supabase.from('pagos_compra').select('factura_compra_id,monto'),
      supabase.from('compromisos_pago').select('tipo,monto,fecha_vencimiento,estado').eq('estado', 'pendiente'),
      supabase.from('costos_fijos').select('nombre,monto,frecuencia,mes').eq('activo', true),
      supabase.from('liquidaciones_sueldo').select('total_neto,estado,fecha_pago,periodo').eq('estado', 'pendiente'),
    ])
    setProyeccion({ facturas, pagosVenta, facturasCompra, pagosCompra, compromisos, costosFijos, liquidaciones })
  }

  async function cargarDatos() {
    setLoading(true)
    const [
      { data: movDataRaw }, { data: cuentasData }, { data: facturasData },
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

    let movData = movDataRaw || []
    const setFactVentaIds = new Set((factVentaTodas || []).map(f => f.id))
    const setFactVentaNums = new Set((factVentaTodas || []).map(f => f.numero_factura).filter(Boolean))

    // Detección automática y purga transparente de cobranzas huérfanas de facturas eliminadas
    const huerfanos = movData.filter(m => {
      if (m.tipo !== 'ingreso') return false
      const esCobranza = m.categoria === 'Cobranzas' || (m.descripcion && m.descripcion.toLowerCase().includes('cobro factura')) || m.factura_id
      if (!esCobranza) return false
      const tieneValida = (m.factura_id && setFactVentaIds.has(m.factura_id)) ||
        (setFactVentaNums.size > 0 && Array.from(setFactVentaNums).some(n => m.descripcion && m.descripcion.includes(n)))
      return !tieneValida
    })

    if (huerfanos.length > 0) {
      const idsHuerfanos = huerfanos.map(m => m.id)
      for (const h of huerfanos) {
        if (h.cuenta_id && h.monto) {
          await ajustarSaldo(h.cuenta_id, -Number(h.monto))
        }
      }
      for (let i = 0; i < idsHuerfanos.length; i += 50) {
        await supabase.from('movimientos_financieros').delete().in('id', idsHuerfanos.slice(i, i + 50))
      }
      if (setFactVentaIds.size === 0) {
        try {
          await supabase.from('pagos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        } catch (e) {
          console.warn('Pagos cleanup notice:', e)
        }
      }
      movData = movData.filter(m => !idsHuerfanos.includes(m.id))
      const { data: cuentasActualizadas } = await supabase.from('cuentas_bancarias').select('*').eq('activa', true)
      if (cuentasActualizadas) setCuentas(cuentasActualizadas)
    } else if (cuentasData) {
      setCuentas(cuentasData)
    }

    setMovimientos(movData)
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
      forma_pago: m.forma_pago || 'Efectivo', factura_id: m.factura_id || '', cliente_id: m.cliente_id || ''
    })
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false); setEditando(null)
    setForm({ fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', categoria: '', descripcion: '', monto: '', cuenta_id: '', comprobante: '', forma_pago: 'Efectivo', factura_id: '', cliente_id: '' })
  }

  async function guardarMovimiento(e) {
    e.preventDefault()
    const datos = { ...form, monto: parseFloat(form.monto), cuenta_id: form.cuenta_id || null, factura_id: form.factura_id || null, cliente_id: form.cliente_id || null }
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
    cancelar()
    await cargarDatos()
    emitirCambioDatos('finanzas')
  }

  async function eliminarMovimiento(m) {
    if (!confirm('¿Eliminar este movimiento?')) return
    if (m.cuenta_id) await ajustarSaldo(m.cuenta_id, -efectoEnSaldo(m.tipo, m.monto))
    await supabase.from('movimientos_financieros').delete().eq('id', m.id)
    await cargarDatos()
    emitirCambioDatos('finanzas')
  }

  async function guardarCuenta(e) {
    e.preventDefault()
    const saldoInit = parseFloat(formCuenta.saldo) || 0
    const { error } = await supabase.from('cuentas_bancarias').insert([{ ...formCuenta, saldo: saldoInit, activa: true }])
    if (error) { alert('Error: ' + error.message); return }
    setMostrarCuenta(false)
    setFormCuenta({ banco: '', tipo: 'caja_ahorro', numero: '', cbu: '', saldo: '0' })
    await cargarDatos()
    emitirCambioDatos('finanzas')
  }

  // ---------- Edición y ajuste de saldos de cuentas (Bancos y Efectivo) ----------
  function abrirEditarCuenta(ct) {
    setCuentaEditando(ct)
    setFormEditCuenta({
      banco: ct.banco || '',
      tipo: ct.tipo || 'caja_ahorro',
      numero: ct.numero || '',
      cbu: ct.cbu || '',
      saldoNuevo: String(Number(ct.saldo || 0)),
      registrarMovimiento: true,
      motivoAjuste: 'Ajuste manual de saldo / Arqueo'
    })
  }

  async function guardarEdicionCuenta(e) {
    e.preventDefault()
    if (!cuentaEditando) return
    const saldoNuevoNum = parseFloat(formEditCuenta.saldoNuevo)
    if (isNaN(saldoNuevoNum)) {
      alert('Ingresá un valor numérico válido para el saldo.')
      return
    }
    const saldoAnterior = Number(cuentaEditando.saldo || 0)
    const diff = saldoNuevoNum - saldoAnterior

    try {
      const { error: errCt } = await supabase.from('cuentas_bancarias').update({
        banco: formEditCuenta.banco.trim(),
        tipo: formEditCuenta.tipo,
        numero: formEditCuenta.numero?.trim() || null,
        cbu: formEditCuenta.cbu?.trim() || null,
        saldo: saldoNuevoNum
      }).eq('id', cuentaEditando.id)

      if (errCt) throw errCt

      // Si se solicitó registrar movimiento contable y hay diferencia real
      if (formEditCuenta.registrarMovimiento && Math.abs(diff) > 0.009) {
        const tipoMov = diff > 0 ? 'ingreso' : 'egreso'
        const montoMov = Math.abs(diff)
        await supabase.from('movimientos_financieros').insert([{
          fecha: new Date().toISOString().split('T')[0],
          tipo: tipoMov,
          categoria: 'Ajuste de saldo',
          descripcion: `${formEditCuenta.motivoAjuste || 'Ajuste de saldo'} (${formEditCuenta.banco}) — Diferencia: ${diff > 0 ? '+' : '-'}${montoMov.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`,
          monto: montoMov,
          cuenta_id: cuentaEditando.id,
          forma_pago: formEditCuenta.tipo === 'caja_chica' ? 'Efectivo' : 'Transferencia',
          comprobante: 'Ajuste manual'
        }])
      }

      setCuentaEditando(null)
      await cargarDatos()
      emitirCambioDatos('finanzas')
      alert(`Saldo de "${formEditCuenta.banco}" actualizado exitosamente a ${saldoNuevoNum.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}.`)
    } catch (err) {
      alert('Error al actualizar cuenta: ' + err.message)
    }
  }

  async function eliminarCuenta(ct) {
    if (!confirm(`¿Dar de baja la cuenta "${ct.banco}"? Los movimientos históricos se conservarán pero la cuenta no aparecerá activa.`)) return
    try {
      const { error } = await supabase.from('cuentas_bancarias').update({ activa: false }).eq('id', ct.id)
      if (error) throw error
      setCuentaEditando(null)
      await cargarDatos()
      emitirCambioDatos('finanzas')
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  function abrirAjusteTodosSaldos() {
    const mapa = {}
    cuentas.forEach(ct => {
      mapa[ct.id] = String(Number(ct.saldo || 0))
    })
    setSaldosRapidos(mapa)
    setModalAjusteSaldos(true)
  }

  async function guardarAjusteTodosSaldos(e) {
    e.preventDefault()
    setGuardandoAjuste(true)
    try {
      for (const ct of cuentas) {
        const nuevo = parseFloat(saldosRapidos[ct.id])
        if (!isNaN(nuevo) && nuevo !== Number(ct.saldo || 0)) {
          const diff = nuevo - Number(ct.saldo || 0)
          await supabase.from('cuentas_bancarias').update({ saldo: nuevo }).eq('id', ct.id)
          await supabase.from('movimientos_financieros').insert([{
            fecha: new Date().toISOString().split('T')[0],
            tipo: diff > 0 ? 'ingreso' : 'egreso',
            categoria: 'Ajuste de saldo',
            descripcion: `Ajuste masivo de saldo (${ct.banco}) — Diferencia: ${diff > 0 ? '+' : '-'}${Math.abs(diff).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`,
            monto: Math.abs(diff),
            cuenta_id: ct.id,
            forma_pago: ct.tipo === 'caja_chica' ? 'Efectivo' : 'Transferencia',
            comprobante: 'Ajuste masivo'
          }])
        }
      }
      setModalAjusteSaldos(false)
      await cargarDatos()
      emitirCambioDatos('finanzas')
      alert('Saldos de bancos y efectivo actualizados exitosamente.')
    } catch (err) {
      alert('Error al actualizar saldos: ' + err.message)
    } finally {
      setGuardandoAjuste(false)
    }
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
    await cargarDatos()
    emitirCambioDatos('finanzas')
  }

  function abrirPago(factura) {
    setPagandoFactura(factura); setDatosCheque(listaChequesVacia(factura.proveedores?.razon_social || ''))
    setFormPagoCompra({ monto: saldoPendiente(factura).toFixed(2), medio_pago: 'transferencia', cuenta_id: '', referencia: '', fecha_pago: new Date().toISOString().split('T')[0] })
  }

  async function registrarPagoCompra(e) {
    e.preventDefault()
    if (guardandoPagoCompra.current) return
    const monto = parseFloat(formPagoCompra.monto)
    if (!formPagoCompra.cuenta_id) { alert('Elegí de qué cuenta sale el pago'); return }
    const saldoCompra = saldoPendiente(pagandoFactura)
    if (monto > saldoCompra + 0.01 && !window.confirm(`El pago (${monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}) supera el saldo pendiente de la factura (${Math.max(0, saldoCompra).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}). ¿Registrarlo igual?`)) return
    const esChequeCompra = formPagoCompra.medio_pago === 'cheque'
    if (esChequeCompra) {
      const eCh = validarCheques(datosCheque, monto); if (eCh) { alert(eCh); return }
      guardandoPagoCompra.current = true
      try {
        await crearChequesPropios({ cheques: datosCheque, facturaCompra: pagandoFactura, cuenta_id: formPagoCompra.cuenta_id })
      } catch (err) { guardandoPagoCompra.current = false; alert('No se pudo cargar el cheque: ' + (err.message || err)); return }
      guardandoPagoCompra.current = false
      setPagandoFactura(null); setDatosCheque(listaChequesVacia())
      alert('Cheque(s) propio(s) cargado(s) como emitido. El pago se registra y sale de la cuenta cuando lo marques como debitado en Bancos y cheques > Cheques.')
      await cargarDatos(); emitirCambioDatos('finanzas')
      return
    }
    guardandoPagoCompra.current = true
    const fechaPagoCompra = formPagoCompra.fecha_pago || new Date().toISOString().split('T')[0]
    await supabase.from('pagos_compra').insert([{
      factura_compra_id: pagandoFactura.id, monto, fecha_pago: fechaPagoCompra,
      medio_pago: formPagoCompra.medio_pago, cuenta_id: formPagoCompra.cuenta_id, referencia: formPagoCompra.referencia
    }])
    await supabase.from('movimientos_financieros').insert([{
      fecha: fechaPagoCompra, tipo: 'egreso',
      categoria: pagandoFactura.categoria || 'Otro egreso',
      descripcion: `Pago factura ${pagandoFactura.numero_factura || 's/n'} — ${pagandoFactura.proveedores?.razon_social || ''}`,
      monto, cuenta_id: formPagoCompra.cuenta_id, comprobante: formPagoCompra.referencia,
      forma_pago: formPagoCompra.medio_pago.charAt(0).toUpperCase() + formPagoCompra.medio_pago.slice(1)
    }])
    await ajustarSaldo(formPagoCompra.cuenta_id, -monto)
    const totalPagado = pagosCompra.filter(p => p.factura_compra_id === pagandoFactura.id).reduce((a, p) => a + Number(p.monto), 0) + monto
    const nuevoEstado = totalPagado >= Number(pagandoFactura.total) ? 'pagada' : 'parcial'
    await supabase.from('facturas_compra').update({ estado: nuevoEstado }).eq('id', pagandoFactura.id)
    guardandoPagoCompra.current = false
    setPagandoFactura(null)
    await cargarDatos()
    emitirCambioDatos('finanzas')
  }

  // ---------- Cuentas por cobrar ----------
  function abrirCobro(factura) {
    setCobrandoFactura(factura)
    setDatosCheque(listaChequesVacia(factura.clientes?.razon_social || factura.clientes?.nombre_contacto || ''))
    setFormCobro({ monto: saldoPendienteVenta(factura).toFixed(2), medio_pago: 'transferencia', cuenta_id: '', referencia: '', fecha_pago: new Date().toISOString().split('T')[0], retenciones: retencionesVacias(), certificado: '' })
  }

  async function registrarCobro(e) {
    e.preventDefault()
    if (guardandoCobro.current) return
    const neto = parseFloat(formCobro.monto) || 0
    const totRet = totalRetenciones(formCobro.retenciones)
    if (neto <= 0 && totRet <= 0) { alert('Ingresá el importe recibido o alguna retención'); return }
    const esCheque = formCobro.medio_pago === 'cheque'
    if (esCheque && neto > 0) { const eCh = validarCheques(datosCheque, neto); if (eCh) { alert(eCh); return } }
    if (neto > 0 && !esCheque && !formCobro.cuenta_id) { alert('Elegí a qué cuenta entra el cobro'); return }
    const saldoFactura = saldoPendienteVenta(cobrandoFactura)
    if (neto + totRet > saldoFactura + 0.01 && !window.confirm(`El cobro (${(neto + totRet).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}) supera el saldo pendiente de la factura (${Math.max(0, saldoFactura).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}). ¿Registrarlo igual?`)) return
    guardandoCobro.current = true
    const fechaCobro = formCobro.fecha_pago || new Date().toISOString().split('T')[0]
    try {
      let imputado = 0
      if (esCheque && neto > 0) await crearChequesTercero({ cheques: datosCheque, factura: cobrandoFactura })
      if (!esCheque || totRet > 0) {
        const r = await registrarCobroConRetenciones({
          factura: cobrandoFactura, neto: esCheque ? 0 : neto, retenciones: formCobro.retenciones, certificado: formCobro.certificado,
          fecha: fechaCobro, medio_pago: formCobro.medio_pago, cuenta_id: formCobro.cuenta_id, referencia: formCobro.referencia,
          descripcion: `Cobro factura ${cobrandoFactura.numero_factura || 's/n'} — ${cobrandoFactura.clientes?.razon_social || cobrandoFactura.clientes?.nombre_contacto || ''}`,
          forma_pago: formCobro.medio_pago.charAt(0).toUpperCase() + formCobro.medio_pago.slice(1)
        })
        imputado = r.imputado
      }
      const totalCobrado = pagosVenta.filter(p => p.factura_id === cobrandoFactura.id).reduce((a, p) => a + Number(p.monto), 0) + imputado
      const nuevoEstado = totalCobrado >= Number(cobrandoFactura.total) - 0.01 ? 'cobrada' : 'parcial'
      await supabase.from('facturas').update({ estado: nuevoEstado }).eq('id', cobrandoFactura.id)
    } catch (err) {
      guardandoCobro.current = false
      alert('No se pudo registrar el cobro: ' + (err.message || err)); return
    }
    guardandoCobro.current = false
    setCobrandoFactura(null)
    if (esCheque && neto > 0) alert('Cheque(s) cargado(s) en cartera. La factura se cancela cuando lo deposites o cobres desde Bancos y cheques > Cheques.')
    await cargarDatos()
    emitirCambioDatos('finanzas')
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
          <p style={s.cabeceraSubtexto}>{movimientos.length} movimientos · {cuentas.length} cuentas activas · {facturasCompra.filter(f=>f.estado!=='pagada'&&f.estado!=='anulada').length} facturas de compra pendientes</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Botón Sincronizar en vivo */}
          <button
            type="button"
            style={{ ...s.btnPrimario('rgba(255,255,255,0.18)'), border: '1px solid rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={async () => {
              setSincronizando(true)
              await cargarDatos()
              setSincronizando(false)
            }}
            disabled={sincronizando}
            title="Sincronizar y actualizar datos de finanzas en vivo"
          >
            <RefreshCw size={13} className={sincronizando ? 'animate-spin' : ''} />
            <span>{sincronizando ? 'Sincronizando…' : 'Sincronizar'}</span>
          </button>

          {/* Botón Ajustar saldos */}
          <button
            type="button"
            style={{ ...s.btnPrimario('rgba(255,255,255,0.2)'), border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={abrirAjusteTodosSaldos}
            title="Actualizar y modificar saldos de bancos y efectivo"
          >
            <SlidersHorizontal size={13} />
            <span>Ajustar saldos</span>
          </button>

          {/* Botón + Cuenta */}
          <button
            style={{ ...s.btnPrimario('rgba(255,255,255,0.2)'), border: '1px solid rgba(255,255,255,0.4)' }}
            onClick={() => {
              setFormCuenta({ banco: '', tipo: 'cuenta_corriente', numero: '', cbu: '', saldo: '0' })
              setMostrarCuenta(true)
            }}
          >
            + Cuenta
          </button>

          {vista === 'movimientos' && (
            <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => { if (mostrarForm) { cancelar() } else { setMostrarForm(true) } }}>
              {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Movimiento</>}
            </button>
          )}
          {vista === 'por-pagar' && (
            <>
              <button
                style={{ ...s.btnPrimario('rgba(255,255,255,0.2)'), border: '1px solid rgba(255,255,255,0.35)' }}
                onClick={() => {
                  setMostrarImportarCompras(!mostrarImportarCompras)
                  setMostrarFormCompra(false)
                }}
              >
                <FileUp size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />
                {mostrarImportarCompras ? 'Ver facturas' : 'Importar ARCA Compras'}
              </button>
              <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => { setMostrarFormCompra(!mostrarFormCompra); setMostrarImportarCompras(false) }}>
                {mostrarFormCompra ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Factura manual</>}
              </button>
            </>
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
          <p style={{ ...s.label, color: '#64748b' }}>Saldo en cuentas (bancos + efectivo)</p>
          <p style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{saldoTotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
        </div>
      </div>

      {/* NAVEGACIÓN: secciones y, debajo, las vistas de la sección activa */}
      {(() => {
        const SECCIONES = [
          { id: 'resumen', label: 'Resumen', vistas: [['resultados', 'Estado de resultados y cash flow'], ['rentabilidad', 'Rentabilidad por cliente'], ['asignacion-personal', 'Personal por cliente'], ['horarios', 'Horarios de servicio'], ['resumen-semanal', 'Resumen semanal'], ['movimientos', 'Movimientos'], ['estado-cuenta', 'Estado de cuenta'], ['proyeccion', 'Proyección de caja']] },
          { id: 'cobrar-pagar', label: 'Cobrar y pagar', vistas: [['por-cobrar', 'Cuentas por cobrar'], ['por-pagar', 'Cuentas por pagar'], ['cuenta-corriente', 'Cuentas corrientes'], ['compromisos', 'Préstamos e impuestos'], ['retenciones', 'Retenciones']] },
          { id: 'bancos', label: 'Bancos y cheques', vistas: [['conciliacion', 'Conciliación bancaria'], ['cheques', 'Cheques']] }
        ]
        const seccionActiva = SECCIONES.find(sec => sec.vistas.some(([id]) => id === vista)) || SECCIONES[0]
        const irA = (id) => {
          if (id === 'conciliacion') {
            const ctActual = cuentas.find(ct => ct.id === cuentaSeleccionadaId)
            if (!ctActual || !esCuentaBancaria(ctActual)) {
              const primeraBanco = cuentas.find(esCuentaBancaria)
              setCuentaSeleccionadaId(primeraBanco?.id || '')
            }
          }
          setVista(id)
        }
        return (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {SECCIONES.map(sec => (
                <button key={sec.id} onClick={() => irA(sec.vistas[0][0])} style={sec.id === seccionActiva.id ? s.btnPrimario(c.main) : s.btnSecundario}>{sec.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', borderBottom: '1px solid #E2E8F0' }}>
              {seccionActiva.vistas.map(([id, label]) => {
                const activa = vista === id
                return (
                  <button key={id} onClick={() => irA(id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: '13px',
                    fontWeight: activa ? 700 : 500, color: activa ? c.main : '#64748B',
                    borderBottom: activa ? `2px solid ${c.main}` : '2px solid transparent', marginBottom: '-1px'
                  }}>{label}</button>
                )
              })}
            </div>
          </div>
        )
      })()}

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
                <label style={s.label}>Cliente (centro de costos)</label>
                <select style={s.input} value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})}>
                  <option value="">Sin asignar (general)</option>
                  {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>)}
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
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '420px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
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
                {formPagoCompra.medio_pago === 'cheque' && <DatosCheque propio cheques={datosCheque} onChange={arr => { setDatosCheque(arr); const t = totalCheques(arr); if (t > 0) setFormPagoCompra(f => ({ ...f, monto: t.toFixed(2) })) }} />}
                <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Fecha de pago</label><input type="date" style={s.input} value={formPagoCompra.fecha_pago || ''} max={new Date().toISOString().split('T')[0]} onChange={e => setFormPagoCompra({...formPagoCompra, fecha_pago: e.target.value})} required /></div>
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

      {/* MODAL CREAR NUEVA CUENTA / CAJA */}
      {mostrarCuenta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={18} color="#0369A1" />
                </div>
                <h4 style={{ margin: 0, fontWeight: '700', color: '#0F172A', fontSize: '16px' }}>Nueva cuenta / Caja</h4>
              </div>
              <button onClick={() => setMostrarCuenta(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            <form onSubmit={guardarCuenta}>
              <div style={s.grid2}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Nombre de la cuenta o banco</label>
                  <input
                    style={s.input}
                    value={formCuenta.banco}
                    onChange={e => setFormCuenta({...formCuenta, banco: e.target.value})}
                    placeholder="Ej. Banco Galicia, Caja Efectivo Central, Mercado Pago"
                    required
                  />
                </div>
                <div>
                  <label style={s.label}>Tipo de cuenta</label>
                  <select style={s.input} value={formCuenta.tipo} onChange={e => setFormCuenta({...formCuenta, tipo: e.target.value})}>
                    <option value="cuenta_corriente">Cuenta corriente</option>
                    <option value="caja_ahorro">Caja de ahorro</option>
                    <option value="caja_chica">Caja chica / Efectivo</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Saldo inicial ($)</label>
                  <input type="number" step="0.01" style={s.input} value={formCuenta.saldo} onChange={e => setFormCuenta({...formCuenta, saldo: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <label style={s.label}>Nº de cuenta / Alias</label>
                  <input style={s.input} value={formCuenta.numero} onChange={e => setFormCuenta({...formCuenta, numero: e.target.value})} placeholder="Opcional" />
                </div>
                <div>
                  <label style={s.label}>CBU / CVU</label>
                  <input style={s.input} value={formCuenta.cbu} onChange={e => setFormCuenta({...formCuenta, cbu: e.target.value})} placeholder="22 dígitos (opcional)" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setMostrarCuenta(false)}>Cancelar</button>
                <button type="submit" style={s.btnPrimario(c.main)}>Crear cuenta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR / MODIFICAR SALDO DE CUENTA (BANCO O EFECTIVO) */}
      {cuentaEditando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SlidersHorizontal size={18} color="#D97706" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: '700', color: '#0F172A', fontSize: '16px' }}>Modificar saldo y datos de cuenta</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{cuentaEditando.banco} · {cuentaEditando.tipo.replace('_', ' ')}</p>
                </div>
              </div>
              <button onClick={() => setCuentaEditando(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>

            <form onSubmit={guardarEdicionCuenta}>
              <div style={s.grid2}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Nombre de la cuenta o banco</label>
                  <input
                    style={s.input}
                    value={formEditCuenta.banco}
                    onChange={e => setFormEditCuenta({...formEditCuenta, banco: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label style={s.label}>Tipo de cuenta</label>
                  <select style={s.input} value={formEditCuenta.tipo} onChange={e => setFormEditCuenta({...formEditCuenta, tipo: e.target.value})}>
                    <option value="cuenta_corriente">Cuenta corriente</option>
                    <option value="caja_ahorro">Caja de ahorro</option>
                    <option value="caja_chica">Caja chica / Efectivo</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Nº de cuenta / Alias</label>
                  <input style={s.input} value={formEditCuenta.numero} onChange={e => setFormEditCuenta({...formEditCuenta, numero: e.target.value})} placeholder="Opcional" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>CBU / CVU</label>
                  <input style={s.input} value={formEditCuenta.cbu} onChange={e => setFormEditCuenta({...formEditCuenta, cbu: e.target.value})} placeholder="Opcional" />
                </div>

                {/* CAJA DE COMPARACIÓN DE SALDOS */}
                <div style={{ gridColumn: '1 / -1', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Saldo registrado actual:</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                      {Number(cuentaEditando.saldo || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </strong>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ ...s.label, color: '#0F172A', fontWeight: '700' }}>Nuevo saldo real ($):</label>
                    <input
                      type="number"
                      step="0.01"
                      style={{ ...s.input, fontSize: '16px', fontWeight: '700', color: '#0F766E', borderColor: '#0F766E' }}
                      value={formEditCuenta.saldoNuevo}
                      onChange={e => setFormEditCuenta({...formEditCuenta, saldoNuevo: e.target.value})}
                      required
                    />
                  </div>

                  {(() => {
                    const nuevo = parseFloat(formEditCuenta.saldoNuevo) || 0
                    const actual = Number(cuentaEditando.saldo || 0)
                    const diff = nuevo - actual
                    if (Math.abs(diff) < 0.01) return <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>El saldo no tiene cambios.</p>
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: diff > 0 ? '#15803D' : '#DC2626' }}>
                        <span>Diferencia calculada:</span>
                        <strong>{diff > 0 ? '+' : ''}{diff.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
                        <span style={{ fontSize: '11px', background: diff > 0 ? '#DCFCE7' : '#FEE2E2', padding: '2px 6px', borderRadius: '4px' }}>
                          {diff > 0 ? 'Aumento de saldo' : 'Disminución de saldo'}
                        </span>
                      </div>
                    )
                  })()}

                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={formEditCuenta.registrarMovimiento}
                        onChange={e => setFormEditCuenta({...formEditCuenta, registrarMovimiento: e.target.checked})}
                        style={{ marginTop: '3px' }}
                      />
                      <span>
                        <strong>Registrar movimiento de ajuste en finanzas:</strong> Guarda automáticamente un ingreso o egreso de conciliación para que el flujo de caja refleje este cambio.
                      </span>
                    </label>

                    {formEditCuenta.registrarMovimiento && (
                      <div style={{ marginTop: '8px' }}>
                        <input
                          style={{ ...s.input, fontSize: '12px' }}
                          value={formEditCuenta.motivoAjuste}
                          onChange={e => setFormEditCuenta({...formEditCuenta, motivoAjuste: e.target.value})}
                          placeholder="Motivo del ajuste (ej. Arqueo de caja, Ajuste según extracto)"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '22px' }}>
                <button
                  type="button"
                  onClick={() => eliminarCuenta(cuentaEditando)}
                  style={{ ...s.btnPeligro, padding: '7px 12px', fontSize: '12px' }}
                  title="Dar de baja esta cuenta"
                >
                  Dar de baja cuenta
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" style={s.btnSecundario} onClick={() => setCuentaEditando(null)}>Cancelar</button>
                  <button type="submit" style={s.btnPrimario(c.main)}>Guardar saldo y cambios</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTE RÁPIDO DE TODOS LOS SALDOS (BANCOS Y EFECTIVO) */}
      {modalAjusteSaldos && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid #E2E8F0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: 0, fontWeight: '700', color: '#0F172A', fontSize: '17px' }}>Ajustar saldos de bancos y efectivo</h4>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748B' }}>Actualizá simultáneamente los saldos reales de todas tus cuentas bancarias y cajas físicas.</p>
              </div>
              <button onClick={() => setModalAjusteSaldos(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>

            <form onSubmit={guardarAjusteTodosSaldos}>
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                <table style={{ ...s.tabla, margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={s.tablaCabecera(c.main)}>Cuenta / Caja</th>
                      <th style={s.tablaCabecera(c.main)}>Tipo</th>
                      <th style={{ ...s.tablaCabecera(c.main), textAlign: 'right' }}>Saldo actual</th>
                      <th style={{ ...s.tablaCabecera(c.main), width: '170px' }}>Nuevo saldo ($)</th>
                      <th style={{ ...s.tablaCabecera(c.main), textAlign: 'right' }}>Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentas.map((ct, i) => {
                      const actual = Number(ct.saldo || 0)
                      const nuevo = parseFloat(saldosRapidos[ct.id]) || 0
                      const diff = nuevo - actual
                      const esCaja = ct.tipo === 'caja_chica' || ct.banco?.toLowerCase().includes('efectivo') || ct.banco?.toLowerCase().includes('caja')
                      return (
                        <tr key={ct.id} style={s.tablaFila(i)}>
                          <td style={s.tablaCellBold}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              {esCaja ? <Banknote size={15} color="#059669" /> : <Building2 size={15} color="#0284C7" />}
                              <span>{ct.banco}</span>
                            </div>
                          </td>
                          <td style={s.tablaCell}>
                            <span style={{ fontSize: '11px', background: esCaja ? '#DCFCE7' : '#E0F2FE', color: esCaja ? '#15803D' : '#0369A1', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                              {esCaja ? 'Efectivo / Caja' : ct.tipo.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ ...s.tablaCell, textAlign: 'right', color: '#64748B' }}>
                            {actual.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                          </td>
                          <td style={s.tablaCell}>
                            <input
                              type="number"
                              step="0.01"
                              style={{ ...s.input, padding: '4px 8px', fontSize: '13px', textAlign: 'right', fontWeight: '600' }}
                              value={saldosRapidos[ct.id] ?? ''}
                              onChange={e => setSaldosRapidos({...saldosRapidos, [ct.id]: e.target.value})}
                              required
                            />
                          </td>
                          <td style={{ ...s.tablaCell, textAlign: 'right', fontWeight: '700', color: Math.abs(diff) < 0.01 ? '#94A3B8' : (diff > 0 ? '#15803D' : '#DC2626') }}>
                            {Math.abs(diff) < 0.01 ? '—' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#F1F5F9', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '12px', color: '#475569' }}>
                💡 <em>Al confirmar, los saldos se actualizarán en el sistema y se generarán los asientos de ajuste contable necesarios para conciliar el historial.</em>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setModalAjusteSaldos(false)}>Cancelar</button>
                <button type="submit" style={s.btnPrimario(c.main)} disabled={guardandoAjuste}>
                  {guardandoAjuste ? 'Guardando…' : 'Actualizar todos los saldos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECCIÓN DE CUENTAS BANCARIAS Y EFECTIVO */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Landmark size={15} color="#0F766E" />
              <span>Saldos de Bancos y Efectivo</span>
              <span style={{ fontSize: '11px', background: '#F1F5F9', color: '#64748B', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                {cuentas.length} {cuentas.length === 1 ? 'cuenta' : 'cuentas'}
              </span>
            </h4>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setFormCuenta({ banco: 'Caja Efectivo', tipo: 'caja_chica', numero: 'Caja 1', cbu: '', saldo: '0' })
                setMostrarCuenta(true)
              }}
              style={{ ...s.btnSecundario, padding: '5px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Crear cuenta para control de efectivo físico / caja chica"
            >
              <Banknote size={13} color="#059669" />
              <span>+ Caja Efectivo</span>
            </button>
            <button
              onClick={abrirAjusteTodosSaldos}
              style={{ ...s.btnSecundario, padding: '5px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Modificar o ajustar saldos de todas las cuentas"
            >
              <SlidersHorizontal size={13} color="#0F766E" />
              <span>Ajustar saldos</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {cuentas.map(ct => {
            const esCaja = ct.tipo === 'caja_chica' || ct.banco?.toLowerCase().includes('efectivo') || ct.banco?.toLowerCase().includes('caja')
            return (
              <div key={ct.id} style={{ ...s.card, margin: 0, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #E2E8F0', position: 'relative' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: esCaja ? '#DCFCE7' : '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {esCaja ? <Banknote size={17} color="#15803D" /> : <Building2 size={17} color="#0369A1" />}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{ct.banco}</p>
                        <span style={{ fontSize: '10.5px', fontWeight: '600', color: esCaja ? '#15803D' : '#0369A1', textTransform: 'uppercase' }}>
                          {esCaja ? 'Efectivo / Caja' : ct.tipo.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => abrirEditarCuenta(ct)}
                      style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600' }}
                      title="Modificar cuenta o ajustar saldo"
                    >
                      <Pencil size={11} />
                      <span>Modificar</span>
                    </button>
                  </div>

                  {ct.numero && (
                    <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#94A3B8' }}>Nº / Alias: {ct.numero}</p>
                  )}

                  <div style={{ marginTop: '10px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Saldo disponible:</p>
                    <p style={{ fontSize: '20px', fontWeight: '800', color: Number(ct.saldo) >= 0 ? '#0F172A' : '#DC2626', margin: '2px 0 0' }}>
                      {Number(ct.saldo).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    onClick={() => abrirEditarCuenta(ct)}
                    style={{ flex: 1, background: '#F1F5F9', border: 'none', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', fontWeight: '600', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  >
                    <SlidersHorizontal size={12} color="#0F766E" />
                    <span>Ajustar saldo</span>
                  </button>
                  {esCuentaBancaria(ct) ? (
                    <button
                      onClick={() => {
                        setCuentaSeleccionadaId(ct.id)
                        setVista('conciliacion')
                      }}
                      style={{ flex: 1, background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', fontWeight: '600', color: '#0F766E', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                      title="Cargar extracto bancario y conciliar movimientos"
                    >
                      <ShieldCheck size={12} color="#0F766E" />
                      <span>Conciliar</span>
                    </button>
                  ) : (
                    <div
                      style={{ flex: 1, background: '#F8FAFC', border: '1px dashed #E2E8F0', borderRadius: '6px', padding: '6px 8px', fontSize: '11px', fontWeight: '500', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      title="Las cuentas de efectivo y cajas físicas se controlan por arqueo / ajuste manual, no por conciliación bancaria"
                    >
                      <span>Caja física</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* VISTA CONCILIACIÓN BANCARIA */}
      {vista === 'conciliacion' && (
        <div style={{ marginBottom: '24px' }}>
          <ConciliacionBancaria
            cuentas={cuentas}
            movimientos={movimientos}
            facturasCompra={facturasCompra}
            facturasVenta={facturasCobrarTodas}
            pagosCompra={pagosCompra}
            pagosVenta={pagosVenta}
            proveedores={proveedores}
            clientes={clientes}
            onActualizarDatos={async () => {
              await cargarDatos()
              emitirCambioDatos('conciliacion')
            }}
            cuentaInicialId={cuentaSeleccionadaId}
          />
        </div>
      )}

      {/* VISTA MOVIMIENTOS */}
      {vista === 'movimientos' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input type="month" style={{ ...s.buscador, maxWidth: '200px' }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
            <span style={{ color: '#64748b', fontSize: '13px' }}>{movMes.length} movimientos este mes</span>
          </div>
          <div style={{ ...s.card, padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
            {loading ? <div style={s.empty}>Cargando...</div>
            : movMes.length === 0 ? <div style={s.empty}>No hay movimientos este mes</div>
            : (
              <table style={{ ...s.tabla, minWidth: '880px', width: '100%' }}>
                <thead>
                  <tr>
                    {['Fecha','Tipo','Categoría','Descripción','Cliente','Cuenta','Forma de pago','Comprobante'].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}
                    <th style={{ ...s.tablaCabecera(c.main), textAlign: 'right', whiteSpace: 'nowrap' }}>Monto</th>
                    <th style={{
                      ...s.tablaCabecera(c.main),
                      position: 'sticky',
                      right: 0,
                      zIndex: 3,
                      textAlign: 'center',
                      minWidth: '100px',
                      boxShadow: '-4px 0 8px rgba(0,0,0,0.08)'
                    }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movMes.map((m, i) => (
                    <tr key={m.id} style={s.tablaFila(i)}>
                      <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                      <td style={s.tablaCell}><span style={s.badge(m.tipo === 'ingreso' ? '#d1fae5' : '#fee2e2', m.tipo === 'ingreso' ? '#059669' : '#dc2626')}>{m.tipo}</span></td>
                      <td style={s.tablaCell}>{m.categoria || '—'}</td>
                      <td style={s.tablaCell}>{m.descripcion || '—'}</td>
                      <td style={{ ...s.tablaCell, fontSize: '12px' }}>{(() => { const cl = clientes.find(x => x.id === m.cliente_id); return cl ? (cl.razon_social || cl.nombre_contacto) : '—' })()}</td>
                      <td style={{ ...s.tablaCell, fontSize: '12px' }}>{cuentas.find(ct => ct.id === m.cuenta_id)?.banco || '—'}</td>
                      <td style={s.tablaCell}>{m.forma_pago || '—'}</td>
                      <td style={{ ...s.tablaCell, fontSize: '12px', color: '#94a3b8' }}>{m.comprobante || '—'}</td>
                      <td style={{ ...s.tablaCellBold, textAlign: 'right', whiteSpace: 'nowrap', color: m.tipo === 'ingreso' ? '#059669' : '#dc2626' }}>{m.tipo === 'ingreso' ? '+' : '-'}{Number(m.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                      <td style={{
                        ...s.tablaCell,
                        position: 'sticky',
                        right: 0,
                        background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                        zIndex: 2,
                        textAlign: 'center',
                        minWidth: '100px',
                        boxShadow: '-4px 0 8px rgba(0,0,0,0.05)',
                        whiteSpace: 'nowrap'
                      }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button style={{ ...s.btnPrimario(c.main), padding: '5px 10px', fontSize: '12px' }} onClick={() => abrirEdicion(m)} title="Editar"><Pencil size={14} /></button>
                          <button style={s.btnPeligro} onClick={() => eliminarMovimiento(m)} title="Eliminar"><Trash2 size={14} /></button>
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

          {/* Barra de búsqueda y filtros para cuentas por cobrar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar cliente o Nº factura..."
                  value={busquedaCobrar}
                  onChange={e => setBusquedaCobrar(e.target.value)}
                  style={{ ...s.buscador, paddingLeft: '32px', minWidth: '240px' }}
                />
              </div>
              <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setFiltroCobrar('todas')}
                  style={{
                    background: filtroCobrar === 'todas' ? '#FFFFFF' : 'transparent',
                    color: filtroCobrar === 'todas' ? '#0F172A' : '#64748B',
                    fontWeight: filtroCobrar === 'todas' ? '700' : '500',
                    border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer',
                    boxShadow: filtroCobrar === 'todas' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Todas ({facturasCobrarTodas.filter(f => f.estado !== 'anulada').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroCobrar('pendientes')}
                  style={{
                    background: filtroCobrar === 'pendientes' ? '#FFFFFF' : 'transparent',
                    color: filtroCobrar === 'pendientes' ? '#1D4ED8' : '#64748B',
                    fontWeight: filtroCobrar === 'pendientes' ? '700' : '500',
                    border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer',
                    boxShadow: filtroCobrar === 'pendientes' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Pendientes ({facturasCobrarTodas.filter(f => !['pagada','cobrada','anulada'].includes(f.estado)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroCobrar('cobradas')}
                  style={{
                    background: filtroCobrar === 'cobradas' ? '#FFFFFF' : 'transparent',
                    color: filtroCobrar === 'cobradas' ? '#059669' : '#64748B',
                    fontWeight: filtroCobrar === 'cobradas' ? '700' : '500',
                    border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer',
                    boxShadow: filtroCobrar === 'cobradas' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Cobradas ({facturasCobrarTodas.filter(f => ['pagada','cobrada'].includes(f.estado)).length})
                </button>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#0F766E' }}></span>
              <span>Columna <strong>Acción (Registrar cobro)</strong> fija a la derecha</span>
            </div>
          </div>

          <div style={{ ...s.card, padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
            {loading ? <div style={s.empty}>Cargando...</div>
            : (() => {
                const facturasCobrarFiltradas = facturasCobrarTodas.filter(f => {
                  if (f.estado === 'anulada') return false
                  if (filtroCobrar === 'pendientes' && ['pagada','cobrada'].includes(f.estado)) return false
                  if (filtroCobrar === 'cobradas' && !['pagada','cobrada'].includes(f.estado)) return false
                  if (busquedaCobrar.trim()) {
                    const q = busquedaCobrar.toLowerCase()
                    const cli = (f.clientes?.razon_social || f.clientes?.nombre_contacto || '').toLowerCase()
                    const num = (f.numero_factura || '').toLowerCase()
                    return cli.includes(q) || num.includes(q)
                  }
                  return true
                })
                if (facturasCobrarFiltradas.length === 0) {
                  return (
                    <div style={s.empty}>
                      {busquedaCobrar || filtroCobrar !== 'todas'
                        ? 'No se encontraron facturas con los filtros seleccionados'
                        : 'No hay facturas registradas'}
                    </div>
                  )
                }
                return (
                  <table style={{ ...s.tabla, minWidth: '980px', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={s.tablaCabecera(c.main)}>Cliente</th>
                        <th style={{ ...s.tablaCabecera(c.main), width: '110px' }}>Nº factura</th>
                        <th style={{ ...s.tablaCabecera(c.main), whiteSpace: 'nowrap' }}>Emisión</th>
                        <th style={{ ...s.tablaCabecera(c.main), whiteSpace: 'nowrap' }}>Vencimiento</th>
                        <th style={{ ...s.tablaCabecera(c.main), textAlign: 'right', whiteSpace: 'nowrap' }}>Total</th>
                        <th style={{ ...s.tablaCabecera(c.main), textAlign: 'right', whiteSpace: 'nowrap' }}>Saldo</th>
                        <th style={{ ...s.tablaCabecera(c.main), textAlign: 'center', whiteSpace: 'nowrap' }}>Estado</th>
                        <th style={{
                          ...s.tablaCabecera(c.main),
                          position: 'sticky',
                          right: 0,
                          zIndex: 3,
                          textAlign: 'center',
                          minWidth: '150px',
                          boxShadow: '-4px 0 8px rgba(0,0,0,0.08)'
                        }}>
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturasCobrarFiltradas.map((f, i) => {
                        const ec = ESTADO_COLOR[f.estado] || ESTADO_COLOR.pendiente
                        const saldo = saldoPendienteVenta(f)
                        const puedeCobrar = !['pagada','cobrada','anulada'].includes(f.estado)
                        const bgColor = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
                        return (
                          <tr key={f.id} style={s.tablaFila(i)}>
                            <td style={s.tablaCellBold}>{f.clientes?.razon_social || f.clientes?.nombre_contacto || '—'}</td>
                            <td style={{ ...s.tablaCell, fontSize: '12px', color: '#64748B', fontFamily: paleta.fontMono, whiteSpace: 'nowrap' }}>{f.numero_factura || '—'}</td>
                            <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>{f.fecha_emision ? new Date(f.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
                            <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
                            <td style={{ ...s.tablaCell, textAlign: 'right', whiteSpace: 'nowrap' }}>{Number(f.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                            <td style={{ ...s.tablaCellBold, textAlign: 'right', whiteSpace: 'nowrap', color: saldo > 0 ? '#dc2626' : '#059669' }}>{saldo.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                            <td style={{ ...s.tablaCell, textAlign: 'center', whiteSpace: 'nowrap' }}><span style={s.badge(ec.bg, ec.color)}>{f.estado}</span></td>
                            <td style={{
                              ...s.tablaCell,
                              position: 'sticky',
                              right: 0,
                              background: bgColor,
                              zIndex: 2,
                              textAlign: 'center',
                              minWidth: '150px',
                              boxShadow: '-4px 0 8px rgba(0,0,0,0.05)',
                              whiteSpace: 'nowrap'
                            }}>
                              {puedeCobrar ? (
                                <button
                                  style={{
                                    ...s.btnPrimario(c.main),
                                    padding: '6px 14px',
                                    fontSize: '12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => abrirCobro(f)}
                                  title={`Registrar cobro de factura ${f.numero_factura || 's/n'}`}
                                >
                                  <DollarSign size={13} />
                                  <span>Registrar cobro</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Check size={13} />
                                  <span>Cobrada</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              })()}
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR COBRO */}
      {cobrandoFactura && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '12px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '420px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>Registrar cobro</h4>
              <button onClick={() => setCobrandoFactura(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#64748b' }}>
              {cobrandoFactura.numero_factura || 's/n'} — {cobrandoFactura.clientes?.razon_social || cobrandoFactura.clientes?.nombre_contacto || 'Sin cliente'} · Saldo pendiente: <strong>{saldoPendienteVenta(cobrandoFactura).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
            </p>
            <form onSubmit={registrarCobro}>
              <div style={s.grid2}>
                <div><label style={s.label}>Importe recibido en cuenta ($)</label><input type="number" step="0.01" style={s.input} value={formCobro.monto} onChange={e => setFormCobro({...formCobro, monto: e.target.value})} /></div>
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
                  <label style={s.label}>{formCobro.medio_pago === 'cheque' ? 'Cuenta (opcional: se elige al depositar)' : 'Cuenta que recibe el cobro'}</label>
                  <select style={s.input} value={formCobro.cuenta_id} onChange={e => setFormCobro({...formCobro, cuenta_id: e.target.value})}>
                    <option value="">Seleccionar cuenta</option>
                    {cuentas.map(ct => <option key={ct.id} value={ct.id}>{ct.banco} — {ct.tipo}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Fecha de cobro</label><input type="date" style={s.input} value={formCobro.fecha_pago || ''} max={new Date().toISOString().split('T')[0]} onChange={e => setFormCobro({...formCobro, fecha_pago: e.target.value})} required /></div>
                {formCobro.medio_pago === 'cheque' && <DatosCheque cheques={datosCheque} onChange={arr => { setDatosCheque(arr); const t = totalCheques(arr); if (t > 0) setFormCobro(f => ({ ...f, monto: t.toFixed(2) })) }} />}
                <RetencionesCobro retenciones={formCobro.retenciones} certificado={formCobro.certificado} neto={formCobro.monto}
                  saldo={saldoPendienteVenta(cobrandoFactura)}
                  onChange={r => setFormCobro({ ...formCobro, retenciones: r })} onCertificado={v => setFormCobro({ ...formCobro, certificado: v })} />
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
          {mostrarImportarCompras ? (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontWeight: '700', color: paleta.ink, fontSize: '15px' }}>
                  Importación de Compras desde ARCA (Comprobantes Recibidos)
                </h4>
                <button
                  style={s.btnSecundario}
                  onClick={() => setMostrarImportarCompras(false)}
                >
                  <X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />
                  Volver al listado de facturas
                </button>
              </div>
              <ImportarARCA
                tipoInicial="compras"
                onImportado={() => {
                  cargarDatos()
                }}
              />
            </div>
          ) : (
            <>
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
              {/* Barra de búsqueda y filtros para cuentas por pagar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      placeholder="Buscar proveedor o Nº factura..."
                      value={busquedaPagar}
                      onChange={e => setBusquedaPagar(e.target.value)}
                      style={{ ...s.buscador, paddingLeft: '32px', minWidth: '240px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setFiltroPagar('todas')}
                      style={{
                        background: filtroPagar === 'todas' ? '#FFFFFF' : 'transparent',
                        color: filtroPagar === 'todas' ? '#0F172A' : '#64748B',
                        fontWeight: filtroPagar === 'todas' ? '700' : '500',
                        border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer',
                        boxShadow: filtroPagar === 'todas' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      Todas ({facturasCompra.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroPagar('pendientes')}
                      style={{
                        background: filtroPagar === 'pendientes' ? '#FFFFFF' : 'transparent',
                        color: filtroPagar === 'pendientes' ? '#C2410C' : '#64748B',
                        fontWeight: filtroPagar === 'pendientes' ? '700' : '500',
                        border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer',
                        boxShadow: filtroPagar === 'pendientes' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      Pendientes ({facturasCompra.filter(f => f.estado !== 'pagada' && f.estado !== 'anulada').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroPagar('pagadas')}
                      style={{
                        background: filtroPagar === 'pagadas' ? '#FFFFFF' : 'transparent',
                        color: filtroPagar === 'pagadas' ? '#059669' : '#64748B',
                        fontWeight: filtroPagar === 'pagadas' ? '700' : '500',
                        border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer',
                        boxShadow: filtroPagar === 'pagadas' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      Pagadas ({facturasCompra.filter(f => f.estado === 'pagada').length})
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#0F766E' }}></span>
                  <span>Columna <strong>Acción (Registrar pago)</strong> anclada a la derecha</span>
                </div>
              </div>

              <div style={{ ...s.card, padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                {loading ? <div style={s.empty}>Cargando...</div>
                : (() => {
                    const facturasCompraFiltradas = facturasCompra.filter(f => {
                      if (filtroPagar === 'pendientes' && (f.estado === 'pagada' || f.estado === 'anulada')) return false
                      if (filtroPagar === 'pagadas' && f.estado !== 'pagada') return false
                      if (busquedaPagar.trim()) {
                        const q = busquedaPagar.toLowerCase()
                        const prov = (f.proveedores?.razon_social || '').toLowerCase()
                        const num = (f.numero_factura || '').toLowerCase()
                        const cat = (f.categoria || '').toLowerCase()
                        return prov.includes(q) || num.includes(q) || cat.includes(q)
                      }
                      return true
                    })
                    if (facturasCompraFiltradas.length === 0) {
                      return (
                        <div style={s.empty}>
                          {busquedaPagar || filtroPagar !== 'todas'
                            ? 'No se encontraron facturas con los filtros seleccionados'
                            : 'No hay facturas de compra registradas'}
                        </div>
                      )
                    }
                    return (
                      <table style={{ ...s.tabla, minWidth: '1050px', width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={s.tablaCabecera(c.main)}>Proveedor</th>
                            <th style={{ ...s.tablaCabecera(c.main), width: '110px' }}>Nº factura</th>
                            <th style={s.tablaCabecera(c.main)}>Categoría</th>
                            <th style={s.tablaCabecera(c.main)}>Cliente imputado</th>
                            <th style={{ ...s.tablaCabecera(c.main), whiteSpace: 'nowrap' }}>Emisión</th>
                            <th style={{ ...s.tablaCabecera(c.main), whiteSpace: 'nowrap' }}>Vencimiento</th>
                            <th style={{ ...s.tablaCabecera(c.main), textAlign: 'right', whiteSpace: 'nowrap' }}>Total</th>
                            <th style={{ ...s.tablaCabecera(c.main), textAlign: 'right', whiteSpace: 'nowrap' }}>Saldo</th>
                            <th style={{ ...s.tablaCabecera(c.main), textAlign: 'center', whiteSpace: 'nowrap' }}>Estado</th>
                            <th style={{
                              ...s.tablaCabecera(c.main),
                              position: 'sticky',
                              right: 0,
                              zIndex: 3,
                              textAlign: 'center',
                              minWidth: '150px',
                              boxShadow: '-4px 0 8px rgba(0,0,0,0.08)'
                            }}>
                              Acción
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {facturasCompraFiltradas.map((f, i) => {
                            const ec = ESTADO_COLOR[f.estado] || ESTADO_COLOR.pendiente
                            const saldo = saldoPendiente(f)
                            const bgColor = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
                            return (
                              <tr key={f.id} style={s.tablaFila(i)}>
                                <td style={s.tablaCellBold}>{f.proveedores?.razon_social || '—'}</td>
                                <td style={{ ...s.tablaCell, fontSize: '12px', color: '#64748B', fontFamily: paleta.fontMono, whiteSpace: 'nowrap' }}>{f.numero_factura || '—'}</td>
                                <td style={s.tablaCell}>{f.categoria}</td>
                                <td style={{ ...s.tablaCell, fontSize: '12px' }}>{f.clientes?.razon_social || f.clientes?.nombre_contacto || '—'}</td>
                                <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>{f.fecha_emision ? new Date(f.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
                                <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
                                <td style={{ ...s.tablaCell, textAlign: 'right', whiteSpace: 'nowrap' }}>{Number(f.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                                <td style={{ ...s.tablaCellBold, textAlign: 'right', whiteSpace: 'nowrap', color: saldo > 0 ? '#dc2626' : '#059669' }}>{saldo.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                                <td style={{ ...s.tablaCell, textAlign: 'center', whiteSpace: 'nowrap' }}><span style={s.badge(ec.bg, ec.color)}>{f.estado}</span></td>
                                <td style={{
                                  ...s.tablaCell,
                                  position: 'sticky',
                                  right: 0,
                                  background: bgColor,
                                  zIndex: 2,
                                  textAlign: 'center',
                                  minWidth: '150px',
                                  boxShadow: '-4px 0 8px rgba(0,0,0,0.05)',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {f.estado !== 'pagada' && f.estado !== 'anulada' ? (
                                    <button
                                      style={{
                                        ...s.btnPrimario(c.main),
                                        padding: '6px 14px',
                                        fontSize: '12px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}
                                      onClick={() => abrirPago(f)}
                                      title={`Registrar pago a ${f.proveedores?.razon_social || 'proveedor'}`}
                                    >
                                      <DollarSign size={13} />
                                      <span>Registrar pago</span>
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <Check size={13} />
                                      <span>Pagada</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )
                  })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* VISTA ESTADO DE CUENTA */}
      {vista === 'resultados' && <Resultados />}
      {vista === 'resumen-semanal' && <ResumenSemanal />}
      {vista === 'rentabilidad' && <RentabilidadClientes />}
      {vista === 'asignacion-personal' && <AsignacionPersonal />}
      {vista === 'horarios' && <HorariosServicio />}
      {vista === 'cheques' && <Cheques />}
      {vista === 'cuenta-corriente' && <CuentaCorriente />}
      {vista === 'retenciones' && <VistaRetenciones />}

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

                    <div style={{ ...s.card, padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                      {estado.filas.length === 0 ? <div style={s.empty}>Sin movimientos en este período.</div> : (
                        <table style={{ ...s.tabla, minWidth: '700px', width: '100%' }}>
                          <thead><tr>{['Fecha','Descripción','Categoría','Ingreso','Egreso','Saldo'].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                          <tbody>
                            {estado.filas.map((f,i) => (
                              <tr key={f.id} style={s.tablaFila(i)}>
                                <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>{new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                <td style={s.tablaCell}>{f.descripcion || f.categoria || '—'}</td>
                                <td style={{ ...s.tablaCell, fontSize:'12px' }}>{f.categoria || '—'}</td>
                                <td style={{ ...s.tablaCell, color:'#059669', fontWeight:'600', whiteSpace: 'nowrap' }}>{f.tipo==='ingreso' ? Number(f.monto).toLocaleString('es-AR',{style:'currency',currency:'ARS'}) : ''}</td>
                                <td style={{ ...s.tablaCell, color:'#dc2626', fontWeight:'600', whiteSpace: 'nowrap' }}>{f.tipo==='egreso' ? Number(f.monto).toLocaleString('es-AR',{style:'currency',currency:'ARS'}) : ''}</td>
                                <td style={{ ...s.tablaCellBold, whiteSpace: 'nowrap' }}>{f.saldoCorrido.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</td>
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

      {/* VISTA PRÉSTAMOS E IMPUESTOS */}
      {vista === 'compromisos' && (
        <Compromisos
          cuentas={cuentas}
          onCambio={async () => { await cargarDatos(); setProyeccion(null); emitirCambioDatos('finanzas') }}
        />
      )}

      {/* VISTA PROYECCIÓN DE CAJA */}
      {vista === 'proyeccion' && (
        <div>
          {!proyeccion ? <div style={s.empty}>Calculando…</div> : (() => {
            const hoyISO = isoLocal(new Date())
            const items = construirItems({ ...proyeccion, hoyISO, meses: 12, incluirCostosMesActual })
            const filas = vistaProy === 'meses' ? agruparPorMes(items, hoyISO, 12) : agruparPorTramos(items, hoyISO)
            const moneda = n => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
            const colorRubro = { cobrar: '#059669', facturas: '#dc2626', prestamos: '#4338ca', impuestos: '#7c3aed', costosFijos: '#b45309', sueldos: '#0369a1' }
            const columnas = ['cobrar', ...RUBROS_EGRESO]
            const totales = Object.fromEntries(columnas.map(r => [r, filas.reduce((a, f) => a + f[r], 0)]))
            const totalEgr = filas.reduce((a, f) => a + totalEgresosProy(f), 0)
            let acumulado = saldoTotal
            return (
              <>
                <div style={{ ...s.card, background: '#eff6ff', marginBottom: '18px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#1d4ed8' }}>
                    Parte de <strong>lo que hoy tenés en cuentas</strong> ({moneda(saldoTotal)}) y suma lo que se espera cobrar, menos <strong>todos los egresos</strong> según su vencimiento: facturas de proveedores, cuotas de préstamos, impuestos y otros egresos (se cargan en <em>Préstamos e impuestos</em>), costos fijos (se repiten cada mes desde el último importe cargado en Costos) y sueldos pendientes de pago.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <button onClick={() => setVistaProy('tramos')} style={vistaProy === 'tramos' ? s.btnPrimario(c.main) : s.btnSecundario}>Por tramos de días</button>
                  <button onClick={() => setVistaProy('meses')} style={vistaProy === 'meses' ? s.btnPrimario(c.main) : s.btnSecundario}>Por mes (12 meses)</button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: paleta.inkSoft, marginLeft: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={incluirCostosMesActual} onChange={e => setIncluirCostosMesActual(e.target.checked)} />
                    Incluir costos fijos del mes en curso (desmarcar si ya los pagaste)
                  </label>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <p style={{ ...s.label, marginBottom: '10px' }}>Punto de partida — saldo actual por cuenta</p>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(cuentas.length,1)}, 1fr)`, gap: '12px' }}>
                    {cuentas.map(ct => (
                      <div key={ct.id} style={{ ...s.card, margin: 0, padding: '12px 14px' }}>
                        <p style={{ ...s.label, color: '#64748b', margin: '0 0 4px' }}>{ct.banco} · {ct.tipo.replace('_',' ')}</p>
                        <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{moneda(Number(ct.saldo))}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '11.5px', color: paleta.muted, marginTop: '8px' }}>
                    La proyección es consolidada: los vencimientos pendientes todavía no tienen una cuenta asignada (se define al registrar el pago), así que se proyecta el saldo total.
                  </p>
                </div>

                <div style={{ ...s.card, padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                  <table style={{ ...s.tabla, minWidth: '1100px', width: '100%' }}>
                    <thead><tr>{['Período', ...columnas.map(r => NOMBRE_RUBRO[r]), 'Total egresos', 'Neto del período', 'Saldo proyectado'].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                    <tbody>
                      {filas.map((f, i) => {
                        const egr = totalEgresosProy(f)
                        const neto = f.cobrar - egr
                        if (f.id !== 'sinfecha') acumulado += neto
                        return (
                          <tr key={f.id} style={s.tablaFila(i)}>
                            <td style={s.tablaCellBold}>{f.label}</td>
                            {columnas.map(r => (
                              <td key={r} style={{ ...s.tablaCell, whiteSpace: 'nowrap', color: f[r] ? colorRubro[r] : '#cbd5e1' }}>{f[r] ? moneda(f[r]) : '—'}</td>
                            ))}
                            <td style={{ ...s.tablaCellBold, whiteSpace: 'nowrap', color: egr ? '#dc2626' : '#cbd5e1' }}>{egr ? moneda(egr) : '—'}</td>
                            <td style={{ ...s.tablaCellBold, whiteSpace: 'nowrap', color: neto >= 0 ? '#059669' : '#dc2626' }}>{neto >= 0 ? '+' : ''}{moneda(neto)}</td>
                            <td style={{ ...s.tablaCellBold, whiteSpace: 'nowrap', color: f.id === 'sinfecha' ? '#94a3b8' : (acumulado >= 0 ? paleta.ink : '#dc2626') }}>
                              {f.id === 'sinfecha' ? '—' : moneda(acumulado)}
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={{ background: paleta.surfaceMuted }}>
                        <td style={s.tablaCellBold}>Total</td>
                        {columnas.map(r => <td key={r} style={{ ...s.tablaCellBold, whiteSpace: 'nowrap', color: colorRubro[r] }}>{moneda(totales[r])}</td>)}
                        <td style={{ ...s.tablaCellBold, whiteSpace: 'nowrap', color: '#dc2626' }}>{moneda(totalEgr)}</td>
                        <td style={{ ...s.tablaCellBold, whiteSpace: 'nowrap' }}>{moneda(totales.cobrar - totalEgr)}</td>
                        <td style={s.tablaCell}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '11.5px', color: paleta.muted, marginTop: '8px' }}>
                  "Sin fecha" reúne facturas sin vencimiento cargado y no entra en el saldo proyectado. Vencido = vencimientos anteriores a hoy que siguen sin pagarse.
                </p>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default Finanzas
