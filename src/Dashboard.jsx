import { useState, useEffect, useMemo } from 'react'
import { supabase, escucharCambiosDatos } from './supabase.js'
import { colores, paleta } from './estilos.js'
import {
  Home, Users, FileText, HardHat, CalendarDays, Wallet, Receipt, Package,
  BarChart3, ClipboardList, Briefcase, Factory, TrendingUp, TrendingDown, UserCog,
  Bell, CheckCircle2, LogOut, ChevronLeft, ChevronRight, RefreshCw,
  Search, Clock, ArrowUpRight, Landmark, Radar, ShieldCheck
} from 'lucide-react'
import {
  calcularResumenCuentasPorCobrar,
  calcularResumenCuentasPorPagar,
  calcularSaldosCuentas,
  esMovimientoAjuste,
  formatearMonedaAR
} from './finanzasUtils.js'
import Clientes from './pages/Clientes.jsx'
import CRM from './pages/CRM.jsx'
import Contratos from './pages/Contratos.jsx'
import Personal from './pages/Personal.jsx'
import Agenda from './pages/Agenda.jsx'
import Presupuestos from './pages/Presupuestos.jsx'
import Facturacion from './pages/Facturacion.jsx'
import Insumos from './pages/Insumos.jsx'
import Finanzas from './pages/Finanzas.jsx'
import Costos from './pages/Costos.jsx'
import Sueldos from './pages/Sueldos.jsx'
import Proveedores from './pages/Proveedores.jsx'
import Reportes from './pages/Reportes.jsx'
import Usuarios from './pages/Usuarios.jsx'

// Módulos restringidos a rol admin (coincide con las políticas RLS en Supabase)
const SOLO_ADMIN = ['facturacion', 'finanzas', 'conciliacion', 'costos', 'sueldos', 'usuarios']

const GRUPOS_MENU = [
  {
    label: 'Operación & Servicios',
    items: [
      { id: 'clientes',    icon: Users,        label: 'Clientes',    desc: 'Cuentas corporativas, CUIT y sucursales' },
      { id: 'crm',         icon: Radar,        label: 'CRM',         desc: 'Seguimiento de prospectos y oportunidades' },
      { id: 'contratos',   icon: FileText,     label: 'Contratos',   desc: 'Acuerdos vigentes, SLAs y renovaciones' },
      { id: 'agenda',      icon: CalendarDays, label: 'Agenda',      desc: 'Órdenes de trabajo y cronograma operativo' },
      { id: 'personal',    icon: HardHat,      label: 'Personal',    desc: 'Dotación, legajos y asignación de puestos' },
      { id: 'insumos',     icon: Package,      label: 'Insumos',     desc: 'Control de inventario, stock y reposición' },
      { id: 'proveedores', icon: Factory,      label: 'Proveedores', desc: 'Directorio de compras y servicios externos' },
    ]
  },
  {
    label: 'Administración & Finanzas',
    items: [
      { id: 'presupuestos', icon: Wallet,        label: 'Presupuestos',           desc: 'Cotizaciones comerciales y propuestas' },
      { id: 'facturacion',  icon: Receipt,       label: 'Facturación',            desc: 'Emisión, cuentas corrientes y cobranzas' },
      { id: 'finanzas',     icon: BarChart3,     label: 'Finanzas',               desc: 'Flujo de caja, ingresos y egresos' },
      { id: 'conciliacion', icon: ShieldCheck,   label: 'Conciliación Bancaria',  desc: 'Resúmenes bancarios y conciliación' },
      { id: 'costos',       icon: ClipboardList, label: 'Costos',                 desc: 'Costeo operativo por servicio y cliente' },
      { id: 'sueldos',      icon: Briefcase,     label: 'Sueldos',                desc: 'Liquidación salarial y jornales' },
    ]
  },
  {
    label: 'Inteligencia & Auditoría',
    items: [
      { id: 'reportes', icon: TrendingUp, label: 'Reportes', desc: 'Métricas gerenciales y rentabilidad' },
      { id: 'usuarios', icon: UserCog,    label: 'Usuarios', desc: 'Permisos del sistema y accesos' },
    ]
  }
]

const TODOS_LOS_ITEMS = GRUPOS_MENU.flatMap(g => g.items)

const alertaEstilo = {
  danger:  { dot: '#BE123C', bg: '#FFF1F2', text: '#BE123C', label: 'Crítico' },
  warning: { dot: '#B45309', bg: '#FEF3C7', text: '#B45309', label: 'Atención' },
  info:    { dot: '#0369A1', bg: '#E0F2FE', text: '#0369A1', label: 'Aviso' },
}

