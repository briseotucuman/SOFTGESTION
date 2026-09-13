import React from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { TrendingUp, X, History } from 'lucide-react'

const c = colores.reportes

function indicadorMargen(margen) {
  if (margen >= 30) return { color: '#059669', bg: '#d1fae5', label: 'Excelente', emoji: '' }
  if (margen >= 15) return { color: '#d97706', bg: '#fef3c7', label: 'Ajustado', emoji: '' }
  if (margen > 0)   return { color: '#dc2626', bg: '#fee2e2', label: 'Bajo', emoji: '' }
  return { color: '#7c3aed', bg: '#ede9fe', label: 'Pérdida', emoji: '' }
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

// Mini gráfico de barras comparando dos series por mes (sin dependencias externas)
function GraficoBarras({ meses, serieA, serieB, labelA, labelB, colorA, colorB, formatoMoneda = true }) {
  const max = Math.max(...serieA, ...serieB, 1)
  const fmt = (v) => formatoMoneda ? v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : v
  return (
    <div>
      <div style={{ display: 'flex', gap: '14px', marginBottom: '12px', fontSize: '12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: paleta.inkSoft }}><span style={{ width: 9, height: 9, borderRadius: 2, background: colorA, display: 'inline-block' }} />{labelA}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: paleta.inkSoft }}><span style={{ width: 9, height: 9, borderRadius: 2, background: colorB, display: 'inline-block' }} />{labelB}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '160px' }}>
        {meses.map((mesStr, i) => (
          <div key={mesStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px', width: '100%', justifyContent: 'center' }}>
              <div title={fmt(serieA[i])} style={{ width: '38%', maxWidth: '22px', height: `${Math.max(2, (serieA[i] / max) * 120)}px`, background: colorA, borderRadius: '3px 3px 0 0' }} />
              <div title={fmt(serieB[i])} style={{ width: '38%', maxWidth: '22px', height: `${Math.max(2, (serieB[i] / max) * 120)}px`, background: colorB, borderRadius: '3px 3px 0 0' }} />
            </div>
            <span style={{ fontSize: '11px', color: paleta.muted, textTransform: 'capitalize' }}>{nombreMes(mesStr)}</span>
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
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
    }

    // Load Leaflet JS
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
          <div style="min-width:180px;font-family:Segoe UI,sans-serif">
            <p style="margin:0 0 4px;font-weight:800;font-size:14px;color:#0f172a">${suc.nombre}</p>
            <p style="margin:0 0 4px;font-size:12px;color:#7c3aed;font-weight:600">${suc.clientes?.razon_social || suc.clientes?.nombre_contacto || ''}</p>
            ${suc.direccion ? `<p style="margin:0 0 2px;font-size:12px;color:#64748b">${suc.direccion}</p>` : ''}
            ${suc.localidad ? `<p style="margin:0 0 6px;font-size:12px;color:#64748b">${suc.localidad}${suc.provincia ? ', ' + suc.provincia : ''}</p>` : ''}
            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="font-size:12px;color:#1d4ed8;font-weight:600">Ver en Google Maps </a>
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

  return <div ref={mapRef} style={{ width: '100%', height: '500px' }} />
}

function Reportes() {
  const [vista, setVista] = useState('general')
  const [sucursalesMapa, setSucursalesMapa] = useState([])
  const [stats, setStats] = useState({ totalClientes:0, totalContratos:0, totalEmpleados:0, serviciosDelMes:0, ingresosDelMes:0, egresosDelMes:0, facturasPendientes:0, montoFacturasPendientes:0, stockBajoMinimo:0, totalCostosFijos:0, totalCostosVariables:0 })
  const [rentabilidadClientes, setRentabilidadClientes] = useState([])
  const [gastosPorCategoria, setGastosPorCategoria] = useState([])
  const [evolucionGeneral, setEvolucionGeneral] = useState(null)
  const [clienteEvolucion, setClienteEvolucion] = useState(null)
  const [evolucionClienteData, setEvolucionClienteData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => { cargarReportes() }, [mes])

  async function cargarReportes() {
    setLoading(true)
    const { data: sucData } = await supabase.from('sucursales').select('*, clientes(razon_social,nombre_contacto)').eq('activa', true).not('latitud', 'is', null).not('longitud', 'is', null)
    if (sucData) setSucursalesMapa(sucData)
    const [
      { count: totalClientes }, { count: totalContratos }, { count: totalEmpleados }, { count: serviciosDelMes },
      { data: movimientosMes }, { data: facturasPendientes }, { data: insumosBajos },
      { data: facturasData }, { data: costosFijos }, { data: costosVariables }
    ] = await Promise.all([
      supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('contratos').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      supabase.from('empleados').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('ordenes_trabajo').select('*', { count: 'exact', head: true }).gte('fecha_programada', mes+'-01').lte('fecha_programada', mes+'-'+new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()),
      supabase.from('movimientos_financieros').select('tipo,monto,categoria').gte('fecha', mes+'-01').lte('fecha', mes+'-'+new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()),
      supabase.from('facturas').select('total').in('estado', ['pendiente','parcial','vencida']),
      supabase.from('insumos').select('id, stock_actual, stock_minimo').eq('activo', true),
      supabase.from('facturas').select(`total, estado, cliente_id, clientes(id, razon_social, nombre_contacto)`).in('estado',['pagada','parcial']).gte('fecha_emision', mes+'-01').lte('fecha_emision', mes+'-'+new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()),
      supabase.from('costos_fijos').select('monto').eq('activo', true).eq('mes', mes),
      supabase.from('costos_variables').select('monto, cliente_id, clientes(id, razon_social, nombre_contacto)').gte('fecha', mes+'-01').lte('fecha', mes+'-'+new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()),
    ])

    const ingresosDelMes = (movimientosMes||[]).filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+Number(m.monto),0)
    const egresosDelMes = (movimientosMes||[]).filter(m=>m.tipo==='egreso').reduce((a,m)=>a+Number(m.monto),0)
    const montoFacturasPendientes = (facturasPendientes||[]).reduce((a,f)=>a+Number(f.total),0)
    const totalCostosFijos = (costosFijos||[]).reduce((a,c)=>a+Number(c.monto),0)
    const totalCostosVariables = (costosVariables||[]).reduce((a,c)=>a+Number(c.monto),0)

    // Gastos por categoria
    const gastos = {}
    ;(movimientosMes||[]).filter(m=>m.tipo==='egreso').forEach(m=>{
      const cat = (m.categoria||'otro').replace(/_/g,' ')
      gastos[cat] = (gastos[cat]||0) + Number(m.monto)
    })

    // Rentabilidad por cliente: ingresos facturados - costos variables asignados
    const clientesMap = {}
    ;(facturasData||[]).forEach(f=>{
      const id = f.cliente_id
      const nombre = f.clientes?.razon_social || f.clientes?.nombre_contacto || 'Sin nombre'
      if (!clientesMap[id]) clientesMap[id] = { nombre, ingresos: 0, costos: 0 }
      clientesMap[id].ingresos += Number(f.total)
    })
    ;(costosVariables||[]).forEach(cv=>{
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

    setStats({ totalClientes:totalClientes||0, totalContratos:totalContratos||0, totalEmpleados:totalEmpleados||0, serviciosDelMes:serviciosDelMes||0, ingresosDelMes, egresosDelMes, facturasPendientes:(facturasPendientes||[]).length, montoFacturasPendientes, stockBajoMinimo:(insumosBajos||[]).filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)).length, totalCostosFijos, totalCostosVariables })
    setRentabilidadClientes(rentabilidad)
    setGastosPorCategoria(Object.entries(gastos).map(([categoria,monto])=>({categoria,monto})).sort((a,b)=>b.monto-a.monto))
    setLoading(false)
    cargarEvolucionGeneral()
  }

  async function cargarEvolucionGeneral() {
    const meses = ultimosNMeses(mes, 6)
    const { data } = await supabase.from('movimientos_financieros').select('fecha,tipo,monto')
      .gte('fecha', meses[0] + '-01')
      .lte('fecha', mes + '-' + new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate())
    const porMes = {}
    meses.forEach(m => { porMes[m] = { ingresos: 0, egresos: 0 } })
    ;(data || []).forEach(mv => {
      const key = mv.fecha.slice(0, 7)
      if (!porMes[key]) return
      if (mv.tipo === 'ingreso') porMes[key].ingresos += Number(mv.monto)
      else porMes[key].egresos += Number(mv.monto)
    })
    setEvolucionGeneral({
      meses,
      ingresos: meses.map(m => porMes[m].ingresos),
      egresos: meses.map(m => porMes[m].egresos),
    })
  }

  async function verEvolucionCliente(clienteId, nombre) {
    setClienteEvolucion({ id: clienteId, nombre })
    setEvolucionClienteData(null)
    const meses = ultimosNMeses(mes, 6)
    const desde = meses[0] + '-01'
    const hasta = mes + '-' + new Date(+mes.split('-')[0], +mes.split('-')[1], 0).getDate()
    const [{ data: fact }, { data: cv }] = await Promise.all([
      supabase.from('facturas').select('total,fecha_emision,estado').eq('cliente_id', clienteId).in('estado', ['pagada','parcial']).gte('fecha_emision', desde).lte('fecha_emision', hasta),
      supabase.from('costos_variables').select('monto,fecha').eq('cliente_id', clienteId).gte('fecha', desde).lte('fecha', hasta),
    ])
    const porMes = {}
    meses.forEach(m => { porMes[m] = { ingresos: 0, costos: 0 } })
    ;(fact || []).forEach(f => { const k = f.fecha_emision.slice(0,7); if (porMes[k]) porMes[k].ingresos += Number(f.total) })
    ;(cv || []).forEach(c => { const k = c.fecha.slice(0,7); if (porMes[k]) porMes[k].costos += Number(c.monto) })
    setEvolucionClienteData({
      meses,
      ingresos: meses.map(m => porMes[m].ingresos),
      costos: meses.map(m => porMes[m].costos),
    })
  }

  const balance = stats.ingresosDelMes - stats.egresosDelMes
  const maxIngreso = Math.max(...rentabilidadClientes.map(r => r.ingresos), 1)

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ ...s.cabecera(c.gradient), alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><TrendingUp size={19} /> Reportes y Estadísticas</h3>
          <p style={s.cabeceraSubtexto}>Dashboard ejecutivo · Briseo Limpieza</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          style={{ ...s.input, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', maxWidth: '180px' }} />
      </div>

      {loading ? <div style={s.empty}>Cargando reportes...</div> : (
        <>
          {stats.stockBajoMinimo > 0 && (
            <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:'12px', padding:'12px 18px', marginBottom:'16px' }}>
              <p style={{ margin:0, color:'#dc2626', fontWeight:'600', fontSize:'13px' }}>{stats.stockBajoMinimo} insumo(s) bajo stock mínimo</p>
            </div>
          )}

          {/* PESTAÑAS */}
          <div style={{ display:'flex', gap:'10px', marginBottom:'20px' }}>
            {[['general','General'],['rentabilidad','Rentabilidad por cliente'],['costos','Costos'],['mapa','Mapa de servicios']].map(([v,lbl]) => (
              <button key={v} onClick={() => setVista(v)} style={vista===v ? s.btnPrimario(c.main) : s.btnSecundario}>{lbl}</button>
            ))}
          </div>

          {/* VISTA GENERAL */}
          {vista === 'general' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
                {[
                  { label:'Clientes activos',    valor:stats.totalClientes,           tipo:'numero', bg:'#eff6ff', color:'#1d4ed8' },
                  { label:'Contratos activos',   valor:stats.totalContratos,          tipo:'numero', bg:'#ede9fe', color:'#7c3aed' },
                  { label:'Empleados activos',   valor:stats.totalEmpleados,          tipo:'numero', bg:'#f0fdf4', color:'#059669' },
                  { label:'Servicios del mes',   valor:stats.serviciosDelMes,         tipo:'numero', bg:'#fefce8', color:'#d97706' },
                  { label:'Ingresos del mes',    valor:stats.ingresosDelMes,          tipo:'dinero', bg:'#f0fdf4', color:'#059669' },
                  { label:'Egresos del mes',     valor:stats.egresosDelMes,           tipo:'dinero', bg:'#fff1f2', color:'#dc2626' },
                  { label:'Balance del mes',     valor:balance,                       tipo:'dinero', bg:balance>=0?'#eff6ff':'#fff7ed', color:balance>=0?'#1d4ed8':'#d97706' },
                  { label:'Facturas pendientes', valor:stats.montoFacturasPendientes, tipo:'dinero', bg:'#fef3c7', color:'#d97706' },
                ].map((k,i) => (
                  <div key={i} style={{ ...s.card, background:k.bg, border:'none' }}>
                    <p style={{ ...s.label, color:k.color }}>{k.label}</p>
                    <p style={{ fontSize:k.tipo==='dinero'?'15px':'28px', fontWeight:'800', color:k.color, margin:'4px 0 0' }}>
                      {k.tipo==='dinero' ? k.valor.toLocaleString('es-AR',{style:'currency',currency:'ARS'}) : k.valor}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div style={s.card}>
                  <h4 style={{ margin:'0 0 16px', color:'#0f172a', fontWeight:'700', fontSize:'14px' }}>Top clientes por facturación</h4>
                  {rentabilidadClientes.length === 0
                    ? <p style={{ color:'#94a3b8', textAlign:'center', padding:'20px 0', fontSize:'13px' }}>Sin datos este mes</p>
                    : rentabilidadClientes.slice(0,6).map((cl,i) => (
                      <div key={i} style={{ marginBottom:'12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                          <span style={{ fontSize:'13px', color:'#374151', fontWeight:'500' }}>{cl.nombre}</span>
                          <span style={{ fontSize:'13px', fontWeight:'700', color:c.main }}>{cl.ingresos.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                        </div>
                        <div style={{ background:'#f1f5f9', borderRadius:'99px', height:'8px' }}>
                          <div style={{ background:c.gradient, height:'8px', borderRadius:'99px', width:((cl.ingresos/maxIngreso)*100)+'%', transition:'width 0.5s' }} />
                        </div>
                      </div>
                    ))
                  }
                </div>
                <div style={s.card}>
                  <h4 style={{ margin:'0 0 16px', color:'#0f172a', fontWeight:'700', fontSize:'14px' }}>Egresos por categoría</h4>
                  {gastosPorCategoria.length === 0
                    ? <p style={{ color:'#94a3b8', textAlign:'center', padding:'20px 0', fontSize:'13px' }}>Sin egresos este mes</p>
                    : gastosPorCategoria.map((g,i) => (
                      <div key={i} style={{ marginBottom:'12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                          <span style={{ fontSize:'13px', color:'#374151', fontWeight:'500', textTransform:'capitalize' }}>{g.categoria}</span>
                          <span style={{ fontSize:'13px', fontWeight:'700', color:'#dc2626' }}>{g.monto.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</span>
                        </div>
                        <div style={{ background:'#f1f5f9', borderRadius:'99px', height:'8px' }}>
                          <div style={{ background:'linear-gradient(135deg, #dc2626, #f87171)', height:'8px', borderRadius:'99px', width:((g.monto/gastosPorCategoria[0].monto)*100)+'%', transition:'width 0.5s' }} />
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </>
          )}

          {/* VISTA RENTABILIDAD POR CLIENTE */}
          {vista === 'rentabilidad' && (
            <>
              <div style={{ ...s.card, marginBottom:'16px', background:'#f0fdf4', border:'1px solid #86efac' }}>
                <p style={{ margin:0, fontSize:'13px', color:'#15803d' }}>
                  La rentabilidad por cliente se calcula cruzando las <strong>facturas cobradas</strong> del mes con los <strong>costos variables asignados</strong> a cada cliente en el módulo de Costos. Para mayor precisión, cargá los costos variables con el cliente correspondiente.
                </p>
              </div>

              {evolucionGeneral && (
                <div style={{ ...s.card, marginBottom: '20px' }}>
                  <p style={{ ...s.label, marginBottom: '14px', display:'flex', alignItems:'center', gap:'6px' }}><History size={13} /> Evolución general — últimos 6 meses</p>
                  <GraficoBarras meses={evolucionGeneral.meses} serieA={evolucionGeneral.ingresos} serieB={evolucionGeneral.egresos} labelA="Ingresos" labelB="Egresos" colorA="#059669" colorB="#dc2626" />
                </div>
              )}

              {rentabilidadClientes.length === 0 ? (
                <div style={s.empty}>Sin datos para este mes. Cargá facturas y costos variables para ver la rentabilidad.</div>
              ) : (
                <>
                  {/* CARDS RESUMEN */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'20px' }}>
                    <div style={{ ...s.card, background:'#f0fdf4', border:'1.5px solid #86efac' }}>
                      <p style={{ ...s.label, color:'#059669' }}>Total facturado</p>
                      <p style={{ fontSize:'22px', fontWeight:'800', color:'#059669', margin:'4px 0 0' }}>
                        {rentabilidadClientes.reduce((a,c)=>a+c.ingresos,0).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}
                      </p>
                    </div>
                    <div style={{ ...s.card, background:'#fff1f2', border:'1.5px solid #fca5a5' }}>
                      <p style={{ ...s.label, color:'#dc2626' }}>Total costos asignados</p>
                      <p style={{ fontSize:'22px', fontWeight:'800', color:'#dc2626', margin:'4px 0 0' }}>
                        {rentabilidadClientes.reduce((a,c)=>a+c.costos,0).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}
                      </p>
                    </div>
                    <div style={{ ...s.card, background:'#eff6ff', border:'1.5px solid #93c5fd' }}>
                      <p style={{ ...s.label, color:'#1d4ed8' }}>Ganancia total</p>
                      <p style={{ fontSize:'22px', fontWeight:'800', color:'#1d4ed8', margin:'4px 0 0' }}>
                        {rentabilidadClientes.reduce((a,c)=>a+c.ganancia,0).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}
                      </p>
                    </div>
                  </div>

                  {/* TABLA RENTABILIDAD */}
                  <div style={{ ...s.card, padding:0, overflow:'hidden' }}>
                    <table style={s.tabla}>
                      <thead>
                        <tr>{['Cliente','Ingresos','Costos asignados','Ganancia bruta','Margen','Estado',''].map(h => (
                          <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {rentabilidadClientes.map((cl,i) => {
                          const ind = indicadorMargen(cl.margen)
                          return (
                            <tr key={i} style={s.tablaFila(i)}>
                              <td style={s.tablaCellBold}>{cl.nombre}</td>
                              <td style={{ ...s.tablaCellBold, color:'#059669' }}>{cl.ingresos.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</td>
                              <td style={{ ...s.tablaCell, color:'#dc2626', fontWeight:'600' }}>{cl.costos.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</td>
                              <td style={{ ...s.tablaCellBold, color: cl.ganancia>=0 ? '#059669' : '#dc2626' }}>
                                {cl.ganancia>=0?'+':''}{cl.ganancia.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}
                              </td>
                              <td style={s.tablaCell}>
                                <div>
                                  <span style={s.badge(ind.bg, ind.color)}>{ind.emoji} {cl.margen.toFixed(1)}%</span>
                                  <div style={{ background:'#f1f5f9', borderRadius:'99px', height:'6px', marginTop:'6px', minWidth:'80px' }}>
                                    <div style={{ background:ind.color, height:'6px', borderRadius:'99px', width:Math.max(0,Math.min(cl.margen,100))+'%', transition:'width 0.4s' }} />
                                  </div>
                                </div>
                              </td>
                              <td style={s.tablaCell}><span style={s.badge(ind.bg, ind.color)}>{ind.label}</span></td>
                              <td style={s.tablaCell}>
                                <button style={{ ...s.btnSecundario, padding:'6px 12px', fontSize:'12px' }} onClick={() => verEvolucionCliente(cl.id, cl.nombre)}>Evolución</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* VISTA COSTOS */}
          {vista === 'costos' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'20px' }}>
                <div style={{ ...s.card, background:'#f0fdfa', border:'1.5px solid #99f6e4' }}>
                  <p style={{ ...s.label, color:'#0f766e' }}>Costos fijos del mes</p>
                  <p style={{ fontSize:'22px', fontWeight:'800', color:'#0f766e', margin:'4px 0 0' }}>{stats.totalCostosFijos.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
                </div>
                <div style={{ ...s.card, background:'#fff7ed', border:'1.5px solid #fed7aa' }}>
                  <p style={{ ...s.label, color:'#c2410c' }}>Costos variables del mes</p>
                  <p style={{ fontSize:'22px', fontWeight:'800', color:'#c2410c', margin:'4px 0 0' }}>{stats.totalCostosVariables.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
                </div>
                <div style={{ ...s.card, background:'#fef2f2', border:'1.5px solid #fecaca' }}>
                  <p style={{ ...s.label, color:'#dc2626' }}>Total costos del mes</p>
                  <p style={{ fontSize:'22px', fontWeight:'800', color:'#dc2626', margin:'4px 0 0' }}>{(stats.totalCostosFijos+stats.totalCostosVariables).toLocaleString('es-AR',{style:'currency',currency:'ARS'})}</p>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 16px', color:'#0f172a', fontWeight:'700', fontSize:'14px' }}>Relación ingresos vs costos totales</h4>
                {(() => {
                  const totalCostos = stats.totalCostosFijos + stats.totalCostosVariables
                  const gananciaReal = stats.ingresosDelMes - totalCostos
                  const margenReal = stats.ingresosDelMes > 0 ? (gananciaReal / stats.ingresosDelMes) * 100 : 0
                  const ind = indicadorMargen(margenReal)
                  return (
                    <div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
                        {[
                          { label:'Ingresos del mes', valor:stats.ingresosDelMes, color:'#059669', bg:'#f0fdf4' },
                          { label:'Total costos', valor:totalCostos, color:'#dc2626', bg:'#fff1f2' },
                          { label:'Ganancia real', valor:gananciaReal, color:gananciaReal>=0?'#1d4ed8':'#dc2626', bg:gananciaReal>=0?'#eff6ff':'#fff1f2' },
                          { label:'Margen real', valor:margenReal, color:ind.color, bg:ind.bg, tipo:'porcentaje' },
                        ].map((k,i) => (
                          <div key={i} style={{ background:k.bg, borderRadius:'12px', padding:'16px', textAlign:'center' }}>
                            <p style={{ margin:'0 0 6px', fontSize:'11px', color:k.color, fontWeight:'700', textTransform:'uppercase' }}>{k.label}</p>
                            <p style={{ margin:0, fontSize:'20px', fontWeight:'800', color:k.color }}>
                              {k.tipo==='porcentaje' ? k.valor.toFixed(1)+'%' : k.valor.toLocaleString('es-AR',{style:'currency',currency:'ARS'})}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginBottom:'8px', display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#64748b', fontWeight:'600' }}>
                        <span>Margen real sobre ingresos</span>
                        <span style={{ color:ind.color }}>{ind.emoji} {ind.label} — {margenReal.toFixed(1)}%</span>
                      </div>
                      <div style={{ background:'#f1f5f9', borderRadius:'99px', height:'16px', overflow:'hidden' }}>
                        <div style={{ background:ind.color, height:'16px', borderRadius:'99px', width:Math.max(0,Math.min(margenReal,100))+'%', transition:'width 0.5s', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:'8px' }}>
                          {margenReal > 10 && <span style={{ fontSize:'10px', color:'white', fontWeight:'700' }}>{margenReal.toFixed(0)}%</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>
                        <span>0%</span><span>Recomendado: 30%+</span><span>100%</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </>
          )}
          {/* MAPA DE SUCURSALES */}
          {vista === 'mapa' && (
            <>
              <div style={{ ...s.card, marginBottom:'16px', background:'#f0fdf4', border:'1px solid #86efac' }}>
                <p style={{ margin:0, fontSize:'13px', color:'#15803d' }}>
                  Se muestran las sucursales con coordenadas cargadas. Para agregar puntos andá a <strong>Clientes Sucursales Buscar automático</strong>.
                </p>
              </div>

              {sucursalesMapa.length === 0 ? (
                <div style={s.empty}>No hay sucursales con ubicación cargada. Agregá coordenadas en Clientes Sucursales.</div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
                    {sucursalesMapa.map((suc, i) => (
                      <div key={i} style={{ ...s.card, border:'1.5px solid #e2e8f0' }}>
                        <p style={{ margin:'0 0 4px', fontWeight:'800', color:'#0f172a', fontSize:'13px' }}>{suc.nombre}</p>
                        <p style={{ margin:'0 0 4px', fontSize:'12px', color:'#7c3aed', fontWeight:'600' }}>{suc.clientes?.razon_social || suc.clientes?.nombre_contacto}</p>
                        {suc.direccion && <p style={{ margin:'0 0 2px', fontSize:'12px', color:'#64748b' }}>{suc.direccion}</p>}
                        {suc.localidad && <p style={{ margin:'0 0 6px', fontSize:'12px', color:'#64748b' }}>{suc.localidad}{suc.provincia ? ', ' + suc.provincia : ''}</p>}
                        <a href={`https://www.google.com/maps?q=${suc.latitud},${suc.longitud}`} target="_blank" rel="noreferrer"
                          style={{ fontSize:'12px', color:'#1d4ed8', textDecoration:'none', fontWeight:'600' }}>
                          Ver en Google Maps                         </a>
                      </div>
                    ))}
                  </div>

                  <div style={{ ...s.card, padding:0, overflow:'hidden' }}>
                    <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0' }}>
                      <p style={{ margin:0, fontWeight:'700', color:'#0f172a' }}>Mapa de sucursales — {sucursalesMapa.length} puntos</p>
                    </div>
                    <MapaLeaflet sucursales={sucursalesMapa} />
                    <div style={{ padding:'12px 20px', background:'#f8fafc', borderTop:'1px solid #e2e8f0' }}>
                      <p style={{ margin:0, fontSize:'12px', color:'#64748b' }}>Mapa interactivo · Hacé click en cada marcador para ver el detalle de la sucursal</p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

        </>
      )}

      {clienteEvolucion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '26px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: paleta.ink }}>Evolución — {clienteEvolucion.nombre}</h4>
              <button onClick={() => setClienteEvolucion(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: paleta.muted }}><X size={16} /></button>
            </div>
            {!evolucionClienteData ? <div style={s.empty}>Cargando…</div> : (
              <>
                <GraficoBarras meses={evolucionClienteData.meses} serieA={evolucionClienteData.ingresos} serieB={evolucionClienteData.costos} labelA="Ingresos" labelB="Costos asignados" colorA="#059669" colorB="#dc2626" />
                <p style={{ marginTop: '16px', fontSize: '12px', color: paleta.muted }}>Últimos 6 meses hasta {nombreMes(mes)}. Los meses sin facturas cobradas ni costos asignados aparecen en cero.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Reportes



