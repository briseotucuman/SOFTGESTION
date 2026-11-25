import React, { useEffect, useState } from 'react'
import { supabase, emitirCambioDatos } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import {
  TrendingUp, TrendingDown, X, History, ArrowUpRight, ArrowDownRight, Layers,
  DollarSign, Building, AlertCircle, MapPin, ChevronLeft, ChevronRight,
  ChevronDown, AlertTriangle, Trash2, Loader2, RefreshCw, Landmark
} from 'lucide-react'
import {
  calcularResumenCuentasPorCobrar,
  calcularResumenCuentasPorPagar,
  calcularSaldosCuentas,
  esMovimientoAjuste,
  formatearMonedaAR
} from '../finanzasUtils.js'

const MESES = [
  { valor: '01', nombre: 'Enero' },
  { valor: '02', nombre: 'Febrero' },
  { valor: '03', nombre: 'Marzo' },
  { valor: '04', nombre: 'Abril' },
  { valor: '05', nombre: 'Mayo' },
  { valor: '06', nombre: 'Junio' },
  { valor: '07', nombre: 'Julio' },
  { valor: '08', nombre: 'Agosto' },
  { valor: '09', nombre: 'Septiembre' },
  { valor: '10', nombre: 'Octubre' },
  { valor: '11', nombre: 'Noviembre' },
  { valor: '12', nombre: 'Diciembre' },
]

const anioActual = new Date().getFullYear()
const mesActual = String(new Date().getMonth() + 1).padStart(2, '0')
const ANIOS = [anioActual - 3, anioActual - 2, anioActual - 1, anioActual, anioActual + 1]