function normalizarFechaYMD(f) {
  if (!f) return ''
  const limpio = String(f).trim().split('T')[0]
  if (limpio.includes('-')) {
    const partes = limpio.split('-')
    if (partes[0].length === 4) return limpio
    if (partes[2].length === 4) return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
  }
  if (limpio.includes('/')) {
    const partes = limpio.split('/')
    if (partes[2].length === 4) return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
    if (partes[0].length === 4) return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`
  }
  return limpio
}

function obtenerRangosPeriodo() {
  const hoyObj = new Date()

  const anio = hoyObj.getFullYear()
  const mes = (hoyObj.getMonth() + 1).toString().padStart(2, '0')
  const dia = hoyObj.getDate().toString().padStart(2, '0')
  const hoyStr = `${anio}-${mes}-${dia}`

  // Semana actual: de lunes a domingo
  const diaSemana = hoyObj.getDay() // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const distanciaLunes = diaSemana === 0 ? -6 : 1 - diaSemana
  const lunesObj = new Date(hoyObj)
  lunesObj.setDate(hoyObj.getDate() + distanciaLunes)
  const domingoObj = new Date(lunesObj)
  domingoObj.setDate(lunesObj.getDate() + 6)

  const lAnio = lunesObj.getFullYear()
  const lMes = (lunesObj.getMonth() + 1).toString().padStart(2, '0')
  const lDia = lunesObj.getDate().toString().padStart(2, '0')
  const lunesStr = `${lAnio}-${lMes}-${lDia}`

  const dAnio = domingoObj.getFullYear()
  const dMes = (domingoObj.getMonth() + 1).toString().padStart(2, '0')
  const dDia = domingoObj.getDate().toString().padStart(2, '0')
  const domingoStr = `${dAnio}-${dMes}-${dDia}`

  // Mes actual: día 1 al último día
  const ultimoDiaMes = new Date(anio, hoyObj.getMonth() + 1, 0).getDate()
  const mesInicioStr = `${anio}-${mes}-01`
  const mesFinStr = `${anio}-${mes}-${ultimoDiaMes.toString().padStart(2, '0')}`

  return {
    hoy: { desde: hoyStr, hasta: hoyStr, dia, mes, anio },
    semana: { desde: lunesStr, hasta: domingoStr, lDia, lMes, dDia, dMes },
    mes: { desde: mesInicioStr, hasta: mesFinStr, mes, anio }
  }
}

function Dashboard({ user }) {
  const [seccionActiva, setSeccionActiva] = useState('inicio')
  const [vistaFinanzasInicial, setVistaFinanzasInicial] = useState('movimientos')
  const [menuAbierto, setMenuAbierto] = useState(true)
  const [esAdmin, setEsAdmin] = useState(false)
  const [rolCargado, setRolCargado] = useState(false)
  const [kpis, setKpis] = useState({
    clientes: 0,
    contratos: 0,
    empleados: 0,
    serviciosHoy: 0,
    serviciosSemana: 0,
    serviciosMes: 0,
    ingresosHoy: 0,
    ingresosSemana: 0,
    ingresosMes: 0,
    egresosHoy: 0,
    egresosSemana: 0,
    egresosMes: 0,
    cantIngresosHoy: 0,
    cantIngresosSemana: 0,
    cantIngresosMes: 0,
    facturasPendientes: 0,
    cantPorCobrar: 0,
    porPagar: 0,
    cantPorPagar: 0,
    saldoBancos: 0,
    saldoEfectivo: 0,
    saldoCajaYBancos: 0,
    cantCuentas: 0
  })
  const [alertas, setAlertas] = useState([])
  const [actualizandoKpis, setActualizandoKpis] = useState(false)
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes')
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)
  const [queryBusqueda, setQueryBusqueda] = useState('')
  const [horaActual, setHoraActual] = useState(new Date())

  const rangos = useMemo(() => obtenerRangosPeriodo(), [])

  const metricaPeriodo = useMemo(() => {
    if (filtroPeriodo === 'hoy') {
      return {
        id: 'hoy',
        ingresos: kpis.ingresosHoy,
        egresos: kpis.egresosHoy,
        cantIngresos: kpis.cantIngresosHoy,
        servicios: kpis.serviciosHoy,
        tituloIngresos: 'Ingresos de Hoy (Cobrados)',
        subtituloIngresos: `Cobranzas registradas hoy (${rangos.hoy.dia}/${rangos.hoy.mes})`,
        etiquetaPeriodo: 'Hoy',
        tituloServicios: 'Servicios Programados Hoy',
        subtituloServicios: 'turnos en agenda hoy'
      }
    }
    if (filtroPeriodo === 'semana') {
      return {
        id: 'semana',
        ingresos: kpis.ingresosSemana,
        egresos: kpis.egresosSemana,
        cantIngresos: kpis.cantIngresosSemana,
        servicios: kpis.serviciosSemana,
        tituloIngresos: 'Ingresos de la Semana (Cobrados)',
        subtituloIngresos: `Semana del ${rangos.semana.lDia}/${rangos.semana.lMes} al ${rangos.semana.dDia}/${rangos.semana.dMes}`,
        etiquetaPeriodo: 'Esta semana',
        tituloServicios: 'Servicios de la Semana',
        subtituloServicios: 'turnos en agenda esta semana'
      }
    }
    return {
      id: 'mes',
      ingresos: kpis.ingresosMes,
      egresos: kpis.egresosMes,
      cantIngresos: kpis.cantIngresosMes,
      servicios: kpis.serviciosMes,
      tituloIngresos: 'Ingresos del Mes (Cobrados)',
      subtituloIngresos: `Período ${rangos.mes.mes}/${rangos.mes.anio}`,
      etiquetaPeriodo: 'Mes actual',
      tituloServicios: 'Servicios del Mes',
      subtituloServicios: 'turnos en agenda este mes'
    }
  }, [filtroPeriodo, kpis, rangos])

  // Actualizar reloj en vivo cada segundo
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Atajo de teclado global Ctrl+K para Command Palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscadorAbierto(prev => !prev)
      } else if (e.key === 'Escape') {
        setBuscadorAbierto(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    cargarRol()
  }, [user.id])

  useEffect(() => {
    if (seccionActiva === 'inicio') {
      cargarKpis()
      cargarAlertas()
    }
  }, [seccionActiva, esAdmin])

  // Sincronización automática en vivo del Tablero
  useEffect(() => {
    // 1. Escuchar eventos locales de cambio de datos desde Facturación, Finanzas, ARCA, Reportes
    const desuscribir = escucharCambiosDatos(() => {
      if (seccionActiva === 'inicio') {
        cargarKpis()
        cargarAlertas()
      }
    })

    // 2. Refrescar al volver el foco a la ventana
    const alVolverFoco = () => {
      if (seccionActiva === 'inicio') {
        cargarKpis()
        cargarAlertas()
      }
    }
    window.addEventListener('focus', alVolverFoco)
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible' && seccionActiva === 'inicio') {
        cargarKpis()
        cargarAlertas()
      }
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    // 3. Heartbeat periódico cada 20 segundos para mantener el tablero 100% fresco
    const timerSync = setInterval(() => {
      if (seccionActiva === 'inicio') {
        cargarKpis()
      }
    }, 20000)

    // 4. Canal Realtime de Supabase
    let canalRealtime = null
    try {
      canalRealtime = supabase.channel('dashboard_auto_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => {
          if (seccionActiva === 'inicio') { cargarKpis(); cargarAlertas() }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos_financieros' }, () => {
          if (seccionActiva === 'inicio') cargarKpis()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => {
          if (seccionActiva === 'inicio') cargarKpis()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas_bancarias' }, () => {
          if (seccionActiva === 'inicio') cargarKpis()
        })
        .subscribe()
    } catch (e) {
      console.warn('Realtime subscription notice:', e)
    }

    return () => {
      desuscribir()
      window.removeEventListener('focus', alVolverFoco)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      clearInterval(timerSync)
      if (canalRealtime) supabase.removeChannel(canalRealtime)
    }
  }, [seccionActiva])

  async function cargarRol() {
    try {
      const { data } = await supabase.from('usuarios_sistema').select('rol').eq('user_id', user.id).maybeSingle()
      setEsAdmin(data?.rol === 'admin' || user.email === 'admin@briseo.com')
      setRolCargado(true)
    } catch {
      setEsAdmin(user.email === 'admin@briseo.com')
      setRolCargado(true)
    }
  }

  async function cargarKpis() {
    setActualizandoKpis(true)
    try {
      const rangosActuales = obtenerRangosPeriodo()
      const minFecha = rangosActuales.semana.desde < rangosActuales.mes.desde ? rangosActuales.semana.desde : rangosActuales.mes.desde

      const [
        { count: clientes },
        { count: contratos },
        { count: empleados },
        { data: ordenesData },
        { data: movsPeriodoRaw },
        { data: todasFacturas, error: errTodasFacturas },
        { data: pagosData },
        { data: facturasCompraData },
        { data: pagosCompraData },
        { data: cuentasData }
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('contratos').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
        supabase.from('empleados').select('*', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('ordenes_trabajo').select('id, fecha_programada').gte('fecha_programada', minFecha),
        supabase.from('movimientos_financieros').select('id, tipo, monto, categoria, descripcion, factura_id, fecha').gte('fecha', minFecha).limit(5000),
        supabase.from('facturas').select('id, numero_factura, total, estado, fecha_emision'),
        supabase.from('pagos').select('id, factura_id, monto, fecha_pago'),
        supabase.from('facturas_compra').select('id, total, estado'),
        supabase.from('pagos_compra').select('factura_compra_id, monto'),
        supabase.from('cuentas_bancarias').select('id, banco, tipo, saldo, activa').eq('activa', true)
      ])

      const setFactIds = new Set((todasFacturas || []).map(f => f.id))
      const factNumPorId = {}
      ;(todasFacturas || []).forEach(f => { factNumPorId[f.id] = f.numero_factura })

      // Solo limpiar movimientos vinculados explícitamente (factura_id) a una factura ya eliminada
      const huerfanos = (!errTodasFacturas && Array.isArray(todasFacturas))
        ? (movsPeriodoRaw || []).filter(m => m.tipo === 'ingreso' && m.factura_id && !setFactIds.has(m.factura_id))
        : []

      if (huerfanos.length > 0) {
        const idsHuerfanos = huerfanos.map(h => h.id)
        try {
          await supabase.from('movimientos_financieros').delete().in('id', idsHuerfanos)
        } catch (e) {
          console.warn('Orphan cleanup notice in kpi:', e)
        }
      }

      const idsHuerfanosSet = new Set(huerfanos.map(h => h.id))
      // Excluir movimientos huérfanos y ajustes de saldo / transferencias internas
      const movsValidos = (movsPeriodoRaw || []).filter(m => !idsHuerfanosSet.has(m.id) && !esMovimientoAjuste(m))

      // Calcular ingresos y egresos operativos según los 3 períodos: Hoy, Semana, Mes
      let ingHoy = 0, cantHoy = 0, egrHoy = 0
      let ingSem = 0, cantSem = 0, egrSem = 0
      let ingMes = 0, cantMes = 0, egrMes = 0

      // Registrar cobranzas ya reflejadas en movimientos_financieros para no duplicar con pagos
      const facturasConMovIngreso = new Set()
      movsValidos.forEach(m => {
        if (m.tipo !== 'ingreso') return
        if (m.factura_id) facturasConMovIngreso.add(m.factura_id)
        if (m.descripcion) {
          Object.entries(factNumPorId).forEach(([fid, num]) => {
            if (num && m.descripcion.includes(num)) facturasConMovIngreso.add(fid)
          })
        }
      })

      movsValidos.forEach(m => {
        const f = normalizarFechaYMD(m.fecha)
        const monto = Number(m.monto || 0)

        if (m.tipo === 'ingreso') {
          if (f === rangosActuales.hoy.desde) { ingHoy += monto; cantHoy++ }
          if (f >= rangosActuales.semana.desde && f <= rangosActuales.semana.hasta) { ingSem += monto; cantSem++ }
          if (f >= rangosActuales.mes.desde && f <= rangosActuales.mes.hasta) { ingMes += monto; cantMes++ }
        } else if (m.tipo === 'egreso') {
          if (f === rangosActuales.hoy.desde) egrHoy += monto
          if (f >= rangosActuales.semana.desde && f <= rangosActuales.semana.hasta) egrSem += monto
          if (f >= rangosActuales.mes.desde && f <= rangosActuales.mes.hasta) egrMes += monto
        }
      })

      // Incluir también cobros registrados en `pagos` del período que aún no tengan movimiento financiero vinculado
      ;(pagosData || []).forEach(p => {
        if (!p?.fecha_pago || !p?.factura_id) return
        if (facturasConMovIngreso.has(p.factura_id)) return
        const f = normalizarFechaYMD(p.fecha_pago)
        const monto = Number(p.monto || 0)
        if (monto <= 0) return

        if (f === rangosActuales.hoy.desde) { ingHoy += monto; cantHoy++ }
        if (f >= rangosActuales.semana.desde && f <= rangosActuales.semana.hasta) { ingSem += monto; cantSem++ }
        if (f >= rangosActuales.mes.desde && f <= rangosActuales.mes.hasta) { ingMes += monto; cantMes++ }
      })

      // Calcular servicios según los 3 periodos
      let servHoy = 0
      let servSem = 0
      let servMes = 0

      ;(ordenesData || []).forEach(o => {
        const f = normalizarFechaYMD(o.fecha_programada)
        if (f === rangosActuales.hoy.desde) servHoy++
        if (f >= rangosActuales.semana.desde && f <= rangosActuales.semana.hasta) servSem++
        if (f >= rangosActuales.mes.desde && f <= rangosActuales.mes.hasta) servMes++
      })

      // Cálculos unificados idénticos a Finanzas
      const resumenCobrar = calcularResumenCuentasPorCobrar(todasFacturas || [], pagosData || [])
      const resumenPagar = calcularResumenCuentasPorPagar(facturasCompraData || [], pagosCompraData || [])
      const resumenSaldos = calcularSaldosCuentas(cuentasData || [])

      setKpis({
        clientes: clientes || 0,
        contratos: contratos || 0,
        empleados: empleados || 0,
        serviciosHoy: servHoy,
        serviciosSemana: servSem,
        serviciosMes: servMes,
        ingresosHoy: Math.round(ingHoy * 100) / 100,
        ingresosSemana: Math.round(ingSem * 100) / 100,
        ingresosMes: Math.round(ingMes * 100) / 100,
        egresosHoy: Math.round(egrHoy * 100) / 100,
        egresosSemana: Math.round(egrSem * 100) / 100,
        egresosMes: Math.round(egrMes * 100) / 100,
        cantIngresosHoy: cantHoy,
        cantIngresosSemana: cantSem,
        cantIngresosMes: cantMes,
        facturasPendientes: resumenCobrar.totalPorCobrar,
        cantPorCobrar: resumenCobrar.cantidadPendientes,
        porPagar: resumenPagar.totalPorPagar,
        cantPorPagar: resumenPagar.cantidadPendientes,
        saldoBancos: resumenSaldos.totalBancos,
        saldoEfectivo: resumenSaldos.totalEfectivo,
        saldoCajaYBancos: resumenSaldos.totalCajaYBancos,
        cantCuentas: resumenSaldos.cantidadCuentas
      })
    } catch {
      // Supabase fallback si tablas aún no tienen datos
    }
    setActualizandoKpis(false)
  }

  async function cargarAlertas() {
    try {
      const hoy = new Date()
      const en7dias = new Date(hoy); en7dias.setDate(hoy.getDate() + 7)
      const en30dias = new Date(hoy); en30dias.setDate(hoy.getDate() + 30)
      const mes = hoy.toISOString().slice(0, 7)
      const nuevasAlertas = []

      const { data: facVencidas } = await supabase.from('facturas').select('numero_factura, total, fecha_vencimiento, clientes(razon_social,nombre_contacto)').in('estado', ['emitida', 'pendiente']).lt('fecha_vencimiento', hoy.toISOString().split('T')[0])
      ;(facVencidas || []).forEach(f => nuevasAlertas.push({
        tipo: 'danger',
        titulo: 'Factura vencida impaga',
        detalle: `${f.numero_factura || 'S/N'} · ${f.clientes?.razon_social || f.clientes?.nombre_contacto || 'Cliente'}`,
        monto: Number(f.total),
        modulo: 'facturacion'
      }))

      const { data: facPorVencer } = await supabase.from('facturas').select('numero_factura, total, fecha_vencimiento, clientes(razon_social,nombre_contacto)').in('estado', ['emitida', 'pendiente']).gte('fecha_vencimiento', hoy.toISOString().split('T')[0]).lte('fecha_vencimiento', en7dias.toISOString().split('T')[0])
      ;(facPorVencer || []).forEach(f => nuevasAlertas.push({
        tipo: 'warning',
        titulo: 'Vencimiento en próximos 7 días',
        detalle: `${f.numero_factura || 'S/N'} · ${f.clientes?.razon_social || f.clientes?.nombre_contacto || 'Cliente'}`,
        monto: Number(f.total),
        modulo: 'facturacion'
      }))

      const { data: empleadosActivos } = await supabase.from('empleados').select('id, nombre, apellido').eq('activo', true)
      const { data: liquidacionesMes } = await supabase.from('liquidaciones_sueldo').select('empleado_id').eq('periodo', mes)
      const liquidados = (liquidacionesMes || []).map(l => l.empleado_id)
      const sinLiquidar = (empleadosActivos || []).filter(e => !liquidados.includes(e.id))
      if (sinLiquidar.length > 0) {
        nuevasAlertas.push({
          tipo: 'warning',
          titulo: `${sinLiquidar.length} liquidaciones pendientes`,
          detalle: sinLiquidar.map(e => e.apellido + ' ' + e.nombre).slice(0, 3).join(', ') + (sinLiquidar.length > 3 ? ` y ${sinLiquidar.length - 3} más` : ''),
          modulo: 'sueldos'
        })
      }

      const { data: stockBajo } = await supabase.from('insumos').select('nombre, stock_actual, stock_minimo').eq('activo', true)
      const stockBajoFiltrado = (stockBajo || []).filter(i => Number(i.stock_actual) <= Number(i.stock_minimo))
      if (stockBajoFiltrado.length > 0) {
        nuevasAlertas.push({
          tipo: 'warning',
          titulo: `${stockBajoFiltrado.length} insumos bajo stock mínimo`,
          detalle: stockBajoFiltrado.map(i => i.nombre).slice(0, 3).join(', ') + (stockBajoFiltrado.length > 3 ? ` y ${stockBajoFiltrado.length - 3} más` : ''),
          modulo: 'insumos'
        })
      }

      const { data: contVencer } = await supabase.from('contratos').select('numero_contrato, fecha_fin, clientes(razon_social,nombre_contacto)').eq('estado', 'activo').not('fecha_fin', 'is', null).lte('fecha_fin', en30dias.toISOString().split('T')[0]).gte('fecha_fin', hoy.toISOString().split('T')[0])
      ;(contVencer || []).forEach(ct => nuevasAlertas.push({
        tipo: 'info',
        titulo: 'Contrato a renovar (30 días)',
        detalle: `${ct.numero_contrato || 'Contrato'} · ${ct.clientes?.razon_social || ct.clientes?.nombre_contacto || 'Cliente'}`,
        modulo: 'contratos'
      }))

      setAlertas(nuevasAlertas.filter(a => esAdmin || !SOLO_ADMIN.includes(a.modulo)))
    } catch {
      // Ignorar si aún no hay conexión Supabase
    }
  }

  const menuVisible = useMemo(() => {
    return GRUPOS_MENU.map(g => ({
      ...g,
      items: g.items.filter(i => esAdmin || !SOLO_ADMIN.includes(i.id))
    })).filter(g => g.items.length > 0)
  }, [esAdmin])

  const todosItemsDisponibles = useMemo(() => {
    return TODOS_LOS_ITEMS.filter(i => esAdmin || !SOLO_ADMIN.includes(i.id))
  }, [esAdmin])

  const resultadosBusqueda = useMemo(() => {
    if (!queryBusqueda.trim()) return todosItemsDisponibles
    const q = queryBusqueda.toLowerCase()
    return todosItemsDisponibles.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.desc && item.desc.toLowerCase().includes(q))
    )
  }, [queryBusqueda, todosItemsDisponibles])

  const itemActivo = TODOS_LOS_ITEMS.find(m => m.id === seccionActiva)
  const grupoActivo = GRUPOS_MENU.find(g => g.items.some(it => it.id === seccionActiva))
  const nombreUsuario = user.email.split('@')[0]
  const iniciales = nombreUsuario.slice(0, 2).toUpperCase()

  // Conteo de alertas por módulo para mostrar en el sidebar
  const conteoAlertasPorModulo = useMemo(() => {
    const mapa = {}
    alertas.forEach(a => {
      mapa[a.modulo] = (mapa[a.modulo] || 0) + 1
    })
    return mapa
  }, [alertas])

  if (!rolCargado) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontFamily: paleta.font }}>
        <div style={{ background: '#FFFFFF', padding: '10px', borderRadius: '12px', marginBottom: '16px' }}>
          <img src="/logo.jpg" alt="Briseo" style={{ height: '36px', width: '36px', objectFit: 'contain' }} />
        </div>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#F8FAFC' }}>Iniciando entorno ERP…</p>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748B' }}>Cargando permisos y políticas de seguridad</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: paleta.paper, display: 'flex', fontFamily: paleta.font, color: paleta.ink }}>

      {/* ============================================================ */}
      {/* SIDEBAR CORPORATIVO */}
      {/* ============================================================ */}
      <aside style={{
        width: menuAbierto ? '250px' : '68px',
        background: '#0F172A',
        borderRight: '1px solid #1E293B',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
        zIndex: 30
      }}>
        {/* LOGO & BRANDING */}
        <div style={{
          height: '64px',
          padding: menuAbierto ? '0 18px' : '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: menuAbierto ? 'space-between' : 'center',
          borderBottom: '1px solid #1E293B',
          background: '#0B1120'
        }}>
          {menuAbierto ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '3px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #334155' }}>
                <img src="/logo.jpg" alt="Briseo" style={{ height: '26px', width: '26px', objectFit: 'contain', borderRadius: '5px' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#FFFFFF', fontWeight: '800', fontSize: '14px', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>BRISEO</span>
                  <span style={{ background: '#0F766E', color: '#FFFFFF', fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px', letterSpacing: '0.04em' }}>ERP</span>
                </div>
                <p style={{ margin: '1px 0 0', color: '#64748B', fontSize: '10.5px', whiteSpace: 'nowrap', fontWeight: '500' }}>Softgestión Enterprise</p>
              </div>
            </div>
          ) : (
            <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '3px', border: '1px solid #334155' }}>
              <img src="/logo.jpg" alt="Briseo" style={{ height: '24px', width: '24px', objectFit: 'contain', borderRadius: '4px' }} />
            </div>
          )}
        </div>

        {/* NAVEGACIÓN PRINCIPAL */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {/* BOTÓN RESUMEN EJECUTIVO / INICIO */}
          <button
            onClick={() => setSeccionActiva('inicio')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: menuAbierto ? '8px 12px' : '9px',
              justifyContent: menuAbierto ? 'flex-start' : 'center',
              background: seccionActiva === 'inicio' ? 'rgba(15, 118, 110, 0.25)' : 'transparent',
              border: 'none',
              borderLeft: seccionActiva === 'inicio' ? `3px solid #14B8A6` : '3px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '14px',
              transition: 'all 0.15s ease'
            }}
          >
            <Home size={17} color={seccionActiva === 'inicio' ? '#2DD4BF' : '#94A3B8'} />
            {menuAbierto && (
              <span style={{
                color: seccionActiva === 'inicio' ? '#FFFFFF' : '#CBD5E1',
                fontSize: '13px',
                fontWeight: seccionActiva === 'inicio' ? '600' : '400',
                letterSpacing: '-0.01em'
              }}>
                Tablero Gerencial
              </span>
            )}
          </button>

          {/* GRUPOS MODULARES */}
          {menuVisible.map(grupo => (
            <div key={grupo.label} style={{ marginBottom: '18px' }}>
              {menuAbierto && (
                <div style={{
                  padding: '4px 10px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{
                    color: '#64748B',
                    fontSize: '10.5px',
                    fontWeight: '700',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase'
                  }}>
                    {grupo.label}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {grupo.items.map(item => {
                  const activo = seccionActiva === item.id
                  const Icon = item.icon
                  const alertasItem = conteoAlertasPorModulo[item.id] || 0
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'finanzas') setVistaFinanzasInicial('movimientos')
                        setSeccionActiva(item.id)
                      }}
                      title={!menuAbierto ? item.label : undefined}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: menuAbierto ? '7px 11px' : '9px',
                        justifyContent: menuAbierto ? 'flex-start' : 'center',
                        background: activo ? 'rgba(15, 118, 110, 0.22)' : 'transparent',
                        border: 'none',
                        borderLeft: activo ? `3px solid #14B8A6` : '3px solid transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease'
                      }}
                    >
                      <Icon size={16} color={activo ? '#2DD4BF' : '#94A3B8'} style={{ flexShrink: 0 }} />
                      {menuAbierto && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                          <span style={{
                            color: activo ? '#FFFFFF' : '#CBD5E1',
                            fontSize: '12.5px',
                            fontWeight: activo ? '600' : '400',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {item.label}
                          </span>
                          {alertasItem > 0 && (
                            <span style={{
                              background: '#BE123C',
                              color: '#FFFFFF',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '700',
                              padding: '1px 5px',
                              marginLeft: '6px'
                            }}>
                              {alertasItem}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* PIE DEL SIDEBAR: USUARIO & CONTRACCIÓN */}
        <div style={{
          padding: '12px',
          borderTop: '1px solid #1E293B',
          background: '#0B1120'
        }}>
          {menuAbierto ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: esAdmin ? '#0F766E' : '#334155',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {iniciales}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#10B981'
                    }} />
                    <span style={{ fontSize: '10.5px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '600' }}>
                      {esAdmin ? 'Administrador' : 'Operador'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setMenuAbierto(false)}
                  style={{
                    flex: 1,
                    background: '#1E293B',
                    border: '1px solid #334155',
                    color: '#94A3B8',
                    borderRadius: '5px',
                    padding: '6px 8px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <ChevronLeft size={13} /> Contraer
                </button>
                <button
                  onClick={() => supabase.auth.signOut()}
                  title="Cerrar sesión"
                  style={{
                    background: 'rgba(190, 18, 60, 0.15)',
                    border: '1px solid rgba(190, 18, 60, 0.35)',
                    color: '#FDA4AF',
                    borderRadius: '5px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setMenuAbierto(true)}
                title="Expandir barra"
                style={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  color: '#94A3B8',
                  borderRadius: '6px',
                  padding: '7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                title="Cerrar sesión"
                style={{
                  background: 'rgba(190, 18, 60, 0.15)',
                  border: '1px solid rgba(190, 18, 60, 0.35)',
                  color: '#FDA4AF',
                  borderRadius: '6px',
                  padding: '7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ============================================================ */}
      {/* CONTENEDOR PRINCIPAL */}
      {/* ============================================================ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* TOP COMMAND / APP BAR */}
        <header style={{
          height: '64px',
          background: '#FFFFFF',
          borderBottom: `1px solid ${paleta.line}`,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexShrink: 0
        }}>
          {/* BREADCRUMB & CONTEXTO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ color: paleta.muted, fontSize: '13px', fontWeight: '500' }}>Briseo ERP</span>
            <span style={{ color: paleta.lineStrong, fontSize: '13px' }}>/</span>
            {grupoActivo && (
              <>
                <span style={{ color: paleta.muted, fontSize: '13px', fontWeight: '500' }}>{grupoActivo.label}</span>
                <span style={{ color: paleta.lineStrong, fontSize: '13px' }}>/</span>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {seccionActiva === 'inicio' ? (
                <Home size={15} color={paleta.brand} />
              ) : (
                itemActivo && <itemActivo.icon size={15} color={paleta.brand} />
              )}
              <h2 style={{
                margin: 0,
                fontSize: '14.5px',
                fontWeight: '700',
                color: paleta.ink,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap'
              }}>
                {seccionActiva === 'inicio' ? 'Tablero Gerencial' : itemActivo?.label}
              </h2>
            </div>
          </div>

          {/* CENTRO: BARRA DE BÚSQUEDA RÁPIDA / COMMAND PALETTE */}
          <button
            onClick={() => setBuscadorAbierto(true)}
            style={{
              flex: '0 1 420px',
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: '#64748B',
              fontSize: '12.5px',
              transition: 'border-color 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={14} color="#94A3B8" />
              <span>Buscar módulo, clientes o acciones…</span>
            </div>
            <span style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '4px',
              padding: '1px 6px',
              fontSize: '10.5px',
              fontWeight: '600',
              color: '#475569',
              fontFamily: paleta.fontMono
            }}>
              Ctrl K
            </span>
          </button>

          {/* DERECHA: ESTADO DEL SISTEMA, RELOJ Y ROL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
            {/* Live operational badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '4px 9px', borderRadius: '5px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#15803D', letterSpacing: '0.02em' }}>
                ONLINE
              </span>
            </div>

            {/* Live Clock & Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: paleta.inkSoft, fontSize: '12px' }}>
              <Clock size={13} color={paleta.muted} />
              <span style={{ fontFamily: paleta.fontMono, fontSize: '12px', fontWeight: '500' }}>
                {horaActual.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{ color: paleta.muted }}>·</span>
              <span style={{ color: paleta.muted, fontSize: '12px' }}>
                {horaActual.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>

            {/* Badge de Rol */}
            <span style={{
              background: esAdmin ? '#F0FDFA' : '#F1F5F9',
              color: esAdmin ? '#0F766E' : '#475569',
              border: `1px solid ${esAdmin ? '#99F6E4' : '#CBD5E1'}`,
              borderRadius: '5px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}>
              {esAdmin ? 'ADMIN' : 'OPERADOR'}
            </span>
          </div>
        </header>

        {/* CUERPO DEL CONTENIDO */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto', background: paleta.paper }}>
          {seccionActiva === 'inicio' ? (
            <div style={{ maxWidth: '1440px', margin: '0 auto' }}>

              {/* ENCABEZADO GERENCIAL */}
              <div style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                borderRadius: '10px',
                padding: '24px 28px',
                marginBottom: '22px',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                border: '1px solid #334155'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      SISTEMA INTEGRAL DE GESTIÓN OPERATIVA
                    </span>
                  </div>
                  <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', color: '#F8FAFC' }}>
                    Panel de Control Gerencial · Briseo SRL
                  </h1>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                    Monitoreo en tiempo real de facturación, dotación de personal, órdenes de trabajo y alertas operativas.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Selector de periodo rápido */}
                  <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '3px', display: 'flex', gap: '2px' }}>
                    {[
                      { id: 'hoy', label: 'Hoy' },
                      { id: 'semana', label: 'Semana' },
                      { id: 'mes', label: 'Mes actual' },
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => setFiltroPeriodo(p.id)}
                        style={{
                          background: filtroPeriodo === p.id ? '#0F766E' : 'transparent',
                          color: filtroPeriodo === p.id ? '#FFFFFF' : '#94A3B8',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 13px',
                          fontSize: '11.5px',
                          fontWeight: filtroPeriodo === p.id ? '700' : '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: filtroPeriodo === p.id ? '0 1px 2px rgba(0,0,0,0.2)' : 'none'
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Botón sincronizar métricas */}
                  <button
                    onClick={() => { cargarKpis(); cargarAlertas() }}
                    disabled={actualizandoKpis}
                    title="Actualizar datos desde la nube"
                    style={{
                      background: '#1E293B',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      padding: '7px 12px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <RefreshCw size={13} className={actualizandoKpis ? 'animate-spin' : ''} />
                    <span>{actualizandoKpis ? 'Actualizando…' : 'Sincronizar'}</span>
                  </button>
                </div>
              </div>

              {/* GRID PRINCIPAL: MÉTRICAS Y TABLERO OPERATIVO */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '22px', alignItems: 'start' }}>

                {/* COLUMNA IZQUIERDA: TARJETAS KPI & ACCESOS DIRECTOS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

                  {/* BANDA DE KPIS FINANCIEROS (SINCRONIZADOS CON FINANZAS) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    {/* KPI 1: INGRESOS DEL PERIODO (HOY, SEMANA, MES) */}
                    <div
                      onClick={() => {
                        setVistaFinanzasInicial('movimientos')
                        setSeccionActiva('finanzas')
                      }}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderTop: '3px solid #0F766E',
                        borderRadius: '8px',
                        padding: '16px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {metricaPeriodo.tituloIngresos}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: '700', background: '#CCFBF1', color: '#0F766E', padding: '2px 6px', borderRadius: '4px' }}>
                              {metricaPeriodo.etiquetaPeriodo}
                            </span>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#0F766E', fontWeight: '600' }}>
                            {metricaPeriodo.subtituloIngresos} · {metricaPeriodo.cantIngresos} {metricaPeriodo.cantIngresos === 1 ? 'ingreso' : 'ingresos'}
                          </p>
                        </div>
                        <div style={{ background: '#F0FDFA', padding: '7px', borderRadius: '6px', border: '1px solid #CCFBF1', flexShrink: 0 }}>
                          <BarChart3 size={17} color="#0F766E" />
                        </div>
                      </div>
                      <div style={{ marginTop: '14px' }}>
                        <div style={{ fontFamily: paleta.fontMono, fontSize: '21px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.02em' }}>
                          {formatearMonedaAR(metricaPeriodo.ingresos)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            Egresos: {formatearMonedaAR(metricaPeriodo.egresos)}
                          </span>
                          <span style={{ fontSize: '11px', color: '#0F766E', fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                            Finanzas <ArrowUpRight size={12} />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* KPI 2: CUENTAS POR COBRAR */}
                    <div
                      onClick={() => {
                        setVistaFinanzasInicial('por-cobrar')
                        setSeccionActiva('finanzas')
                      }}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderTop: '3px solid #1D4ED8',
                        borderRadius: '8px',
                        padding: '16px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Cuentas por Cobrar
                          </span>
                          <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#1D4ED8', fontWeight: '600' }}>
                            {kpis.cantPorCobrar} {kpis.cantPorCobrar === 1 ? 'factura pendiente' : 'facturas pendientes'}
                          </p>
                        </div>
                        <div style={{ background: '#EFF6FF', padding: '7px', borderRadius: '6px', border: '1px solid #BFDBFE', flexShrink: 0 }}>
                          <TrendingUp size={17} color="#1D4ED8" />
                        </div>
                      </div>
                      <div style={{ marginTop: '14px' }}>
                        <div style={{ fontFamily: paleta.fontMono, fontSize: '21px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.02em' }}>
                          {formatearMonedaAR(kpis.facturasPendientes)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>Saldo neto a cobrar</span>
                          <span style={{ fontSize: '11px', color: '#1D4ED8', fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                            Por cobrar <ArrowUpRight size={12} />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* KPI 3: CUENTAS POR PAGAR */}
                    <div
                      onClick={() => {
                        setVistaFinanzasInicial('por-pagar')
                        setSeccionActiva('finanzas')
                      }}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderTop: '3px solid #C2410C',
                        borderRadius: '8px',
                        padding: '16px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Cuentas por Pagar
                          </span>
                          <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#C2410C', fontWeight: '600' }}>
                            {kpis.cantPorPagar} {kpis.cantPorPagar === 1 ? 'comprobante pendiente' : 'comprobantes pendientes'}
                          </p>
                        </div>
                        <div style={{ background: '#FFF7ED', padding: '7px', borderRadius: '6px', border: '1px solid #FED7AA', flexShrink: 0 }}>
                          <TrendingDown size={17} color="#C2410C" />
                        </div>
                      </div>
                      <div style={{ marginTop: '14px' }}>
                        <div style={{ fontFamily: paleta.fontMono, fontSize: '21px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.02em' }}>
                          {formatearMonedaAR(kpis.porPagar)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>Saldo neto proveedores</span>
                          <span style={{ fontSize: '11px', color: '#C2410C', fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                            Por pagar <ArrowUpRight size={12} />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* KPI 4: CAJA + BANCOS A LA FECHA */}
                    <div
                      onClick={() => {
                        setVistaFinanzasInicial('movimientos')
                        setSeccionActiva('finanzas')
                      }}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderTop: '3px solid #0F172A',
                        borderRadius: '8px',
                        padding: '16px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Caja + Bancos a la fecha
                          </span>
                          <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#334155', fontWeight: '600' }}>
                            {kpis.cantCuentas} {kpis.cantCuentas === 1 ? 'cuenta activa' : 'cuentas activas'}
                          </p>
                        </div>
                        <div style={{ background: '#F1F5F9', padding: '7px', borderRadius: '6px', border: '1px solid #CBD5E1', flexShrink: 0 }}>
                          <Landmark size={17} color="#0F172A" />
                        </div>
                      </div>
                      <div style={{ marginTop: '14px' }}>
                        <div style={{ fontFamily: paleta.fontMono, fontSize: '21px', fontWeight: '700', color: kpis.saldoCajaYBancos >= 0 ? '#0F172A' : '#DC2626', letterSpacing: '-0.02em' }}>
                          {formatearMonedaAR(kpis.saldoCajaYBancos)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Bancos: {formatearMonedaAR(kpis.saldoBancos)} · Efec.: {formatearMonedaAR(kpis.saldoEfectivo)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FILA SECUNDARIA DE OPERACIONES */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    {/* CUENTAS CORPORATIVAS */}
                    <div
                      onClick={() => setSeccionActiva('clientes')}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '16px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#EFF6FF', padding: '10px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                          <Users size={20} color="#2563EB" />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cuentas Corporativas</p>
                          <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                            {kpis.clientes} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '400' }}>clientes · {kpis.contratos} contratos</span>
                          </p>
                        </div>
                      </div>
                      <span style={{ color: '#2563EB', fontSize: '12px', fontWeight: '600' }}>Ver →</span>
                    </div>

                    {/* PERSONAL EN SERVICIO */}
                    <div
                      onClick={() => setSeccionActiva('personal')}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '16px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#F0FDF4', padding: '10px', borderRadius: '6px', border: '1px solid #DCFCE7' }}>
                          <HardHat size={20} color="#15803D" />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dotación de Personal</p>
                          <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                            {kpis.empleados} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '400' }}>operarios activos</span>
                          </p>
                        </div>
                      </div>
                      <span style={{ color: '#15803D', fontSize: '12px', fontWeight: '600' }}>Gestionar →</span>
                    </div>

                    {/* AGENDA DEL PERIODO */}
                    <div
                      onClick={() => setSeccionActiva('agenda')}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '16px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#FFFBEB', padding: '10px', borderRadius: '6px', border: '1px solid #FEF3C7' }}>
                          <CalendarDays size={20} color="#D97706" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {metricaPeriodo.tituloServicios}
                            </p>
                            <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#D97706', background: '#FEF3C7', padding: '1px 5px', borderRadius: '4px' }}>
                              {metricaPeriodo.etiquetaPeriodo}
                            </span>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                            {metricaPeriodo.servicios} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '400' }}>{metricaPeriodo.subtituloServicios}</span>
                          </p>
                        </div>
                      </div>
                      <span style={{ color: '#D97706', fontSize: '12px', fontWeight: '600' }}>Ver agenda →</span>
                    </div>
                  </div>

                  {/* MATRIZ DE MÓDULOS DEL SISTEMA */}
                  <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '22px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.01em' }}>
                          Módulos del Sistema ERP
                        </h3>
                        <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748B' }}>
                          Seleccioná un módulo para operar registros y emitir comprobantes
                        </p>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', padding: '4px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                        {todosItemsDisponibles.length} módulos habilitados
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                      {todosItemsDisponibles.map(item => {
                        const Icon = item.icon
                        const colorMod = colores[item.id]?.main || '#0F766E'
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.id === 'finanzas') setVistaFinanzasInicial('movimientos')
                              setSeccionActiva(item.id)
                            }}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '7px',
                              padding: '12px 14px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '11px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              background: '#FFFFFF',
                              border: `1px solid ${colorMod}33`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Icon size={16} color={colorMod} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{item.label}</p>
                              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.desc || 'Acceder al módulo'}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                </div>

                {/* COLUMNA DERECHA: ALERTAS Y AUDITORÍA OPERATIVA */}
                <div style={{ position: 'sticky', top: '16px' }}>
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '20px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)'
                  }}>
                    {/* Header de Alertas */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bell size={16} color="#0F172A" />
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                          Alertas & Auditoría
                        </h3>
                      </div>
                      {alertas.length > 0 ? (
                        <span style={{
                          background: '#BE123C',
                          color: '#FFFFFF',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 7px',
                          fontFamily: paleta.fontMono
                        }}>
                          {alertas.length} ACTIVAS
                        </span>
                      ) : (
                        <span style={{
                          background: '#DCFCE7',
                          color: '#15803D',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 7px'
                        }}>
                          AL DÍA
                        </span>
                      )}
                    </div>

                    {/* Lista de alertas */}
                    {alertas.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px 12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#F0FDF4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                          <CheckCircle2 size={24} color="#16A34A" />
                        </div>
                        <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '600', color: '#0F172A' }}>Sin alertas operativas</p>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>Todos los contratos, facturas y sueldos se encuentran al día.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                        {alertas.map((a, i) => {
                          const conf = alertaEstilo[a.tipo] || alertaEstilo.info
                          return (
                            <button
                              key={i}
                              onClick={() => setSeccionActiva(a.modulo)}
                              style={{
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderLeft: `3px solid ${conf.dot}`,
                                borderRadius: '6px',
                                padding: '10px 12px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                transition: 'background 0.12s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                                  {a.titulo}
                                </span>
                                <span style={{
                                  background: conf.bg,
                                  color: conf.text,
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  textTransform: 'uppercase'
                                }}>
                                  {conf.label}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: '11.5px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {a.detalle}
                              </p>
                              {a.monto && (
                                <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: '700', color: conf.text, fontFamily: paleta.fontMono }}>
                                  {a.monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                                </p>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                      <button
                        onClick={() => cargarAlertas()}
                        style={{
                          width: '100%',
                          padding: '7px 12px',
                          background: '#F8FAFC',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          color: '#334155',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <RefreshCw size={12} />
                        <span>Actualizar alertas</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            /* RENDERIZADO DE LOS MÓDULOS ESPECÍFICOS */
            <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
              {seccionActiva === 'clientes' && <Clientes />}
              {seccionActiva === 'crm' && <CRM />}
              {seccionActiva === 'contratos' && <Contratos />}
              {seccionActiva === 'personal' && <Personal />}
              {seccionActiva === 'agenda' && <Agenda />}
              {seccionActiva === 'presupuestos' && <Presupuestos />}
              {seccionActiva === 'facturacion' && esAdmin && <Facturacion />}
              {seccionActiva === 'insumos' && <Insumos />}
              {seccionActiva === 'finanzas' && esAdmin && <Finanzas vistaInicial={vistaFinanzasInicial} />}
              {seccionActiva === 'conciliacion' && esAdmin && <Finanzas vistaInicial="conciliacion" />}
              {seccionActiva === 'costos' && esAdmin && <Costos />}
              {seccionActiva === 'sueldos' && esAdmin && <Sueldos />}
              {seccionActiva === 'proveedores' && <Proveedores />}
              {seccionActiva === 'reportes' && <Reportes />}
              {seccionActiva === 'usuarios' && esAdmin && <Usuarios />}
            </div>
          )}
        </main>
      </div>

      {/* ============================================================ */}
      {/* MODAL GLOBAL: COMMAND PALETTE (CTRL + K) */}
      {/* ============================================================ */}
      {buscadorAbierto && (
        <div
          onClick={() => setBuscadorAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
            zIndex: 999
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#FFFFFF',
              borderRadius: '10px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #CBD5E1',
              overflow: 'hidden'
            }}
          >
            {/* Input del Command Palette */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Search size={18} color="#64748B" />
              <input
                autoFocus
                type="text"
                value={queryBusqueda}
                onChange={e => setQueryBusqueda(e.target.value)}
                placeholder="Escribí para buscar módulo o comando…"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '14.5px',
                  color: '#0F172A',
                  background: 'transparent',
                  fontFamily: paleta.font
                }}
              />
              <span style={{ fontSize: '11px', background: '#F1F5F9', color: '#64748B', padding: '2px 6px', borderRadius: '4px' }}>
                ESC para salir
              </span>
            </div>

            {/* Lista de resultados */}
            <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
              <div style={{ padding: '4px 10px 6px', fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Módulos del ERP
              </div>
              {resultadosBusqueda.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                  No se encontraron módulos con &quot;{queryBusqueda}&quot;
                </div>
              ) : (
                resultadosBusqueda.map(item => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'finanzas') setVistaFinanzasInicial('movimientos')
                        setSeccionActiva(item.id)
                        setBuscadorAbierto(false)
                        setQueryBusqueda('')
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={15} color="#0F766E" />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '600', color: '#0F172A' }}>{item.label}</p>
                          <p style={{ margin: 0, fontSize: '11.5px', color: '#64748B' }}>{item.desc}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#0F766E', fontWeight: '600' }}>Abrir →</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Dashboard
