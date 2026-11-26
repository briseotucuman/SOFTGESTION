import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence, MotionConfig, motion as Motion } from 'framer-motion'
import { supabase, escucharCambiosDatos } from './supabase.js'
import {
  Home, Users, FileText, HardHat, CalendarDays, Wallet, Receipt, Package,
  BarChart3, ClipboardList, Briefcase, Factory, TrendingUp, UserCog,
  Bell, LogOut, ChevronLeft, ChevronRight, RefreshCw,
  Search, Clock, Radar, Menu, X
} from 'lucide-react'
import {
  calcularResumenCuentasPorCobrar,
  calcularResumenCuentasPorPagar,
  calcularSaldosCuentas,
  esMovimientoAjuste,
} from './finanzasUtils.js'
import BentoTablero from './components/BentoTablero.jsx'
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
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [notifAbierto, setNotifAbierto] = useState(false)
  const [perfilAbierto, setPerfilAbierto] = useState(false)
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)
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

  const saludo = useMemo(() => {
    const h = horaActual.getHours()
    if (h < 12) return 'Buen día'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }, [horaActual])

  const navegarModulo = (modulo, vistaFinanzas) => {
    // La conciliación vive dentro de Finanzas (solapa "Conciliación bancaria"): un solo menú
    if (modulo === 'conciliacion') { modulo = 'finanzas'; vistaFinanzas = 'conciliacion' }
    if (modulo === 'finanzas') {
      setVistaFinanzasInicial(vistaFinanzas || 'movimientos')
    }
    setSeccionActiva(modulo)
    setMenuMovilAbierto(false)
  }

  if (!rolCargado) {
    return (
      <div className="font-jakarta min-h-screen bg-[#F3F5FA] flex flex-col items-center justify-center text-slate-900">
        <div className="bg-white p-3 rounded-2xl shadow-md border border-white mb-4">
          <img src="/logo.jpg" alt="Briseo" className="h-10 w-10 object-contain rounded-lg" />
        </div>
        <p className="text-sm font-bold text-slate-900">Iniciando Briseo ERP…</p>
        <p className="text-xs text-slate-500 mt-1">Cargando permisos y datos del sistema</p>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="saas-analytics-shell font-jakarta min-h-screen bg-[#F3F5FA] text-slate-900 relative overflow-x-hidden py-3 px-2.5 sm:py-6 sm:px-5 lg:px-7 flex justify-center items-start">
        {/* Luz ambiental suave para realzar el vidrio esmerilado */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-28 -left-24 w-[480px] h-[480px] rounded-full bg-[#A6BEFF]/25 blur-3xl" />
          <div className="absolute -bottom-32 right-0 w-[440px] h-[440px] rounded-full bg-[#3B66F5]/12 blur-3xl" />
        </div>

        {/* CONTENEDOR PRINCIPAL GLASSMORPHISM */}
        <div className="relative z-10 w-full max-w-[1440px] rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl p-3 sm:p-5 lg:p-6 flex flex-col md:flex-row gap-4 lg:gap-6 min-h-[calc(100vh-3rem)]">

          {/* ============================================================ */}
          {/* SIDEBAR FLOTANTE OSCURO EN PÍLDORA (#18191C)                 */}
          {/* ============================================================ */}
          <aside
            aria-label="Navegación principal"
            style={{ width: menuAbierto ? '230px' : '72px' }}
            className="hidden md:flex flex-col justify-between shrink-0 rounded-[28px] bg-[#18191C] text-white py-4 px-2.5 shadow-[0_16px_38px_rgba(24,25,28,0.22)] transition-all duration-200 self-stretch"
          >
            {/* Marca superior Briseo */}
            <div>
              <button
                type="button"
                onClick={() => setSeccionActiva('inicio')}
                title="Tablero Gerencial · Briseo"
                className={`w-full flex items-center ${menuAbierto ? 'gap-3 px-2' : 'justify-center'} mb-5 group`}
              >
                <div className="w-11 h-11 rounded-2xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <img src="/logo.jpg" alt="Briseo" className="w-full h-full object-contain rounded-md" />
                </div>
                {menuAbierto && (
                  <div className="text-left min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-extrabold tracking-tight text-white">BRISEO</span>
                      <span className="rounded bg-[#3B66F5] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">
                        ERP
                      </span>
                    </div>
                    <p className="text-[10.5px] text-zinc-400 truncate">DAG Group S.R.L.</p>
                  </div>
                )}
              </button>

              {/* Navegación: Tablero + Módulos */}
              <nav className="flex flex-col gap-1 max-h-[calc(100vh-250px)] overflow-y-auto pr-0.5">
                <button
                  type="button"
                  onClick={() => setSeccionActiva('inicio')}
                  title="Tablero Gerencial"
                  className={`relative w-full h-10 rounded-full flex items-center ${
                    menuAbierto ? 'px-3 gap-3 justify-start' : 'justify-center'
                  } transition-colors ${
                    seccionActiva === 'inicio' ? 'text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {seccionActiva === 'inicio' && (
                    <Motion.span
                      layoutId="briseoSidebarActive"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-full bg-[#3B66F5] shadow-[0_6px_16px_rgba(59,102,245,0.45)]"
                    />
                  )}
                  <Home className="relative z-10 w-[18px] h-[18px] shrink-0" strokeWidth={1.9} />
                  {menuAbierto && (
                    <span className="relative z-10 text-xs font-semibold truncate">Tablero Gerencial</span>
                  )}
                </button>

                <div className="my-2 border-t border-white/10" />

                {menuVisible.map((grupo) => (
                  <div key={grupo.label} className="mb-1.5">
                    {menuAbierto && (
                      <div className="px-3 py-1 text-[9.5px] font-bold uppercase tracking-wider text-zinc-500">
                        {grupo.label}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      {grupo.items.map((item) => {
                        const Icon = item.icon
                        const activo = seccionActiva === item.id
                        const cantAlertas = conteoAlertasPorModulo[item.id] || 0
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navegarModulo(item.id, 'movimientos')}
                            title={!menuAbierto ? item.label : undefined}
                            className={`relative w-full h-10 rounded-full flex items-center ${
                              menuAbierto ? 'px-3 gap-3 justify-between' : 'justify-center'
                            } transition-colors ${
                              activo ? 'text-white' : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {activo && (
                              <Motion.span
                                layoutId="briseoSidebarActive"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                className="absolute inset-0 rounded-full bg-[#3B66F5] shadow-[0_6px_16px_rgba(59,102,245,0.45)]"
                              />
                            )}
                            <span className="relative z-10 flex items-center gap-3 min-w-0">
                              <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={1.85} />
                              {menuAbierto && (
                                <span className="text-xs font-medium truncate">{item.label}</span>
                              )}
                            </span>
                            {cantAlertas > 0 && (
                              <span
                                className={`relative z-10 ${
                                  menuAbierto
                                    ? 'rounded-full bg-rose-500 px-1.5 py-0.5 text-[9.5px] font-bold text-white tabular-nums'
                                    : 'absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#18191C]'
                                }`}
                              >
                                {menuAbierto ? cantAlertas : ''}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            {/* Pie del sidebar: Expandir/Contraer y Cerrar sesión */}
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2 items-center">
              <button
                type="button"
                onClick={() => setMenuAbierto((v) => !v)}
                title={menuAbierto ? 'Contraer barra' : 'Expandir menú'}
                className={`w-full h-9 rounded-full bg-white/8 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center ${
                  menuAbierto ? 'px-3 gap-2 justify-center' : 'justify-center'
                } transition-colors text-xs font-medium`}
              >
                {menuAbierto ? (
                  <>
                    <ChevronLeft className="w-4 h-4" />
                    <span>Contraer</span>
                  </>
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                title="Cerrar sesión"
                className={`w-full h-9 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 flex items-center ${
                  menuAbierto ? 'px-3 gap-2 justify-center' : 'justify-center'
                } transition-colors text-xs font-medium`}
              >
                <LogOut className="w-4 h-4" />
                {menuAbierto && <span>Salir</span>}
              </button>
            </div>
          </aside>

          {/* ============================================================ */}
          {/* ÁREA PRINCIPAL DERECHA: HEADER + BENTO GRID / MÓDULO ACTIVO  */}
          {/* ============================================================ */}
          <div className="flex-1 min-w-0 flex flex-col gap-5">

            {/* TOP HEADER */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 px-1 pt-0.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Botón menú móvil */}
                  <button
                    type="button"
                    onClick={() => setMenuMovilAbierto(true)}
                    aria-label="Abrir menú"
                    className="md:hidden w-10 h-10 rounded-full bg-[#18191C] text-white flex items-center justify-center shrink-0"
                  >
                    <Menu className="w-4 h-4" />
                  </button>

                  {seccionActiva === 'inicio' ? (
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                        {saludo}, {nombreUsuario}
                      </h1>
                      <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 truncate">
                        Briseo Limpieza · DAG Group S.R.L. · Tablero Gerencial en tiempo real
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSeccionActiva('inicio')}
                        className="rounded-full bg-white border border-[#E5E7EB] hover:border-[#3B66F5] px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#3B66F5] flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Tablero</span>
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                          <span>Briseo ERP</span>
                          {grupoActivo && (
                            <>
                              <span>/</span>
                              <span className="truncate">{grupoActivo.label}</span>
                            </>
                          )}
                        </div>
                        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                          {itemActivo?.label}
                        </h1>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* UTILIDADES DERECHA: BUSCADOR, RELOJ, NOTIFICACIONES, PERFIL */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Buscador Command Palette */}
                <button
                  type="button"
                  onClick={() => setBuscadorAbierto(true)}
                  className="flex items-center gap-2.5 rounded-full bg-white/90 border border-[#E5E7EB] hover:border-[#3B66F5]/50 px-3.5 py-2 text-xs text-slate-500 shadow-[0_4px_16px_rgb(0,0,0,0.03)] transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Buscar módulo o acción…</span>
                  <span className="sm:hidden">Buscar…</span>
                  <kbd className="hidden sm:inline rounded-md bg-[#F3F5FA] px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                    Ctrl K
                  </kbd>
                </button>

                {/* Reloj vivo */}
                <div className="hidden xl:flex items-center gap-1.5 rounded-full bg-white/85 border border-[#E5E7EB] px-3 py-2 text-[11.5px] font-medium text-slate-600 tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-[#3B66F5]" />
                  <span>
                    {horaActual.toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                {/* Notificaciones / Alertas reales */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifAbierto((v) => !v)
                      setPerfilAbierto(false)
                    }}
                    aria-label="Alertas del sistema"
                    className="relative w-10 h-10 rounded-full bg-white/90 border border-[#E5E7EB] hover:bg-white text-slate-700 flex items-center justify-center shadow-[0_4px_16px_rgb(0,0,0,0.03)] transition-colors"
                  >
                    <Bell className="w-[17px] h-[17px]" />
                    {alertas.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#3B66F5] text-white text-[10px] font-bold flex items-center justify-center tabular-nums ring-2 ring-white">
                        {alertas.length}
                      </span>
                    )}
                  </button>

                  <AnimatePresence>
                    {notifAbierto && (
                      <Motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-[#E5E7EB] shadow-xl p-3.5 z-50"
                      >
                        <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                          <span className="text-xs font-bold text-slate-900">
                            Alertas Operativas ({alertas.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => cargarAlertas()}
                            className="text-[11px] font-semibold text-[#3B66F5] hover:underline"
                          >
                            Actualizar
                          </button>
                        </div>
                        <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto">
                          {alertas.length === 0 ? (
                            <p className="py-5 text-center text-xs text-slate-500">
                              Sin alertas activas. Todo se encuentra al día.
                            </p>
                          ) : (
                            alertas.map((a, i) => {
                              const conf = alertaEstilo[a.tipo] || alertaEstilo.info
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    navegarModulo(a.modulo)
                                    setNotifAbierto(false)
                                  }}
                                  className="w-full text-left rounded-xl p-2.5 hover:bg-[#F3F5FA] transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-900 truncate">
                                      {a.titulo}
                                    </span>
                                    <span
                                      className="rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase shrink-0"
                                      style={{ background: conf.bg, color: conf.text }}
                                    >
                                      {conf.label}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{a.detalle}</p>
                                  {a.monto > 0 && (
                                    <p className="text-[11px] font-bold text-[#3B66F5] mt-0.5 tabular-nums">
                                      {a.monto.toLocaleString('es-AR', {
                                        style: 'currency',
                                        currency: 'ARS',
                                      })}
                                    </p>
                                  )}
                                </button>
                              )
                            })
                          )}
                        </div>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Píldora de Usuario */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setPerfilAbierto((v) => !v)
                      setNotifAbierto(false)
                    }}
                    className="flex items-center gap-2 rounded-full bg-white/90 border border-[#E5E7EB] pl-1.5 pr-3 py-1.5 shadow-[0_4px_16px_rgb(0,0,0,0.03)] hover:bg-white transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#3B66F5] text-white text-[11px] font-bold flex items-center justify-center">
                      {iniciales}
                    </div>
                    <span className="hidden sm:inline text-xs font-semibold text-slate-800 max-w-[110px] truncate">
                      {nombreUsuario}
                    </span>
                    <span className="rounded-md bg-[#F3F5FA] px-1.5 py-0.5 text-[9.5px] font-bold text-[#3B66F5] uppercase">
                      {esAdmin ? 'Admin' : 'Oper'}
                    </span>
                  </button>

                  <AnimatePresence>
                    {perfilAbierto && (
                      <Motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-[#E5E7EB] shadow-xl p-2 z-50"
                      >
                        <div className="px-3 py-2 border-b border-gray-100">
                          <p className="text-xs font-bold text-slate-900 truncate">{user.email}</p>
                          <p className="text-[11px] text-slate-500">
                            {esAdmin ? 'Administrador · Acceso total' : 'Operador'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSeccionActiva('inicio')
                            setPerfilAbierto(false)
                          }}
                          className="w-full text-left px-3 py-2 mt-1 rounded-xl text-xs font-medium text-slate-700 hover:bg-[#F3F5FA]"
                        >
                          Tablero Gerencial
                        </button>
                        {esAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              navegarModulo('usuarios')
                              setPerfilAbierto(false)
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-[#F3F5FA]"
                          >
                            Usuarios y Permisos
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => supabase.auth.signOut()}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Cerrar sesión
                        </button>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </header>

            {/* CONTENIDO PRINCIPAL */}
            <main className="flex-1 min-w-0">
              {seccionActiva === 'inicio' ? (
                <BentoTablero
                  kpis={kpis}
                  metricaPeriodo={metricaPeriodo}
                  alertas={alertas}
                  esAdmin={esAdmin}
                  filtroPeriodo={filtroPeriodo}
                  setFiltroPeriodo={setFiltroPeriodo}
                  actualizandoKpis={actualizandoKpis}
                  onSincronizar={() => {
                    cargarKpis()
                    cargarAlertas()
                  }}
                  onNavegar={navegarModulo}
                  todosItemsDisponibles={todosItemsDisponibles}
                />
              ) : (
                <div className="sg-main overflow-x-auto">
                  {seccionActiva === 'clientes' && <Clientes />}
                  {seccionActiva === 'crm' && <CRM />}
                  {seccionActiva === 'contratos' && <Contratos />}
                  {seccionActiva === 'personal' && <Personal />}
                  {seccionActiva === 'agenda' && <Agenda />}
                  {seccionActiva === 'presupuestos' && <Presupuestos />}
                  {seccionActiva === 'facturacion' && esAdmin && <Facturacion />}
                  {seccionActiva === 'insumos' && <Insumos />}
                  {seccionActiva === 'finanzas' && esAdmin && (
                    <Finanzas vistaInicial={vistaFinanzasInicial} />
                  )}
                  {seccionActiva === 'conciliacion' && esAdmin && (
                    <Finanzas vistaInicial="conciliacion" />
                  )}
                  {seccionActiva === 'costos' && esAdmin && <Costos />}
                  {seccionActiva === 'sueldos' && esAdmin && <Sueldos />}
                  {seccionActiva === 'proveedores' && <Proveedores />}
                  {seccionActiva === 'reportes' && <Reportes />}
                  {seccionActiva === 'usuarios' && esAdmin && <Usuarios />}
                </div>
              )}
            </main>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DRAWER DE NAVEGACIÓN MÓVIL                                   */}
        {/* ============================================================ */}
        <AnimatePresence>
          {menuMovilAbierto && (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuMovilAbierto(false)}
              className="md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex"
            >
              <Motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ duration: 0.22 }}
                onClick={(e) => e.stopPropagation()}
                className="w-72 h-full bg-[#18191C] text-white p-4 flex flex-col justify-between overflow-y-auto"
              >
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <img src="/logo.jpg" alt="Briseo" className="w-8 h-8 rounded-lg bg-white p-0.5" />
                      <div>
                        <p className="text-sm font-bold">BRISEO ERP</p>
                        <p className="text-[11px] text-zinc-400">DAG Group S.R.L.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMenuMovilAbierto(false)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSeccionActiva('inicio')
                        setMenuMovilAbierto(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                        seccionActiva === 'inicio'
                          ? 'bg-[#3B66F5] text-white'
                          : 'text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <Home className="w-4 h-4" />
                      <span>Tablero Gerencial</span>
                    </button>

                    {menuVisible.map((grupo) => (
                      <div key={grupo.label} className="pt-3">
                        <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          {grupo.label}
                        </div>
                        {grupo.items.map((item) => {
                          const Icon = item.icon
                          const activo = seccionActiva === item.id
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => navegarModulo(item.id, 'movimientos')}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium ${
                                activo
                                  ? 'bg-[#3B66F5] text-white'
                                  : 'text-zinc-300 hover:bg-white/10'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{item.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => supabase.auth.signOut()}
                  className="mt-4 w-full py-2.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar sesión</span>
                </button>
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================ */}
        {/* MODAL GLOBAL: COMMAND PALETTE (CTRL + K)                     */}
        {/* ============================================================ */}
        {buscadorAbierto && (
          <div
            onClick={() => setBuscadorAbierto(false)}
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-start justify-center pt-24 px-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden"
            >
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-3">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={queryBusqueda}
                  onChange={(e) => setQueryBusqueda(e.target.value)}
                  placeholder="Escribí para buscar módulo o comando…"
                  className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <span className="rounded-md bg-[#F3F5FA] px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  ESC
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto p-2">
                <div className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                  Módulos de Briseo ERP
                </div>
                {resultadosBusqueda.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No se encontraron módulos con &quot;{queryBusqueda}&quot;
                  </div>
                ) : (
                  resultadosBusqueda.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          navegarModulo(item.id, 'movimientos')
                          setBuscadorAbierto(false)
                          setQueryBusqueda('')
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#F3F5FA] text-left transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#F3F5FA] flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-[#3B66F5]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{item.label}</p>
                            <p className="text-[11px] text-slate-500 truncate">{item.desc}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-[#3B66F5] shrink-0">
                          Abrir →
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  )
}

export default Dashboard
