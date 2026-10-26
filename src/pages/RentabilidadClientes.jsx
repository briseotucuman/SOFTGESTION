import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s } from '../estilos.js'
import { Download } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const pct = n => (Number.isFinite(n) ? n.toFixed(1).replace('.', ',') + '%' : '—')
const nombreCli = c => c?.razon_social || c?.nombre_contacto || 'Sin nombre'
const desdeMes = n => { const d = new Date(); d.setMonth(d.getMonth() - n + 1, 1); return d.toLocaleDateString('en-CA').slice(0, 8) + '01' }

// Rentabilidad por cliente (centro de costos): ventas − costos imputados al cliente
export default function RentabilidadClientes() {
  const [meses, setMeses] = useState(6)
  const [prorratear, setProrratear] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [d, setD] = useState({})
  const [clientes, setClientes] = useState([])
  const [detalle, setDetalle] = useState(null)

  async function cargar() {
    setCargando(true)
    const desde = desdeMes(meses), desdePer = desde.slice(0, 7)
    const res = await Promise.all([
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true),
      supabase.from('facturas').select('cliente_id, subtotal, total, fecha_emision').neq('estado', 'anulada').gte('fecha_emision', desde),
      supabase.from('facturas_compra').select('id, cliente_id, numero_factura, concepto, subtotal, total, fecha_emision, proveedores(razon_social)').neq('estado', 'anulada').gte('fecha_emision', desde),
      supabase.from('costos_variables').select('cliente_id, monto, nombre, fecha').gte('fecha', desde),
      supabase.from('movimientos_financieros').select('cliente_id, tipo, monto, factura_id, descripcion, fecha').not('cliente_id', 'is', null).is('factura_id', null).gte('fecha', desde),
      supabase.from('liquidaciones_sueldo').select('total_bruto, periodo').gte('periodo', desdePer),
      supabase.from('costos_fijos').select('monto, frecuencia, mes').eq('activo', true).gte('mes', desdePer),
      supabase.from('empleados').select('id, salario_base'),
      supabase.from('asignaciones_empleado').select('*'),
      supabase.from('parametros').select('valor').eq('clave', 'cargas_sociales_pct').maybeSingle(),
      supabase.from('horarios_servicio').select('empleado_id, cliente_id, dias, hora_desde, hora_hasta').eq('activo', true)
    ])
    const err = res.find(r => r.error); setError(err ? err.error.message : '')
    const [cl, fa, fc, cv, mv, li, cf, em, asg] = res.map(r => r.data || [])
    setClientes(cl); setD({ fa, fc, cv, mv, li, cf, em, asg, cargas: Number(res[9].data?.valor || 0), hor: res[10].data || [], desdePer }); setCargando(false)
  }
  useEffect(() => { cargar() }, [meses]) // eslint-disable-line react-hooks/exhaustive-deps

  const calc = useMemo(() => {
    if (!d.fa) return null
    const mapa = {}
    const get = id => (mapa[id] ||= { id, personal: 0, ventas: 0, compras: 0, variables: 0, otrosEgr: 0, otrosIng: 0, lineas: [] })
    d.fa.forEach(f => { get(f.cliente_id).ventas += Number(f.subtotal ?? f.total) })
    d.fc.filter(f => f.cliente_id).forEach(f => { const x = get(f.cliente_id); const m = Number(f.subtotal ?? f.total); x.compras += m; x.lineas.push({ t: 'Compra', det: `${f.proveedores?.razon_social || ''} ${f.concepto || f.numero_factura || ''}`.trim(), monto: m, fecha: f.fecha_emision }) })
    d.cv.filter(c => c.cliente_id).forEach(c => { const x = get(c.cliente_id); x.variables += Number(c.monto); x.lineas.push({ t: 'Costo variable', det: c.nombre, monto: Number(c.monto), fecha: c.fecha }) })
    d.mv.forEach(m => {
      const x = get(m.cliente_id)
      if (m.tipo === 'egreso') { x.otrosEgr += Number(m.monto); x.lineas.push({ t: 'Egreso imputado', det: m.descripcion, monto: Number(m.monto), fecha: m.fecha }) }
      else x.otrosIng += Number(m.monto)
    })
    // Personal: costo mensual de cada empleado (liquidado del mes, o sueldo base + cargas) repartido según sus asignaciones
    const mesesPer = []; { let m = d.desdePer; const fin = new Date().toLocaleDateString('en-CA').slice(0, 7); while (m <= fin) { mesesPer.push(m); const [y, mm] = m.split('-').map(Number); m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}` } }
    const liqMes = {}; d.li.forEach(l => { const k = String(l.periodo).slice(0, 7); liqMes[k] = (liqMes[k] || 0) + Number(l.total_bruto || 0) })
    let personalTotal = 0, personalAsignado = 0
    mesesPer.forEach(mes => {
      const ini = mes + '-01', fin = mes + '-31'
      const costoEmp = d.em.map(e => ({ id: e.id, costo: Number(e.salario_base || 0) * (1 + d.cargas / 100) }))
      const base = liqMes[mes] ?? costoEmp.reduce((a, e) => a + e.costo, 0)
      const k = base / (costoEmp.reduce((a, e) => a + e.costo, 0) || 1) // escala al liquidado real si existe
      personalTotal += base
      const [anio, mesN] = mes.split('-').map(Number)
      const diasMes = new Date(anio, mesN, 0).getDate()
      const cuenta = Array(8).fill(0) // cantidad de cada día de la semana (1=lun..7=dom) en el mes
      for (let i = 1; i <= diasMes; i++) cuenta[new Date(anio, mesN - 1, i).getDay() || 7]++
      const horasHor = h => { const t = x => { const [a, b] = String(x).split(':'); return Number(a) + Number(b) / 60 }; return (t(h.hora_hasta) - t(h.hora_desde)) * (h.dias || []).reduce((a, n) => a + cuenta[n], 0) }
      costoEmp.forEach(e => {
        const monto = e.costo * (liqMes[mes] != null ? k : 1)
        const asigs = d.asg.filter(a => a.empleado_id === e.id && a.desde <= fin && (!a.hasta || a.hasta >= ini))
        if (asigs.length) {
          asigs.forEach(a => {
            const m = monto * Number(a.porcentaje) / 100
            const x = get(a.cliente_id); x.personal += m; personalAsignado += m; x.lineas.push({ t: 'Personal', det: `Sueldo asignado (${Number(a.porcentaje)}%)`, monto: m, fecha: ini })
          })
          return
        }
        const hs = d.hor.filter(h => h.empleado_id === e.id)
        const totalH = hs.reduce((a, h) => a + horasHor(h), 0)
        if (!totalH) return
        const porCli = {}
        hs.forEach(h => { if (h.cliente_id) porCli[h.cliente_id] = (porCli[h.cliente_id] || 0) + horasHor(h) })
        Object.entries(porCli).forEach(([cid, h]) => {
          const m = monto * h / totalH
          const x = get(cid); x.personal += m; personalAsignado += m; x.lineas.push({ t: 'Personal', det: `${Math.round(h * 10) / 10} hs del mes`, monto: m, fecha: ini })
        })
      })
    })
    const ventasTot = Object.values(mapa).reduce((a, x) => a + x.ventas, 0)
    const indirectos = (personalTotal - personalAsignado) +
      d.cf.reduce((a, c) => a + (c.frecuencia === 'anual' ? Number(c.monto) / 12 : Number(c.monto)), 0)
    const filas = Object.values(mapa).map(x => {
      const ing = x.ventas + x.otrosIng
      const directos = x.compras + x.variables + x.otrosEgr + x.personal
      const indir = prorratear && ventasTot > 0 ? indirectos * (x.ventas / ventasTot) : 0
      const res = ing - directos - indir
      const cli = clientes.find(c => c.id === x.id)
      return { ...x, nombre: cli ? nombreCli(cli) : 'Sin cliente', ing, directos, indir, res, margen: ing > 0 ? (res / ing) * 100 : NaN }
    }).sort((a, b) => b.ing - a.ing)
    const sinAsignar = d.fc.filter(f => !f.cliente_id)
    return { filas, indirectos, sinAsignar, totSinAsignar: sinAsignar.reduce((a, f) => a + Number(f.subtotal ?? f.total), 0) }
  }, [d, clientes, prorratear])

  async function asignar(idCompra, clienteId) {
    if (!clienteId) return
    const { error } = await supabase.from('facturas_compra').update({ cliente_id: clienteId }).eq('id', idCompra)
    if (error) { alert('No se pudo asignar: ' + error.message); return }
    cargar()
  }

  function exportar() {
    const lin = [['Cliente', 'Ingresos', 'Costos directos', 'Indirectos prorrateados', 'Resultado', 'Margen %']]
    calc.filas.forEach(f => lin.push([f.nombre, Math.round(f.ing), Math.round(f.directos), Math.round(f.indir), Math.round(f.res), Number.isFinite(f.margen) ? f.margen.toFixed(1) : '']))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + lin.map(r => r.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = 'rentabilidad-por-cliente.csv'; a.click()
  }

  if (cargando) return <p style={{ color: '#64748b', padding: 16 }}>Cargando…</p>
  if (!calc) return null
  const tot = calc.filas.reduce((a, f) => ({ ing: a.ing + f.ing, dir: a.dir + f.directos, ind: a.ind + f.indir, res: a.res + f.res }), { ing: 0, dir: 0, ind: 0, res: 0 })
  const th = (t, der) => <th style={{ ...s.tablaCabecera('#1e40af'), textAlign: der ? 'right' : 'left' }}>{t}</th>
  const sel = detalle && calc.filas.find(f => f.id === detalle)

  return (
    <div>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 8, marginBottom: 10 }}>No se pudo cargar parte de los datos: {error}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select style={{ ...s.input, width: 'auto' }} value={meses} onChange={e => setMeses(Number(e.target.value))}>
          <option value={1}>Este mes</option><option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option>
        </select>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={prorratear} onChange={e => setProrratear(e.target.checked)} />
          Prorratear gastos generales: personal no asignado y fijos ({ars(calc.indirectos)}) según ventas
        </label>
        <button style={{ ...s.btnSecundario, marginLeft: 'auto' }} onClick={exportar}><Download size={13} style={{ verticalAlign: '-2px' }} /> Exportar</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['Ingresos', ars(tot.ing)], ['Costos directos', ars(tot.dir)], ['Resultado', ars(tot.res), tot.res < 0 ? '#dc2626' : '#059669'], ['Margen', pct(tot.ing ? (tot.res / tot.ing) * 100 : NaN)]].map(([t, v, col]) => (
          <div key={t} style={{ ...s.card, padding: 14, flex: '1 1 150px' }}><div style={{ fontSize: 12, color: '#64748b' }}>{t}</div><div style={{ fontSize: 22, fontWeight: 800, color: col }}>{v}</div></div>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={s.tabla}>
          <thead><tr>{th('Cliente')}{th('Ingresos', 1)}{th('Costos directos', 1)}{prorratear && th('Indirectos', 1)}{th('Resultado', 1)}{th('Margen', 1)}</tr></thead>
          <tbody>
            {calc.filas.map((f, i) => (
              <tr key={f.id} style={{ ...s.tablaFila(i), cursor: 'pointer' }} onClick={() => setDetalle(detalle === f.id ? null : f.id)}>
                <td style={s.tablaCellBold}>{f.nombre}</td>
                <td style={{ ...s.tablaCell, textAlign: 'right' }}>{ars(f.ing)}</td>
                <td style={{ ...s.tablaCell, textAlign: 'right' }}>{ars(f.directos)}</td>
                {prorratear && <td style={{ ...s.tablaCell, textAlign: 'right' }}>{ars(f.indir)}</td>}
                <td style={{ ...s.tablaCellBold, textAlign: 'right', color: f.res < 0 ? '#dc2626' : '#059669' }}>{ars(f.res)}</td>
                <td style={{ ...s.tablaCell, textAlign: 'right' }}>{pct(f.margen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <div style={{ ...s.card, padding: 14, marginTop: 12 }}>
          <strong>{sel.nombre} — costos imputados</strong>
          {sel.lineas.length === 0 ? <p style={{ fontSize: 13, color: '#64748b' }}>Todavía no tiene costos imputados: el margen está sobreestimado.</p> :
            sel.lineas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ flex: '0 0 90px', color: '#64748b' }}>{String(l.fecha).split('-').reverse().join('/')}</span>
                <span style={{ flex: '0 0 110px' }}>{l.t}</span><span style={{ flex: 1 }}>{l.det}</span><span>{ars(l.monto)}</span>
              </div>
            ))}
        </div>
      )}

      {calc.sinAsignar.length > 0 && (
        <div style={{ ...s.card, padding: 14, marginTop: 14, border: '1px solid #fcd34d' }}>
          <strong>Compras sin cliente asignado: {ars(calc.totSinAsignar)} ({calc.sinAsignar.length})</strong>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 8px' }}>Mientras no se asignen, no restan en la rentabilidad de ningún cliente. Asignalas acá (las de uso general, como oficina, déjalas sin asignar).</p>
          {calc.sinAsignar.sort((a, b) => Number(b.subtotal ?? b.total) - Number(a.subtotal ?? a.total)).slice(0, 15).map(f => (
            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, padding: '4px 0', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 220px' }}>{f.proveedores?.razon_social || 'Proveedor'} · {f.concepto || f.numero_factura || ''}</span>
              <span style={{ flex: '0 0 110px', textAlign: 'right' }}>{ars(f.subtotal ?? f.total)}</span>
              <select style={{ ...s.input, flex: '0 0 200px', padding: '4px 6px' }} value="" onChange={e => asignar(f.id, e.target.value)}>
                <option value="">Asignar a cliente…</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{nombreCli(c)}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Ingresos: ventas netas por fecha de factura (más otros ingresos imputados al cliente). Costos directos: compras imputadas, costos variables, egresos cargados a mano y el personal asignado (Finanzas > Personal por cliente). Hacé clic en un cliente para ver su detalle.</p>
    </div>
  )
}