function indicadorMargen(margen) {
  if (margen >= 30) return { color: '#0F766E', bg: '#F0FDFA', border: '#99F6E4', label: 'Margen Óptimo (≥30%)' }
  if (margen >= 15) return { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', label: 'Margen Aceptable' }
  if (margen > 0)   return { color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', label: 'Margen Ajustado' }
  return { color: '#BE123C', bg: '#FFF1F2', border: '#FECDD3', label: 'Déficit Operativo' }
}

function ultimosNMeses(mesFinal, n) {
  const [y, m] = mesFinal.split('-').map(Number)
  const meses = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return meses
}

function nombreMes(mesStr) {
  const [y, m] = mesStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

// Gráfico comparativo de barras de alta densidad ejecutiva
function GraficoBarras({ meses, serieA, serieB, labelA, labelB, colorA = '#3B66F5', colorB = '#A6BEFF', formatoMoneda = true }) {
  const max = Math.max(...serieA, ...serieB, 1)
  const fmt = (v) => formatoMoneda ? v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : v
  return (
    <div>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', fontSize: '12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '600' }}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: colorA, display: 'inline-block' }} />
          {labelA}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontWeight: '600' }}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: colorB, display: 'inline-block' }} />
          {labelB}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '170px', paddingBottom: '8px', borderBottom: '1px solid #E5E7EB' }}>
        {meses.map((mesStr, i) => (
          <div key={mesStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '130px', width: '100%', justifyContent: 'center' }}>
              <div
                title={`${labelA}: ${fmt(serieA[i])}`}
                style={{ width: '38%', maxWidth: '24px', height: `${Math.max(4, (serieA[i] / max) * 130)}px`, background: colorA, borderRadius: '6px 6px 0 0', transition: 'height 0.3s ease' }}
              />
              <div
                title={`${labelB}: ${fmt(serieB[i])}`}
                style={{ width: '38%', maxWidth: '24px', height: `${Math.max(4, (serieB[i] / max) * 130)}px`, background: colorB, borderRadius: '6px 6px 0 0', transition: 'height 0.3s ease' }}
              />
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'capitalize', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
              {nombreMes(mesStr)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MapaLeaflet({ sucursales }) {
  const mapRef = React.useRef(null)
  const mapInstanceRef = React.useRef(null)

  React.useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
    }

    const loadLeaflet = () => {
      if (window.L) {
        initMap()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
      script.onload = initMap
      document.head.appendChild(script)
    }

    const initMap = () => {
      if (!mapRef.current || mapInstanceRef.current) return
      const L = window.L
      const lats = sucursales.map(s => parseFloat(s.latitud))
      const lngs = sucursales.map(s => parseFloat(s.longitud))
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2

      const map = L.map(mapRef.current).setView([centerLat, centerLng], 12)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)

      sucursales.forEach(suc => {
        const lat = parseFloat(suc.latitud)
        const lng = parseFloat(suc.longitud)
        if (isNaN(lat) || isNaN(lng)) return

        const marker = L.marker([lat, lng]).addTo(map)
        marker.bindPopup(`
          <div style="min-width:200px;font-family:'IBM Plex Sans',Segoe UI,sans-serif;padding:2px">
            <p style="margin:0 0 4px;font-weight:700;font-size:13.5px;color:#0F172A">${suc.nombre}</p>
            <p style="margin:0 0 6px;font-size:12px;color:#0F766E;font-weight:600">${suc.clientes?.razon_social || suc.clientes?.nombre_contacto || ''}</p>
            ${suc.direccion ? `<p style="margin:0 0 2px;font-size:11.5px;color:#475569">${suc.direccion}</p>` : ''}
            ${suc.localidad ? `<p style="margin:0 0 8px;font-size:11.5px;color:#64748B">${suc.localidad}${suc.provincia ? ', ' + suc.provincia : ''}</p>` : ''}
            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="font-size:11.5px;color:#0F766E;font-weight:600;text-decoration:none">Ver ubicación en Google Maps →</a>
          </div>
        `)
      })

      if (sucursales.length > 1) {
        const bounds = L.latLngBounds(sucursales.map(s => [parseFloat(s.latitud), parseFloat(s.longitud)]))
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    }

    loadLeaflet()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [sucursales])

  return <div ref={mapRef} style={{ width: '100%', height: '480px' }} />
}

function Reportes() {
  const [vista, setVista] = useState('general')
  const [sucursalesMapa, setSucursalesMapa] = useState([])
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalContratos: 0,
    totalEmpleados: 0,
    serviciosDelMes: 0,
    ingresosDelMes: 0,
    egresosDelMes: 0,
    facturasPendientes: 0,
    montoFacturasPendientes: 0,
    facturasCompraPendientes: 0,
    montoPorPagar: 0,
    saldoCajaYBancos: 0,
    saldoBancos: 0,
    saldoEfectivo: 0,
    stockBajoMinimo: 0,
    totalCostosFijos: 0,
    totalCostosVariables: 0
  })
  const [rentabilidadClientes, setRentabilidadClientes] = useState([])
  const [gastosPorCategoria, setGastosPorCategoria] = useState([])
  const [evolucionGeneral, setEvolucionGeneral] = useState(null)
  const [clienteEvolucion, setClienteEvolucion] = useState(null)
  const [evolucionClienteData, setEvolucionClienteData] = useState(null)
  const [cobranzasHuerfanas, setCobranzasHuerfanas] = useState([])
  const [depurando, setDepurando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mesNum, setMesNum] = useState(mesActual)
  const [anioNum, setAnioNum] = useState(String(anioActual))
  const mes = `${anioNum}-${mesNum}`

  function cambiarMesRelativo(delta) {
    let y = parseInt(anioNum, 10)
    let m = parseInt(mesNum, 10) + delta
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setAnioNum(String(y))
    setMesNum(String(m).padStart(2, '0'))
  }

  function irAlMesActual() {
    setAnioNum(String(anioActual))
    setMesNum(mesActual)
  }

  async function cargarEvolucionGeneral(setIdsValidos, hasValidFacturas) {
    const meses = ultimosNMeses(mes, 6)
    const { data } = await supabase.from('movimientos_financieros')
      .select('id,fecha,tipo,monto,categoria,descripcion,factura_id')
      .gte('fecha', meses[0] + '-01')
      .lte('fecha', mes + '-' + new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate())

    const setIds = setIdsValidos instanceof Set ? setIdsValidos : new Set()

    const porMes = {}
    meses.forEach(m => { porMes[m] = { ingresos: 0, egresos: 0 } })
    ;(data || []).forEach(mv => {
      if (esMovimientoAjuste(mv)) return
      const key = mv.fecha.slice(0, 7)
      if (!porMes[key]) return

      if (mv.tipo === 'ingreso') {
        if (hasValidFacturas && mv.factura_id && !setIds.has(mv.factura_id)) return
        porMes[key].ingresos += Number(mv.monto)
      } else {
        porMes[key].egresos += Number(mv.monto)
      }
    })
    setEvolucionGeneral({
      meses,
      ingresos: meses.map(m => porMes[m].ingresos),
      egresos: meses.map(m => porMes[m].egresos),
    })
  }

  async function depurarCobranzasHuerfanas() {
    if (!confirm(`¿Eliminar definitivamente todas las cobranzas huérfanas de facturas de venta que fueron eliminadas? Esta acción limpiará la base de datos de movimientos contables y sincronizará Reportes y Finanzas.`)) return
    setDepurando(true)
    try {
      const { data: todasFacts, error: errFacts } = await supabase.from('facturas').select('id, numero_factura')
      if (errFacts || !todasFacts) throw new Error('No se pudo leer las facturas; no se eliminó nada.')
      const setIds = new Set((todasFacts || []).map(f => f.id))

      const { data: todasCobranzas } = await supabase.from('movimientos_financieros')
        .select('id, tipo, factura_id')
        .eq('tipo', 'ingreso')

      const idsBorrar = (todasCobranzas || [])
        .filter(m => m.factura_id && !setIds.has(m.factura_id))
        .map(m => m.id)

      if (idsBorrar.length > 0) {
        for (let i = 0; i < idsBorrar.length; i += 50) {
          const chunk = idsBorrar.slice(i, i + 50)
          const { error } = await supabase.from('movimientos_financieros').delete().in('id', chunk)
          if (error) throw error
        }
      }

      alert(`Se eliminaron con éxito ${idsBorrar.length} cobranza(s) huérfana(s). Los reportes y finanzas quedaron sincronizados y limpios.`)
      await cargarReportes()
      emitirCambioDatos('reportes')
    } catch (err) {
      alert('Error al depurar cobranzas: ' + (err.message || 'Error desconocido'))
    } finally {
      setDepurando(false)
    }
  }

  async function cargarReportes() {
    setLoading(true)
    const { data: sucData } = await supabase.from('sucursales').select('*, clientes(razon_social,nombre_contacto)').eq('activa', true).not('latitud', 'is', null).not('longitud', 'is', null)
    if (sucData) setSucursalesMapa(sucData)

    const ultimoDiaMes = new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()
    const [
      { count: totalClientes },
      { count: totalContratos },
      { count: totalEmpleados },
      { count: serviciosDelMes },
      { data: movimientosMes },
      { data: todasLasFacturas, error: errTodasFacturas },
      { data: pagosVenta },
      { data: facturasCompra },
      { data: pagosCompra },
      { data: cuentasData },
      { data: insumosBajos },
      { data: facturasData },
      { data: costosFijos },
      { data: costosVariables },
      { data: todasCobranzasDb }
    ] = await Promise.all([
      supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('contratos').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      supabase.from('empleados').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('ordenes_trabajo').select('*', { count: 'exact', head: true }).gte('fecha_programada', mes + '-01').lte('fecha_programada', mes + '-' + ultimoDiaMes),
      supabase.from('movimientos_financieros').select('id,tipo,monto,categoria,descripcion,factura_id,fecha').gte('fecha', mes + '-01').lte('fecha', mes + '-' + ultimoDiaMes),
      supabase.from('facturas').select('id, numero_factura, total, estado'),
      supabase.from('pagos').select('id, factura_id, monto, fecha_pago'),
      supabase.from('facturas_compra').select('id, total, estado'),
      supabase.from('pagos_compra').select('factura_compra_id, monto'),
      supabase.from('cuentas_bancarias').select('id, banco, tipo, saldo, activa').eq('activa', true),
      supabase.from('insumos').select('id, stock_actual, stock_minimo').eq('activo', true),
      supabase.from('facturas').select(`total, estado, cliente_id, clientes(id, razon_social, nombre_contacto)`).in('estado', ['pagada', 'parcial', 'cobrada']).gte('fecha_emision', mes + '-01').lte('fecha_emision', mes + '-' + ultimoDiaMes),
      supabase.from('costos_fijos').select('monto').eq('activo', true).eq('mes', mes),
      supabase.from('costos_variables').select('monto, cliente_id, clientes(id, razon_social, nombre_contacto)').gte('fecha', mes + '-01').lte('fecha', mes + '-' + ultimoDiaMes),
      supabase.from('movimientos_financieros').select('id, tipo, factura_id').eq('tipo', 'ingreso')
    ])

    const hasValidFacturas = !errTodasFacturas && Array.isArray(todasLasFacturas)
    const setIds = new Set((todasLasFacturas || []).map(f => f.id))
    const factNumPorId = {}
    ;(todasLasFacturas || []).forEach(f => { factNumPorId[f.id] = f.numero_factura })

    // Solo detectar como huérfanos los movimientos que tienen factura_id apuntando a una factura inexistente
    const huerfanasTotales = hasValidFacturas
      ? (todasCobranzasDb || []).filter(m => m.factura_id && !setIds.has(m.factura_id))
      : []

    // Ya no se borra nada solo al abrir Reportes: si hay cobranzas sin factura se avisa y se depuran
    // a mano con el botón. Si la consulta de facturas no vino completa, no se afirma nada.
    setCobranzasHuerfanas(todasLasFacturas && todasLasFacturas.length > 0 ? huerfanasTotales : [])

    // Excluir huérfanos y movimientos de ajuste de saldo / transferencia interna
    const movimientosValidos = (movimientosMes || []).filter(m => {
      if (esMovimientoAjuste(m)) return false
      if (m.tipo === 'ingreso' && hasValidFacturas && m.factura_id && !setIds.has(m.factura_id)) {
        return false
      }
      return true
    })

    // Reconciliar pagos del mes que no tengan movimiento financiero vinculado
    const facturasConMovMes = new Set()
    movimientosValidos.forEach(m => {
      if (m.tipo !== 'ingreso') return
      if (m.factura_id) facturasConMovMes.add(m.factura_id)
      if (m.descripcion) {
        Object.entries(factNumPorId).forEach(([fid, num]) => {
          if (num && m.descripcion.includes(num)) facturasConMovMes.add(fid)
        })
      }
    })
    const pagosMesSinMov = (pagosVenta || [])
      .filter(p => p?.fecha_pago && String(p.fecha_pago).startsWith(mes) && p.factura_id && !facturasConMovMes.has(p.factura_id))
      .reduce((a, p) => a + Number(p.monto || 0), 0)

    const ingresosDelMes = movimientosValidos.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0) + pagosMesSinMov
    const egresosDelMes = movimientosValidos.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0)

    const resumenCobrar = calcularResumenCuentasPorCobrar(todasLasFacturas || [], pagosVenta || [])
    const resumenPagar = calcularResumenCuentasPorPagar(facturasCompra || [], pagosCompra || [])
    const resumenSaldos = calcularSaldosCuentas(cuentasData || [])

    const totalCostosFijos = (costosFijos || []).reduce((a, c) => a + Number(c.monto), 0)
    const totalCostosVariables = (costosVariables || []).reduce((a, c) => a + Number(c.monto), 0)

    const gastos = {}
    movimientosValidos.filter(m => m.tipo === 'egreso').forEach(m => {
      const cat = (m.categoria || 'otro').replace(/_/g, ' ')
      gastos[cat] = (gastos[cat] || 0) + Number(m.monto)
    })

    const clientesMap = {}
    ;(facturasData || []).forEach(f => {
      const id = f.cliente_id
      const nombre = f.clientes?.razon_social || f.clientes?.nombre_contacto || 'Sin nombre'
      if (!clientesMap[id]) clientesMap[id] = { nombre, ingresos: 0, costos: 0 }
      clientesMap[id].ingresos += Number(f.total)
    })
    ;(costosVariables || []).forEach(cv => {
      const id = cv.cliente_id
      if (id && clientesMap[id]) {
        clientesMap[id].costos += Number(cv.monto)
      } else if (id) {
        const nombre = cv.clientes?.razon_social || cv.clientes?.nombre_contacto || 'Sin nombre'
        if (!clientesMap[id]) clientesMap[id] = { nombre, ingresos: 0, costos: 0 }
        clientesMap[id].costos += Number(cv.monto)
      }
    })

    const rentabilidad = Object.values(clientesMap)
      .map(cl => ({
        ...cl,
        ganancia: cl.ingresos - cl.costos,
        margen: cl.ingresos > 0 ? ((cl.ingresos - cl.costos) / cl.ingresos) * 100 : -100
      }))
      .sort((a, b) => b.ingresos - a.ingresos)

    setStats({
      totalClientes: totalClientes || 0,
      totalContratos: totalContratos || 0,
      totalEmpleados: totalEmpleados || 0,
      serviciosDelMes: serviciosDelMes || 0,
      ingresosDelMes: Math.round(ingresosDelMes * 100) / 100,
      egresosDelMes: Math.round(egresosDelMes * 100) / 100,
      facturasPendientes: resumenCobrar.cantidadPendientes,
      montoFacturasPendientes: resumenCobrar.totalPorCobrar,
      facturasCompraPendientes: resumenPagar.cantidadPendientes,
      montoPorPagar: resumenPagar.totalPorPagar,
      saldoCajaYBancos: resumenSaldos.totalCajaYBancos,
      saldoBancos: resumenSaldos.totalBancos,
      saldoEfectivo: resumenSaldos.totalEfectivo,
      stockBajoMinimo: (insumosBajos || []).filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)).length,
      totalCostosFijos,
      totalCostosVariables
    })
    setRentabilidadClientes(rentabilidad)
    setGastosPorCategoria(Object.entries(gastos).map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto))
    setLoading(false)
    cargarEvolucionGeneral(setIds, hasValidFacturas)
  }

  useEffect(() => {
    let cancel = false
    Promise.resolve().then(() => {
      if (!cancel) {
        cargarReportes()
      }
    })
    return () => {
      cancel = true
    }
  }, [mes])

  async function verEvolucionCliente(clienteId, nombre) {
    setClienteEvolucion({ id: clienteId, nombre })
    setEvolucionClienteData(null)
    const meses = ultimosNMeses(mes, 6)
    const desde = meses[0] + '-01'
    const hasta = mes + '-' + new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()
    const [{ data: fact }, { data: cv }] = await Promise.all([
      supabase.from('facturas').select('total,fecha_emision,estado').eq('cliente_id', clienteId).in('estado', ['pagada', 'parcial', 'cobrada']).gte('fecha_emision', desde).lte('fecha_emision', hasta),
      supabase.from('costos_variables').select('monto,fecha').eq('cliente_id', clienteId).gte('fecha', desde).lte('fecha', hasta),
    ])
    const porMes = {}
    meses.forEach(m => { porMes[m] = { ingresos: 0, costos: 0 } })
    ;(fact || []).forEach(f => { const k = f.fecha_emision.slice(0, 7); if (porMes[k]) porMes[k].ingresos += Number(f.total) })
    ;(cv || []).forEach(c => { const k = c.fecha.slice(0, 7); if (porMes[k]) porMes[k].costos += Number(c.monto) })
    setEvolucionClienteData({
      meses,
      ingresos: meses.map(m => porMes[m].ingresos),
      costos: meses.map(m => porMes[m].costos),
    })
  }

  const balance = stats.ingresosDelMes - stats.egresosDelMes
  const maxIngreso = Math.max(...rentabilidadClientes.map(r => r.ingresos), 1)

  return (
    <div style={{ fontFamily: paleta.font, color: paleta.ink }}>

      {/* ENCABEZADO EJECUTIVO BENTO */}
      <div style={{
        background: 'linear-gradient(135deg, #18191C 0%, #262930 100%)',
        borderRadius: '20px',
        padding: '20px 24px',
        marginBottom: '20px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 12px 32px -12px rgba(24, 25, 28, 0.25)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <TrendingUp size={17} color="#A6BEFF" />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#A6BEFF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              MÓDULO DE INTELIGENCIA DE NEGOCIOS
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Reportes y Métricas Gerenciales
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'rgba(255,255,255,0.68)' }}>
            Análisis de rentabilidad por cuenta, balance financiero consolidado y seguimiento de costos.
          </p>
        </div>

        {/* SELECTOR DE PERÍODO: MES Y AÑO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Botón Mes Anterior */}
          <button
            type="button"
            onClick={() => cambiarMesRelativo(-1)}
            title="Mes anterior"
            style={{
              background: '#26282E',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '999px',
              color: '#E2E8F0',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
          >
            <ChevronLeft size={15} />
          </button>

          {/* Selector de Mes */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={mesNum}
              onChange={e => setMesNum(e.target.value)}
              aria-label="Seleccionar Mes"
              style={{
                backgroundColor: '#26282E',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: '999px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '600',
                padding: '7px 32px 7px 14px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: paleta.font,
                appearance: 'none',
                WebkitAppearance: 'none',
                colorScheme: 'dark'
              }}
            >
              {MESES.map(m => (
                <option key={m.valor} value={m.valor} style={{ backgroundColor: '#18191C', color: '#FFFFFF' }}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <ChevronDown size={14} color="#A6BEFF" style={{ position: 'absolute', right: '11px', pointerEvents: 'none' }} />
          </div>

          {/* Selector de Año */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={anioNum}
              onChange={e => setAnioNum(e.target.value)}
              aria-label="Seleccionar Año"
              style={{
                backgroundColor: '#26282E',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: '999px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '600',
                padding: '7px 30px 7px 14px',
                outline: 'none',
                cursor: 'pointer',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: paleta.font,
                appearance: 'none',
                WebkitAppearance: 'none',
                colorScheme: 'dark'
              }}
            >
              {ANIOS.map(a => (
                <option key={a} value={String(a)} style={{ backgroundColor: '#18191C', color: '#FFFFFF' }}>
                  {a}
                </option>
              ))}
            </select>
            <ChevronDown size={14} color="#A6BEFF" style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }} />
          </div>

          {/* Botón Mes Siguiente */}
          <button
            type="button"
            onClick={() => cambiarMesRelativo(1)}
            title="Mes siguiente"
            style={{
              background: '#26282E',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '999px',
              color: '#E2E8F0',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
          >
            <ChevronRight size={15} />
          </button>

          {/* Botón Volver a Mes Actual */}
          {(mesNum !== mesActual || anioNum !== String(anioActual)) && (
            <button
              type="button"
              onClick={irAlMesActual}
              title="Volver al período en curso"
              style={{
                background: 'rgba(166, 190, 255, 0.16)',
                border: '1px solid rgba(166, 190, 255, 0.35)',
                borderRadius: '999px',
                color: '#A6BEFF',
                fontSize: '12px',
                fontWeight: '600',
                padding: '7px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              Mes Actual
            </button>
          )}

          {/* Botón Sincronizar / Refrescar */}
          <button
            type="button"
            onClick={() => cargarReportes()}
            title="Recalcular métricas y sincronizar con la base de datos"
            style={{
              background: '#3B66F5',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '999px',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: '600',
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 6px 16px -6px rgba(59, 102, 245, 0.5)'
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Sincronizar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '60px 20px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
          <p style={{ color: '#0F172A', fontSize: '14px', fontWeight: '600', margin: 0 }}>Consolidando reportes del período…</p>
          <p style={{ color: '#64748B', fontSize: '12px', margin: '4px 0 0' }}>Procesando movimientos contables y órdenes asignadas</p>
        </div>
      ) : (
        <>
          {/* AVISO DE COBRANZAS HUÉRFANAS DETECTADAS */}
          {cobranzasHuerfanas.length > 0 && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderLeft: '4px solid #DC2626',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 1px 3px 0 rgba(220, 38, 38, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '75%' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <AlertTriangle size={20} color="#DC2626" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#991B1B' }}>
                    Sincronización de Cobranzas: Se detectaron {cobranzasHuerfanas.length} cobranza(s) registrada(s) de facturas que fueron eliminadas
                  </h4>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#7F1D1D' }}>
                    Las métricas de este reporte ya están limpias y no computan estas cobranzas. Hacé clic para eliminarlas definitivamente de la base de datos y mantener Finanzas sincronizado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={depurarCobranzasHuerfanas}
                disabled={depurando}
                style={{
                  ...s.btnPeligro,
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: depurando ? 'not-allowed' : 'pointer'
                }}
              >
                {depurando ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Depurar {cobranzasHuerfanas.length} cobranza(s) huérfana(s)
              </button>
            </div>
          )}
          {/* AVISO DE CONTROL OPERATIVO SI HAY STOCK CRÍTICO */}
          {stats.stockBajoMinimo > 0 && (
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderLeft: '4px solid #B45309',
              borderRadius: '6px',
              padding: '10px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={16} color="#B45309" />
              <span style={{ color: '#92400E', fontSize: '12.5px', fontWeight: '600' }}>
                Atención Operativa: {stats.stockBajoMinimo} insumo(s) se encuentran por debajo del stock mínimo de seguridad.
              </span>
            </div>
          )}

          {/* SELECTOR SEGMENTADO DE VISTAS (PÍLDORAS BENTO) */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid #E5E7EB',
            borderRadius: '999px',
            padding: '4px',
            display: 'inline-flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginBottom: '20px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
          }}>
            {[
              { id: 'general', label: 'Resumen Ejecutivo' },
              { id: 'rentabilidad', label: 'Rentabilidad por Cliente' },
              { id: 'costos', label: 'Estructura de Costos' },
              { id: 'mapa', label: 'Distribución Geográfica' }
            ].map(tab => {
              const activa = vista === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setVista(tab.id)}
                  style={{
                    background: activa ? '#18191C' : 'transparent',
                    color: activa ? '#FFFFFF' : '#64748B',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.14s ease'
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* ============================================================ */}
          {/* 1. VISTA GENERAL / RESUMEN EJECUTIVO */}
          {/* ============================================================ */}
          {vista === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* GRID DE MÉTRICAS BENTO */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                {[
                  { label: 'Ingresos Cobrados', valor: stats.ingresosDelMes, tipo: 'dinero', theme: 'blue', sub: 'Ingresos operativos del mes' },
                  { label: 'Egresos Totales', valor: stats.egresosDelMes, tipo: 'dinero', theme: 'light', sub: 'Gastos operativos e impuestos' },
                  { label: 'Resultado Neto del Mes', valor: balance, tipo: 'dinero', theme: 'light', sub: balance >= 0 ? 'Superávit mensual' : 'Déficit mensual' },
                  { label: 'Caja + Bancos a la Fecha', valor: stats.saldoCajaYBancos, tipo: 'dinero', theme: 'dark', sub: `Bancos: ${formatearMonedaAR(stats.saldoBancos)} · Efec.: ${formatearMonedaAR(stats.saldoEfectivo)}` },
                  { label: 'Cuentas por Cobrar', valor: stats.montoFacturasPendientes, tipo: 'dinero', theme: 'light', sub: `${stats.facturasPendientes} facturas pendientes` },
                  { label: 'Cuentas por Pagar', valor: stats.montoPorPagar, tipo: 'dinero', theme: 'light', sub: `${stats.facturasCompraPendientes} comprobantes pendientes` },
                  { label: 'Clientes / Contratos', valor: `${stats.totalClientes} / ${stats.totalContratos}`, tipo: 'texto', theme: 'light', sub: 'Empresas y acuerdos activos' },
                  { label: 'Personal / Órdenes', valor: `${stats.totalEmpleados} / ${stats.serviciosDelMes}`, tipo: 'texto', theme: 'light', sub: 'Operarios · Servicios del mes' },
                ].map((k, i) => {
                  const isBlue = k.theme === 'blue'
                  const isDark = k.theme === 'dark'
                  return (
                    <div
                      key={i}
                      style={{
                        background: isBlue ? '#3B66F5' : isDark ? '#18191C' : '#FFFFFF',
                        color: (isBlue || isDark) ? '#FFFFFF' : '#0F172A',
                        borderRadius: '18px',
                        padding: '18px 20px',
                        border: (isBlue || isDark) ? '1px solid rgba(255,255,255,0.12)' : '1px solid #E5E7EB',
                        boxShadow: isBlue
                          ? '0 12px 30px rgba(59, 102, 245, 0.22)'
                          : isDark
                            ? '0 12px 30px rgba(24, 25, 28, 0.2)'
                            : '0 8px 30px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: (isBlue || isDark) ? 'rgba(255,255,255,0.78)' : '#64748B',
                        }}>
                          {k.label}
                        </span>
                        <p style={{
                          margin: '8px 0 0',
                          fontSize: k.tipo === 'dinero' ? '22px' : '26px',
                          fontWeight: '700',
                          color: (isBlue || isDark) ? '#FFFFFF' : '#0F172A',
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.02em'
                        }}>
                          {k.tipo === 'dinero' ? formatearMonedaAR(k.valor) : k.valor}
                        </p>
                      </div>
                      <span style={{
                        fontSize: '11.5px',
                        color: (isBlue || isDark) ? 'rgba(255,255,255,0.72)' : '#64748B',
                        marginTop: '10px',
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {k.sub}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* GRÁFICOS Y DESGLOSES EN 2 COLUMNAS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>

                {/* TOP CLIENTES POR FACTURACIÓN */}
                <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '22px', border: '1px solid #E5E7EB', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <h4 style={{ margin: 0, color: '#0F172A', fontWeight: '700', fontSize: '14.5px' }}>
                      Mayores Cuentas por Facturación
                    </h4>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                      Top 6 Clientes
                    </span>
                  </div>

                  {rentabilidadClientes.length === 0 ? (
                    <p style={{ color: '#94A3B8', textAlign: 'center', padding: '36px 0', fontSize: '13px' }}>
                      Sin facturas cobradas en el período seleccionado.
                    </p>
                  ) : (
                    rentabilidadClientes.slice(0, 6).map((cl, i) => (
                      <div key={i} style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                          <span style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>
                            {i + 1}. {cl.nombre}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                            {cl.ingresos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div style={{ background: '#F3F5FA', borderRadius: '999px', height: '7px', overflow: 'hidden' }}>
                          <div
                            style={{
                              background: i === 0 ? '#3B66F5' : '#A6BEFF',
                              height: '7px',
                              borderRadius: '999px',
                              width: `${(cl.ingresos / maxIngreso) * 100}%`,
                              transition: 'width 0.4s ease'
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* EGRESOS POR CATEGORÍA */}
                <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '22px', border: '1px solid #E5E7EB', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <h4 style={{ margin: 0, color: '#0F172A', fontWeight: '700', fontSize: '14.5px' }}>
                      Distribución de Egresos por Rubro
                    </h4>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                      {gastosPorCategoria.length} categorías
                    </span>
                  </div>

                  {gastosPorCategoria.length === 0 ? (
                    <p style={{ color: '#94A3B8', textAlign: 'center', padding: '36px 0', fontSize: '13px' }}>
                      Sin egresos registrados en el período seleccionado.
                    </p>
                  ) : (
                    gastosPorCategoria.map((g, i) => (
                      <div key={i} style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                          <span style={{ fontSize: '13px', color: '#334155', fontWeight: '600', textTransform: 'capitalize' }}>
                            {g.categoria}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                            {g.monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div style={{ background: '#F3F5FA', borderRadius: '999px', height: '7px', overflow: 'hidden' }}>
                          <div
                            style={{
                              background: i === 0 ? '#18191C' : '#64748B',
                              height: '7px',
                              borderRadius: '999px',
                              width: `${(g.monto / (gastosPorCategoria[0]?.monto || 1)) * 100}%`,
                              transition: 'width 0.4s ease'
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* 2. VISTA RENTABILIDAD POR CLIENTE */}
          {/* ============================================================ */}
          {vista === 'rentabilidad' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* CRITERIO CONTABLE DE RENTABILIDAD */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '18px',
                padding: '14px 18px',
                fontSize: '12.5px',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUp size={15} color="#3B66F5" />
                </div>
                <span>
                  <strong>Criterio de Costeo Operativo:</strong> La rentabilidad por cuenta se determina deduciendo de las facturas cobradas en el mes los costos directos asignados (horas de mano de obra e insumos directos consumidos).
                </span>
              </div>

              {/* HISTÓRICO SEMESTRAL DE MOVIMIENTOS */}
              {evolucionGeneral && (
                <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '22px', border: '1px solid #E5E7EB', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <History size={16} color="#3B66F5" />
                    <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '700', color: '#0F172A' }}>
                      Evolución Consolidada — Últimos 6 Meses
                    </h4>
                  </div>
                  <GraficoBarras
                    meses={evolucionGeneral.meses}
                    serieA={evolucionGeneral.ingresos}
                    serieB={evolucionGeneral.egresos}
                    labelA="Ingresos Percibidos"
                    labelB="Egresos y Pagos"
                    colorA="#3B66F5"
                    colorB="#A6BEFF"
                  />
                </div>
              )}

              {/* TOTALES DEL CUADRO DE RENTABILIDAD */}
              {rentabilidadClientes.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  <div style={{ background: '#3B66F5', color: '#FFFFFF', borderRadius: '18px', padding: '18px 20px', boxShadow: '0 12px 30px rgba(59, 102, 245, 0.2)' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>Facturación Imputada</span>
                    <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                      {rentabilidadClientes.reduce((a, c) => a + c.ingresos, 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '18px 20px', border: '1px solid #E5E7EB', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Costos Directos Asignados</span>
                    <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                      {rentabilidadClientes.reduce((a, c) => a + c.costos, 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div style={{ background: '#18191C', color: '#FFFFFF', borderRadius: '18px', padding: '18px 20px', boxShadow: '0 12px 30px rgba(24, 25, 28, 0.18)' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}>Margen Bruto Total</span>
                    <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                      {rentabilidadClientes.reduce((a, c) => a + c.ganancia, 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              )}

              {/* TABLA DE RENTABILIDAD POR CUENTA */}
              <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                {rentabilidadClientes.length === 0 ? (
                  <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B', fontSize: '13.5px' }}>
                    Sin datos computables para este período. Cargá facturas cobradas y costos variables para ver el desglose.
                  </div>
                ) : (
                  <table style={s.tabla}>
                    <thead>
                      <tr>
                        <th style={s.tablaCabecera()}>Cliente / Cuenta</th>
                        <th style={{ ...s.tablaCabecera(), textAlign: 'right' }}>Ingresos Cobrados</th>
                        <th style={{ ...s.tablaCabecera(), textAlign: 'right' }}>Costos Directos</th>
                        <th style={{ ...s.tablaCabecera(), textAlign: 'right' }}>Margen Bruto</th>
                        <th style={{ ...s.tablaCabecera(), textAlign: 'center', width: '160px' }}>Margen %</th>
                        <th style={{ ...s.tablaCabecera(), textAlign: 'center' }}>Calificación</th>
                        <th style={{ ...s.tablaCabecera(), textAlign: 'center', width: '120px' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rentabilidadClientes.map((cl, i) => {
                        const ind = indicadorMargen(cl.margen)
                        return (
                          <tr key={i} style={s.tablaFila(i)}>
                            <td style={s.tablaCellBold}>{cl.nombre}</td>
                            <td style={{ ...s.tablaCell, textAlign: 'right', fontFamily: paleta.fontMono, color: '#0F172A', fontWeight: '600' }}>
                              {cl.ingresos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ ...s.tablaCell, textAlign: 'right', fontFamily: paleta.fontMono, color: '#64748B' }}>
                              {cl.costos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                            </td>
                            <td style={{
                              ...s.tablaCell,
                              textAlign: 'right',
                              fontFamily: paleta.fontMono,
                              fontWeight: '700',
                              color: cl.ganancia >= 0 ? '#0F766E' : '#BE123C'
                            }}>
                              {cl.ganancia >= 0 ? '+' : ''}{cl.ganancia.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ ...s.tablaCell, textAlign: 'center' }}>
                              <div style={{ display: 'inline-block', width: '100%' }}>
                                <span style={{ fontFamily: paleta.fontMono, fontSize: '11.5px', fontWeight: '700', color: ind.color }}>
                                  {cl.margen.toFixed(1)}%
                                </span>
                                <div style={{ background: '#E2E8F0', borderRadius: '4px', height: '5px', marginTop: '4px', width: '100%' }}>
                                  <div style={{
                                    background: ind.color,
                                    height: '5px',
                                    borderRadius: '4px',
                                    width: `${Math.max(0, Math.min(cl.margen, 100))}%`,
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ ...s.tablaCell, textAlign: 'center' }}>
                              <span style={{
                                background: ind.bg,
                                color: ind.color,
                                border: `1px solid ${ind.border}`,
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                letterSpacing: '0.02em'
                              }}>
                                {ind.label}
                              </span>
                            </td>
                            <td style={{ ...s.tablaCell, textAlign: 'center' }}>
                              <button
                                style={{
                                  background: '#F3F5FA',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '999px',
                                  padding: '5px 12px',
                                  fontSize: '11.5px',
                                  fontWeight: '600',
                                  color: '#18191C',
                                  cursor: 'pointer'
                                }}
                                onClick={() => verEvolucionCliente(cl.id, cl.nombre)}
                              >
                                Ver Histórico
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
          )}

          {/* ============================================================ */}
          {/* 3. VISTA ESTRUCTURA DE COSTOS */}
          {/* ============================================================ */}
          {vista === 'costos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* CARDS RESUMEN DE COSTOS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '18px 20px', border: '1px solid #E5E7EB', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>
                    Costos Fijos Operativos
                  </span>
                  <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                    {stats.totalCostosFijos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748B' }}>Alquileres, seguros, abonos y servicios fijos</p>
                </div>

                <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '18px 20px', border: '1px solid #E5E7EB', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>
                    Costos Variables Asignados
                  </span>
                  <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                    {stats.totalCostosVariables.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748B' }}>Mano de obra directa e insumos consumidos</p>
                </div>

                <div style={{ background: '#18191C', color: '#FFFFFF', borderRadius: '18px', padding: '18px 20px', boxShadow: '0 12px 30px rgba(24, 25, 28, 0.18)' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}>
                    Costo Operativo Consolidado
                  </span>
                  <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                    {(stats.totalCostosFijos + stats.totalCostosVariables).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.68)' }}>Suma de costos fijos y variables del período</p>
                </div>
              </div>

              {/* RELACIÓN INGRESOS VS COSTOS */}
              <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '22px', border: '1px solid #E5E7EB', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                <h4 style={{ margin: '0 0 16px', color: '#0F172A', fontWeight: '700', fontSize: '14.5px' }}>
                  Análisis de Rendimiento: Ingresos vs Costos Consolidados
                </h4>
                {(() => {
                  const totalCostos = stats.totalCostosFijos + stats.totalCostosVariables
                  const gananciaReal = stats.ingresosDelMes - totalCostos
                  const margenReal = stats.ingresosDelMes > 0 ? (gananciaReal / stats.ingresosDelMes) * 100 : 0
                  const ind = indicadorMargen(margenReal)
                  return (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '22px' }}>
                        {[
                          { label: 'Ingresos Facturados', valor: stats.ingresosDelMes, color: '#3B66F5' },
                          { label: 'Estructura de Costos', valor: totalCostos, color: '#334155' },
                          { label: 'Resultado Operativo', valor: gananciaReal, color: gananciaReal >= 0 ? '#15803D' : '#BE123C' },
                          { label: 'Margen Neto', valor: margenReal, color: ind.color, tipo: 'porcentaje' },
                        ].map((k, i) => (
                          <div key={i} style={{ background: '#F3F5FA', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '14px 16px' }}>
                            <p style={{ margin: 0, fontSize: '11.5px', color: '#64748B', fontWeight: '600' }}>{k.label}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '19px', fontWeight: '700', color: k.color, fontVariantNumeric: 'tabular-nums' }}>
                              {k.tipo === 'porcentaje' ? k.valor.toFixed(1) + '%' : k.valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12.5px', color: '#334155', fontWeight: '600' }}>
                        <span>Margen Operativo sobre Ingresos</span>
                        <span style={{ color: ind.color, fontVariantNumeric: 'tabular-nums' }}>
                          {ind.label} — {margenReal.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ background: '#F3F5FA', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
                        <div style={{
                          background: ind.color,
                          height: '10px',
                          borderRadius: '999px',
                          width: `${Math.max(0, Math.min(margenReal, 100))}%`,
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
                        <span>0% Mínimo</span>
                        <span>Objetivo de Rentabilidad: 30%+</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )
                })()}
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* 4. VISTA MAPA DE SUCURSALES */}
          {/* ============================================================ */}
          {vista === 'mapa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '18px',
                padding: '14px 18px',
                fontSize: '12.5px',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
              }}>
                <MapPin size={16} color="#3B66F5" />
                <span>
                  Geolocalización de servicios activos. Las coordenadas se configuran en el módulo de <strong>Clientes → Sucursales</strong>.
                </span>
              </div>

              {sucursalesMapa.length === 0 ? (
                <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '48px 20px', textAlign: 'center', border: '1px solid #E5E7EB', color: '#64748B', fontSize: '13.5px' }}>
                  No se detectaron sucursales con coordenadas geográficas cargadas.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                    {sucursalesMapa.map((suc, i) => (
                      <div key={i} style={{ background: '#FFFFFF', borderRadius: '18px', padding: '16px 18px', border: '1px solid #E5E7EB', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                        <p style={{ margin: '0 0 3px', fontWeight: '700', color: '#0F172A', fontSize: '13.5px' }}>{suc.nombre}</p>
                        <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#3B66F5', fontWeight: '600' }}>
                          {suc.clientes?.razon_social || suc.clientes?.nombre_contacto || 'Cliente'}
                        </p>
                        {suc.direccion && <p style={{ margin: '0 0 2px', fontSize: '11.5px', color: '#475569' }}>{suc.direccion}</p>}
                        {suc.localidad && <p style={{ margin: '0 0 8px', fontSize: '11.5px', color: '#64748B' }}>{suc.localidad}{suc.provincia ? ', ' + suc.provincia : ''}</p>}
                        <a
                          href={`https://www.google.com/maps?q=${suc.latitud},${suc.longitud}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '11.5px', color: '#3B66F5', textDecoration: 'none', fontWeight: '600' }}
                        >
                          Ver en Google Maps →
                        </a>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #E5E7EB', background: '#F3F5FA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>
                        Plano Geoespacial de Cobertura ({sucursalesMapa.length} puntos)
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        Leaflet OpenStreetMap Engine
                      </span>
                    </div>
                    <MapaLeaflet sucursales={sucursalesMapa} />
                  </div>
                </>
              )}
            </div>
          )}

        </>
      )}

      {/* MODAL DE HISTÓRICO / EVOLUCIÓN POR CLIENTE */}
      {clienteEvolucion && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '22px',
            padding: '24px',
            width: '100%',
            maxWidth: '580px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #E5E7EB'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #E5E7EB' }}>
              <div>
                <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#3B66F5' }}>Historial Semestral</span>
                <h4 style={{ margin: '2px 0 0', fontWeight: '700', color: '#0F172A', fontSize: '16px' }}>
                  {clienteEvolucion.nombre}
                </h4>
              </div>
              <button
                onClick={() => setClienteEvolucion(null)}
                style={{ background: '#F3F5FA', border: 'none', borderRadius: '999px', cursor: 'pointer', color: '#64748B', padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {!evolucionClienteData ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                Consultando histórico de facturas y costos…
              </div>
            ) : (
              <>
                <GraficoBarras
                  meses={evolucionClienteData.meses}
                  serieA={evolucionClienteData.ingresos}
                  serieB={evolucionClienteData.costos}
                  labelA="Facturación Percibida"
                  labelB="Costos Directos"
                  colorA="#3B66F5"
                  colorB="#A6BEFF"
                />
                <p style={{ marginTop: '16px', fontSize: '11.5px', color: '#64748B', lineHeight: '1.5' }}>
                  Registros correspondientes a los últimos 6 meses hasta {nombreMes(mes)}. Los períodos sin actividad se grafican en cero.
                </p>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

export default Reportes
