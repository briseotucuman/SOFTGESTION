import React, { useEffect, useState } from 'react'
import { supabase, emitirCambioDatos } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import {
  TrendingUp, X, History, ArrowUpRight, ArrowDownRight, Layers,
  DollarSign, Building, AlertCircle, MapPin, ChevronLeft, ChevronRight,
  ChevronDown, AlertTriangle, Trash2, Loader2, RefreshCw
} from 'lucide-react'

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
function GraficoBarras({ meses, serieA, serieB, labelA, labelB, colorA = '#0F172A', colorB = '#64748B', formatoMoneda = true }) {
  const max = Math.max(...serieA, ...serieB, 1)
  const fmt = (v) => formatoMoneda ? v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : v
  return (
    <div>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', fontSize: '12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '600' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: colorA, display: 'inline-block' }} />
          {labelA}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontWeight: '600' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: colorB, display: 'inline-block' }} />
          {labelB}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '170px', paddingBottom: '8px', borderBottom: '1px solid #E2E8F0' }}>
        {meses.map((mesStr, i) => (
          <div key={mesStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '130px', width: '100%', justifyContent: 'center' }}>
              <div
                title={`${labelA}: ${fmt(serieA[i])}`}
                style={{ width: '38%', maxWidth: '24px', height: `${Math.max(3, (serieA[i] / max) * 130)}px`, background: colorA, borderRadius: '2px 2px 0 0', transition: 'height 0.3s ease' }}
              />
              <div
                title={`${labelB}: ${fmt(serieB[i])}`}
                style={{ width: '38%', maxWidth: '24px', height: `${Math.max(3, (serieB[i] / max) * 130)}px`, background: colorB, borderRadius: '2px 2px 0 0', transition: 'height 0.3s ease' }}
              />
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'capitalize', fontWeight: '500', fontFamily: paleta.fontMono }}>
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

  async function cargarEvolucionGeneral(setIdsValidos, setNumsValidos) {
    const meses = ultimosNMeses(mes, 6)
    const { data } = await supabase.from('movimientos_financieros')
      .select('id,fecha,tipo,monto,categoria,descripcion,factura_id')
      .gte('fecha', meses[0] + '-01')
      .lte('fecha', mes + '-' + new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate())

    const setIds = setIdsValidos instanceof Set ? setIdsValidos : new Set()
    const setNums = setNumsValidos instanceof Set ? setNumsValidos : new Set()

    const porMes = {}
    meses.forEach(m => { porMes[m] = { ingresos: 0, egresos: 0 } })
    ;(data || []).forEach(mv => {
      const key = mv.fecha.slice(0, 7)
      if (!porMes[key]) return

      if (mv.tipo === 'ingreso') {
        const esCobranza = mv.categoria === 'Cobranzas' || (mv.descripcion && mv.descripcion.toLowerCase().includes('cobro factura')) || mv.factura_id
        if (esCobranza) {
          // Si no hay facturas activas, o la factura fue eliminada, es huérfana -> NO computar
          const tieneFacturaValida = (mv.factura_id && setIds.has(mv.factura_id)) ||
            (setNums.size > 0 && Array.from(setNums).some(num => mv.descripcion && mv.descripcion.includes(num)))
          if (!tieneFacturaValida) return
        }
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
      const { data: todasFacts } = await supabase.from('facturas').select('id, numero_factura')
      const setIds = new Set((todasFacts || []).map(f => f.id))
      const setNums = new Set((todasFacts || []).map(f => f.numero_factura).filter(Boolean))

      const { data: todasCobranzas } = await supabase.from('movimientos_financieros')
        .select('id, tipo, categoria, descripcion, factura_id')
        .eq('tipo', 'ingreso')

      const idsBorrar = (todasCobranzas || []).filter(m => {
        const esCobranza = m.categoria === 'Cobranzas' || (m.descripcion && m.descripcion.toLowerCase().includes('cobro factura')) || m.factura_id
        if (!esCobranza) return false
        const tieneValida = (m.factura_id && setIds.has(m.factura_id)) ||
          (setNums.size > 0 && Array.from(setNums).some(num => m.descripcion && m.descripcion.includes(num)))
        return !tieneValida
      }).map(m => m.id)

      if (idsBorrar.length > 0) {
        for (let i = 0; i < idsBorrar.length; i += 50) {
          const chunk = idsBorrar.slice(i, i + 50)
          const { error } = await supabase.from('movimientos_financieros').delete().in('id', chunk)
          if (error) throw error
        }
      }

      // También depurar pagos si no hay facturas
      if (setIds.size === 0) {
        try {
          await supabase.from('pagos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        } catch (e) {
          console.warn('Pagos cleanup notice:', e)
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

    const [
      { count: totalClientes },
      { count: totalContratos },
      { count: totalEmpleados },
      { count: serviciosDelMes },
      { data: movimientosMes },
      { data: facturasPendientes },
      { data: insumosBajos },
      { data: facturasData },
      { data: costosFijos },
      { data: costosVariables },
      { data: todasLasFacturas },
      { data: todasCobranzasDb }
    ] = await Promise.all([
      supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('contratos').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      supabase.from('empleados').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('ordenes_trabajo').select('*', { count: 'exact', head: true }).gte('fecha_programada', mes + '-01').lte('fecha_programada', mes + '-' + new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()),
      supabase.from('movimientos_financieros').select('id,tipo,monto,categoria,descripcion,factura_id,fecha').gte('fecha', mes + '-01').lte('fecha', mes + '-' + new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()),
      supabase.from('facturas').select('total').in('estado', ['pendiente', 'parcial', 'vencida']),
      supabase.from('insumos').select('id, stock_actual, stock_minimo').eq('activo', true),
      supabase.from('facturas').select(`total, estado, cliente_id, clientes(id, razon_social, nombre_contacto)`).in('estado', ['pagada', 'parcial', 'cobrada']).gte('fecha_emision', mes + '-01').lte('fecha_emision', mes + '-' + new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()),
      supabase.from('costos_fijos').select('monto').eq('activo', true).eq('mes', mes),
      supabase.from('costos_variables').select('monto, cliente_id, clientes(id, razon_social, nombre_contacto)').gte('fecha', mes + '-01').lte('fecha', mes + '-' + new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()),
      supabase.from('facturas').select('id, numero_factura'),
      supabase.from('movimientos_financieros').select('id, tipo, categoria, descripcion, factura_id').eq('tipo', 'ingreso')
    ])

    const setIds = new Set((todasLasFacturas || []).map(f => f.id))
    const setNums = new Set((todasLasFacturas || []).map(f => f.numero_factura).filter(Boolean))

    // Detección exhaustiva de cobranzas huérfanas en toda la base de datos
    const huerfanasTotales = (todasCobranzasDb || []).filter(m => {
      const esCobranza = m.categoria === 'Cobranzas' || (m.descripcion && m.descripcion.toLowerCase().includes('cobro factura')) || m.factura_id
      if (!esCobranza) return false
      const tieneValida = (m.factura_id && setIds.has(m.factura_id)) ||
        (setNums.size > 0 && Array.from(setNums).some(num => m.descripcion && m.descripcion.includes(num)))
      return !tieneValida
    })

    if (huerfanasTotales.length > 0) {
      const idsBorrar = huerfanasTotales.map(m => m.id)
      for (let i = 0; i < idsBorrar.length; i += 50) {
        supabase.from('movimientos_financieros').delete().in('id', idsBorrar.slice(i, i + 50)).then(() => {})
      }
      if (setIds.size === 0) {
        supabase.from('pagos').delete().neq('id', '00000000-0000-0000-0000-000000000000').then(() => {})
      }
    }

    setCobranzasHuerfanas([])

    // Filtrar movimientos del mes para excluir cobranzas de facturas ya eliminadas
    const movimientosValidos = (movimientosMes || []).filter(m => {
      if (m.tipo === 'ingreso') {
        const esCobranza = m.categoria === 'Cobranzas' || (m.descripcion && m.descripcion.toLowerCase().includes('cobro factura')) || m.factura_id
        if (esCobranza) {
          const tieneValida = (m.factura_id && setIds.has(m.factura_id)) ||
            (setNums.size > 0 && Array.from(setNums).some(num => m.descripcion && m.descripcion.includes(num)))
          if (!tieneValida) return false // No computar si su factura fue eliminada
        }
      }
      return true
    })

    const ingresosDelMes = movimientosValidos.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0)
    const egresosDelMes = movimientosValidos.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0)
    const montoFacturasPendientes = (facturasPendientes || []).reduce((a, f) => a + Number(f.total), 0)
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
      ingresosDelMes,
      egresosDelMes,
      facturasPendientes: (facturasPendientes || []).length,
      montoFacturasPendientes,
      stockBajoMinimo: (insumosBajos || []).filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)).length,
      totalCostosFijos,
      totalCostosVariables
    })
    setRentabilidadClientes(rentabilidad)
    setGastosPorCategoria(Object.entries(gastos).map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto))
    setLoading(false)
    cargarEvolucionGeneral(setIds, setNums)
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

      {/* ENCABEZADO EJECUTIVO / BUSINESS INTELLIGENCE */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: '10px',
        padding: '20px 24px',
        marginBottom: '20px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid #334155',
        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.08)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <TrendingUp size={18} color="#2DD4BF" />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              MÓDULO DE INTELIGENCIA DE NEGOCIOS
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '-0.02em', color: '#F8FAFC' }}>
            Reportes y Métricas Gerenciales
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94A3B8' }}>
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
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#CBD5E1',
              padding: '7px 9px',
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
                background: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '600',
                padding: '7px 30px 7px 12px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: paleta.font,
                appearance: 'none',
                WebkitAppearance: 'none'
              }}
            >
              {MESES.map(m => (
                <option key={m.valor} value={m.valor} style={{ background: '#0F172A', color: '#FFFFFF' }}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <ChevronDown size={14} color="#94A3B8" style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }} />
          </div>

          {/* Selector de Año */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={anioNum}
              onChange={e => setAnioNum(e.target.value)}
              aria-label="Seleccionar Año"
              style={{
                background: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '600',
                padding: '7px 28px 7px 12px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: paleta.fontMono,
                appearance: 'none',
                WebkitAppearance: 'none'
              }}
            >
              {ANIOS.map(a => (
                <option key={a} value={String(a)} style={{ background: '#0F172A', color: '#FFFFFF' }}>
                  {a}
                </option>
              ))}
            </select>
            <ChevronDown size={14} color="#94A3B8" style={{ position: 'absolute', right: '8px', pointerEvents: 'none' }} />
          </div>

          {/* Botón Mes Siguiente */}
          <button
            type="button"
            onClick={() => cambiarMesRelativo(1)}
            title="Mes siguiente"
            style={{
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#CBD5E1',
              padding: '7px 9px',
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
                background: '#1E293B',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#2DD4BF',
                fontSize: '12px',
                fontWeight: '600',
                padding: '7px 12px',
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
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#CBD5E1',
              fontSize: '12px',
              fontWeight: '600',
              padding: '7px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s ease'
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

          {/* SELECTOR SEGMENTADO DE VISTAS (PESTAÑAS PROFESIONALES) */}
          <div style={{
            background: '#F1F5F9',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '4px',
            display: 'inline-flex',
            gap: '4px',
            marginBottom: '20px'
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
                    background: activa ? '#FFFFFF' : 'transparent',
                    color: activa ? '#0F172A' : '#64748B',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    fontWeight: activa ? '700' : '500',
                    cursor: 'pointer',
                    boxShadow: activa ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
                    transition: 'all 0.12s ease'
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

              {/* GRID DE MÉTRICAS EJECUTIVAS: 4 COLUMNAS SOBRIAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                {[
                  { label: 'Ingresos Cobrados', valor: stats.ingresosDelMes, tipo: 'dinero', topColor: '#0F766E', icon: DollarSign, sub: 'Movimientos de ingreso' },
                  { label: 'Egresos Totales', valor: stats.egresosDelMes, tipo: 'dinero', topColor: '#BE123C', icon: ArrowDownRight, sub: 'Gastos operativos y fijos' },
                  { label: 'Balance Contable', valor: balance, tipo: 'dinero', topColor: balance >= 0 ? '#0F766E' : '#B45309', icon: ArrowUpRight, sub: balance >= 0 ? 'Superávit mensual' : 'Déficit del mes' },
                  { label: 'Facturación Pendiente', valor: stats.montoFacturasPendientes, tipo: 'dinero', topColor: '#475569', icon: Layers, sub: `${stats.facturasPendientes} facturas a cobrar` },
                  { label: 'Clientes Activos', valor: stats.totalClientes, tipo: 'numero', topColor: '#334155', icon: Building, sub: 'Empresas con servicio' },
                  { label: 'Contratos Vigentes', valor: stats.totalContratos, tipo: 'numero', topColor: '#334155', icon: Layers, sub: 'Acuerdos formalizados' },
                  { label: 'Dotación de Personal', valor: stats.totalEmpleados, tipo: 'numero', topColor: '#334155', icon: Building, sub: 'Operarios registrados' },
                  { label: 'Órdenes de Trabajo', valor: stats.serviciosDelMes, tipo: 'numero', topColor: '#0F766E', icon: TrendingUp, sub: 'Servicios en el período' },
                ].map((k, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '8px',
                      padding: '16px 18px',
                      border: '1px solid #E2E8F0',
                      borderTop: `3px solid ${k.topColor}`,
                      boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {k.label}
                      </span>
                      <p style={{
                        margin: '8px 0 0',
                        fontSize: k.tipo === 'dinero' ? '20px' : '26px',
                        fontWeight: '700',
                        color: '#0F172A',
                        fontFamily: paleta.fontMono,
                        letterSpacing: '-0.02em'
                      }}>
                        {k.tipo === 'dinero' ? k.valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : k.valor}
                      </p>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#64748B', marginTop: '10px' }}>
                      {k.sub}
                    </span>
                  </div>
                ))}
              </div>

              {/* GRÁFICOS Y DESGLOSES EN 2 COLUMNAS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>

                {/* TOP CLIENTES POR FACTURACIÓN */}
                <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '22px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <h4 style={{ margin: 0, color: '#0F172A', fontWeight: '700', fontSize: '14.5px' }}>
                      Mayores Cuentas por Facturación
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
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
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                            {cl.ingresos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div style={{ background: '#F1F5F9', borderRadius: '4px', height: '7px', overflow: 'hidden' }}>
                          <div
                            style={{
                              background: '#0F766E',
                              height: '7px',
                              borderRadius: '4px',
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
                <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '22px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <h4 style={{ margin: 0, color: '#0F172A', fontWeight: '700', fontSize: '14.5px' }}>
                      Distribución de Egresos por Rubro
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
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
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155', fontFamily: paleta.fontMono }}>
                            {g.monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div style={{ background: '#F1F5F9', borderRadius: '4px', height: '7px', overflow: 'hidden' }}>
                          <div
                            style={{
                              background: '#475569',
                              height: '7px',
                              borderRadius: '4px',
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
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '14px 18px',
                fontSize: '12.5px',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FFFFFF', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUp size={15} color="#0F766E" />
                </div>
                <span>
                  <strong>Criterio de Costeo Operativo:</strong> La rentabilidad por cuenta se determina deduciendo de las facturas cobradas en el mes los costos directos asignados (horas de mano de obra e insumos directos consumidos).
                </span>
              </div>

              {/* HISTÓRICO SEMESTRAL DE MOVIMIENTOS */}
              {evolucionGeneral && (
                <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '22px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <History size={16} color="#0F172A" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                      Evolución Consolidada — Últimos 6 Meses
                    </h4>
                  </div>
                  <GraficoBarras
                    meses={evolucionGeneral.meses}
                    serieA={evolucionGeneral.ingresos}
                    serieB={evolucionGeneral.egresos}
                    labelA="Ingresos Percibidos"
                    labelB="Egresos y Pagos"
                    colorA="#0F172A"
                    colorB="#64748B"
                  />
                </div>
              )}

              {/* TOTALES DEL CUADRO DE RENTABILIDAD */}
              {rentabilidadClientes.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '16px', border: '1px solid #E2E8F0', borderTop: '3px solid #0F766E' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Facturación Imputada</span>
                    <p style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                      {rentabilidadClientes.reduce((a, c) => a + c.ingresos, 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '16px', border: '1px solid #E2E8F0', borderTop: '3px solid #64748B' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Costos Directos Asignados</span>
                    <p style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                      {rentabilidadClientes.reduce((a, c) => a + c.costos, 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '16px', border: '1px solid #E2E8F0', borderTop: '3px solid #0F172A' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Margen Bruto Total</span>
                    <p style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                      {rentabilidadClientes.reduce((a, c) => a + c.ganancia, 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              )}

              {/* TABLA DE RENTABILIDAD POR CUENTA */}
              <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)' }}>
                {rentabilidadClientes.length === 0 ? (
                  <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B', fontSize: '13.5px' }}>
                    Sin datos computables para este período. Cargá facturas cobradas y costos variables para ver el desglose.
                  </div>
                ) : (
                  <table style={s.tabla}>
                    <thead>
                      <tr>
                        <th style={s.tablaCabecera('#0F172A')}>Cliente / Cuenta</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Ingresos Cobrados</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Costos Directos</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Margen Bruto</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center', width: '160px' }}>Margen %</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center' }}>Calificación</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center', width: '120px' }}>Acción</th>
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
                                  background: '#FFFFFF',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '5px',
                                  padding: '5px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: '600',
                                  color: '#334155',
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
                <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '18px', border: '1px solid #E2E8F0', borderTop: '3px solid #334155' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Costos Fijos Operativos
                  </span>
                  <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                    {stats.totalCostosFijos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748B' }}>Alquileres, seguros, abonos y servicios fijos</p>
                </div>

                <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '18px', border: '1px solid #E2E8F0', borderTop: '3px solid #475569' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Costos Variables Asignados
                  </span>
                  <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                    {stats.totalCostosVariables.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748B' }}>Mano de obra directa e insumos consumidos</p>
                </div>

                <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '18px', border: '1px solid #E2E8F0', borderTop: '3px solid #0F172A' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Costo Operativo Consolidado
                  </span>
                  <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#0F172A', fontFamily: paleta.fontMono }}>
                    {(stats.totalCostosFijos + stats.totalCostosVariables).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748B' }}>Suma de costos fijos y variables del período</p>
                </div>
              </div>

              {/* RELACIÓN INGRESOS VS COSTOS */}
              <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '22px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)' }}>
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
                          { label: 'Ingresos Facturados', valor: stats.ingresosDelMes, color: '#0F766E' },
                          { label: 'Estructura de Costos', valor: totalCostos, color: '#334155' },
                          { label: 'Resultado Operativo', valor: gananciaReal, color: gananciaReal >= 0 ? '#0F766E' : '#BE123C' },
                          { label: 'Margen Neto', valor: margenReal, color: ind.color, tipo: 'porcentaje' },
                        ].map((k, i) => (
                          <div key={i} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px 16px' }}>
                            <p style={{ margin: 0, fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>{k.label}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '19px', fontWeight: '700', color: k.color, fontFamily: paleta.fontMono }}>
                              {k.tipo === 'porcentaje' ? k.valor.toFixed(1) + '%' : k.valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12.5px', color: '#334155', fontWeight: '600' }}>
                        <span>Margen Operativo sobre Ingresos</span>
                        <span style={{ color: ind.color, fontFamily: paleta.fontMono }}>
                          {ind.label} — {margenReal.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ background: '#E2E8F0', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                        <div style={{
                          background: ind.color,
                          height: '10px',
                          borderRadius: '4px',
                          width: `${Math.max(0, Math.min(margenReal, 100))}%`,
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginTop: '6px', fontFamily: paleta.fontMono }}>
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
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '12px 18px',
                fontSize: '12.5px',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <MapPin size={16} color="#0F766E" />
                <span>
                  Geolocalización de servicios activos. Las coordenadas se configuran en el módulo de <strong>Clientes → Sucursales</strong>.
                </span>
              </div>

              {sucursalesMapa.length === 0 ? (
                <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '48px 20px', textAlign: 'center', border: '1px solid #E2E8F0', color: '#64748B', fontSize: '13.5px' }}>
                  No se detectaron sucursales con coordenadas geográficas cargadas.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {sucursalesMapa.map((suc, i) => (
                      <div key={i} style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px 16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)' }}>
                        <p style={{ margin: '0 0 3px', fontWeight: '700', color: '#0F172A', fontSize: '13.5px' }}>{suc.nombre}</p>
                        <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#0F766E', fontWeight: '600' }}>
                          {suc.clientes?.razon_social || suc.clientes?.nombre_contacto || 'Cliente'}
                        </p>
                        {suc.direccion && <p style={{ margin: '0 0 2px', fontSize: '11.5px', color: '#475569' }}>{suc.direccion}</p>}
                        {suc.localidad && <p style={{ margin: '0 0 8px', fontSize: '11.5px', color: '#64748B' }}>{suc.localidad}{suc.provincia ? ', ' + suc.provincia : ''}</p>}
                        <a
                          href={`https://www.google.com/maps?q=${suc.latitud},${suc.longitud}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '11.5px', color: '#0F766E', textDecoration: 'none', fontWeight: '600' }}
                        >
                          Ver en Google Maps →
                        </a>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '10px',
            padding: '24px',
            width: '100%',
            maxWidth: '580px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #CBD5E1'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#0F766E', textTransform: 'uppercase' }}>Historial Semestral</span>
                <h4 style={{ margin: '2px 0 0', fontWeight: '700', color: '#0F172A', fontSize: '16px' }}>
                  {clienteEvolucion.nombre}
                </h4>
              </div>
              <button
                onClick={() => setClienteEvolucion(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', padding: '4px' }}
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
                  colorA="#0F172A"
                  colorB="#64748B"
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
