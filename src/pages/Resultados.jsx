import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s } from '../estilos.js'
import { Download } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const pct = n => (Number.isFinite(n) ? n.toFixed(1).replace('.', ',') + '%' : '—')
const NOMBRE_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const etiqueta = m => `${NOMBRE_MES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
const mesDe = f => (f ? String(f).slice(0, 7) : null)
const hoy = new Date().toISOString().split('T')[0]

function sumarMeses(m, n) {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const suma = (obj, k, v) => { if (k) obj[k] = (obj[k] || 0) + Number(v || 0) }

// Estado de resultados (devengado) y flujo de caja (real y proyectado)
export default function Resultados() {
  const [vista, setVista] = useState('resultados')
  const [cantMeses, setCantMeses] = useState(6)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [d, setD] = useState({})

  useEffect(() => {
    let vivo = true
    Promise.all([
      supabase.from('facturas').select('id, cliente_id, fecha_emision, fecha_vencimiento, subtotal, total, estado, clientes(razon_social, nombre_contacto)').neq('estado', 'anulada'),
      supabase.from('facturas_compra').select('id, fecha_emision, fecha_vencimiento, subtotal, total, estado').neq('estado', 'anulada'),
      supabase.from('liquidaciones_sueldo').select('periodo, total_bruto'),
      supabase.from('costos_fijos').select('monto, frecuencia, mes').eq('activo', true),
      supabase.from('movimientos_financieros').select('fecha, tipo, monto'),
      supabase.from('pagos').select('factura_id, monto, monto_retenciones'),
      supabase.from('cuentas_bancarias').select('saldo, activa').eq('activa', true)
    ]).then(res => {
      if (!vivo) return
      const err = res.find(r => r.error)
      if (err) setError(err.error.message)
      const [fa, fc, li, cf, mv, pg, cu] = res.map(r => r.data || [])
      setD({ fa, fc, li, cf, mv, pg, cu })
      setCargando(false)
    })
    return () => { vivo = false }
  }, [])

  const mesActual = hoy.slice(0, 7)
  const meses = useMemo(() => Array.from({ length: cantMeses }, (_, i) => sumarMeses(mesActual, i - cantMeses + 1)), [cantMeses, mesActual])

  const calc = useMemo(() => {
    if (!d.fa) return null
    const ventas = {}, insumos = {}, sueldos = {}, fijos = {}
    d.fa.forEach(f => suma(ventas, mesDe(f.fecha_emision), f.subtotal ?? f.total))
    d.fc.forEach(f => suma(insumos, mesDe(f.fecha_emision), f.subtotal ?? f.total))
    d.li.forEach(l => suma(sueldos, String(l.periodo || '').slice(0, 7), l.total_bruto))
    d.cf.forEach(c => {
      if (!c.mes) return
      if (c.frecuencia === 'anual') for (let i = 0; i < 12; i++) suma(fijos, sumarMeses(c.mes, i), Number(c.monto) / 12)
      else suma(fijos, c.mes, c.monto)
    })
    const ing = {}, egr = {}
    d.mv.forEach(m => suma(m.tipo === 'ingreso' ? ing : egr, mesDe(m.fecha), m.monto))

    // Saldos abiertos para proyección
    const cobrado = {}
    d.pg.forEach(p => suma(cobrado, p.factura_id, Number(p.monto || 0) + Number(p.monto_retenciones || 0)))
    const porCobrar = d.fa.filter(f => f.estado !== 'pagada' && f.estado !== 'cobrada')
      .map(f => ({ ...f, saldo: Math.max(0, Number(f.total) - (cobrado[f.id] || 0)) })).filter(f => f.saldo > 0.5)
    const porPagar = d.fc.filter(f => f.estado !== 'pagada')

    // Concentración de clientes (ventas del período)
    const porCli = {}
    d.fa.filter(f => meses.includes(mesDe(f.fecha_emision))).forEach(f => {
      const n = f.clientes?.razon_social || f.clientes?.nombre_contacto || 'Sin cliente'
      suma(porCli, n, f.subtotal ?? f.total)
    })
    const ranking = Object.entries(porCli).sort((a, b) => b[1] - a[1])

    return { ventas, insumos, sueldos, fijos, ing, egr, porCobrar, porPagar, ranking }
  }, [d, meses])

  if (cargando) return <p style={{ color: '#64748b', padding: 16 }}>Cargando…</p>
  if (!calc) return null

  const filas = meses.map(m => {
    const v = calc.ventas[m] || 0, ins = calc.insumos[m] || 0, su = calc.sueldos[m] || 0, fi = calc.fijos[m] || 0
    const bruto = v - ins, oper = bruto - su - fi
    return { m, v, ins, su, fi, bruto, oper }
  })
  const tot = filas.reduce((a, f) => Object.fromEntries(Object.keys(f).filter(k => k !== 'm').map(k => [k, (a[k] || 0) + f[k]])), {})
  const margenBruto = tot.v ? (tot.bruto / tot.v) * 100 : NaN
  const margenOper = tot.v ? (tot.oper / tot.v) * 100 : NaN
  const costoDirecto = tot.v ? ((tot.ins + tot.su) / tot.v) * 100 : NaN
  const crecimiento = filas.length > 1 && filas[filas.length - 2].v ? ((filas[filas.length - 1].v / filas[filas.length - 2].v) - 1) * 100 : NaN
  const top3 = tot.v ? (calc.ranking.slice(0, 3).reduce((a, [, v]) => a + v, 0) / tot.v) * 100 : NaN
  // Punto de equilibrio mensual = costos fijos / margen de contribución (ventas − insumos)/ventas
  const mc = tot.v ? (tot.v - tot.ins) / tot.v : 0
  const fijosMes = (tot.su + tot.fi) / filas.length
  const equilibrio = mc > 0 ? fijosMes / mc : NaN

  // ---- Cash flow ----
  const cajaFilas = meses.map(m => ({ m, ing: calc.ing[m] || 0, egr: calc.egr[m] || 0, neto: (calc.ing[m] || 0) - (calc.egr[m] || 0) }))
  const saldoCajas = d.cu.reduce((a, c) => a + Number(c.saldo || 0), 0)
  const mesesProy = [1, 2, 3].map(i => sumarMeses(mesActual, i))
  const mesProy = f => { const m = mesDe(f.fecha_vencimiento || f.fecha_emision); return m && m < mesActual ? mesActual : m }
  const fijoPromedio = filas.slice(-3).reduce((a, f) => a + f.su + f.fi, 0) / Math.max(1, Math.min(3, filas.length))
  let saldoAcum = saldoCajas
  const proy = mesesProy.map(m => {
    const cobros = calc.porCobrar.filter(f => mesProy(f) === m).reduce((a, f) => a + f.saldo, 0)
    const pagos = calc.porPagar.filter(f => mesProy(f) === m).reduce((a, f) => a + Number(f.total || 0), 0) + fijoPromedio
    saldoAcum += cobros - pagos
    return { m, cobros, pagos, neto: cobros - pagos, saldo: saldoAcum }
  })
  const cobrosVencidos = calc.porCobrar.filter(f => f.fecha_vencimiento && f.fecha_vencimiento < hoy).reduce((a, f) => a + f.saldo, 0)

  function exportar() {
    const lin = [['Concepto', ...meses.map(etiqueta), 'Total']]
    const add = (n, k) => lin.push([n, ...filas.map(f => Math.round(f[k])), Math.round(tot[k])])
    add('Ventas netas', 'v'); add('Insumos', 'ins'); add('Utilidad bruta', 'bruto'); add('Sueldos', 'su'); add('Gastos fijos', 'fi'); add('Resultado operativo', 'oper')
    const csv = lin.map(r => r.join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'estado-de-resultados.csv'; a.click()
  }

  const kpi = (titulo, valor, nota, color = '#0f172a') => (
    <div style={{ ...s.card, padding: 14, flex: '1 1 150px' }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{valor}</div>
      {nota && <div style={{ fontSize: 11, color: '#94a3b8' }}>{nota}</div>}
    </div>
  )
  const celda = (v, neg) => <td style={{ ...s.tablaCell, textAlign: 'right', color: neg && v < 0 ? '#dc2626' : undefined }}>{ars(v)}</td>
  const fila = (nombre, key, opt = {}) => (
    <tr style={opt.fuerte ? { background: '#f1f5f9', fontWeight: 700 } : undefined}>
      <td style={{ ...s.tablaCell, fontWeight: opt.fuerte ? 700 : 400, paddingLeft: opt.sangria ? 24 : undefined }}>{nombre}</td>
      {filas.map(f => celda(opt.neg ? -f[key] : f[key], true))}
      {celda(opt.neg ? -tot[key] : tot[key], true)}
    </tr>
  )

  return (
    <div>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 8, marginBottom: 10 }}>No se pudo cargar parte de los datos: {error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button style={vista === 'resultados' ? s.btnPrimario('#1e40af') : s.btnSecundario} onClick={() => setVista('resultados')}>Estado de resultados</button>
        <button style={vista === 'cash' ? s.btnPrimario('#1e40af') : s.btnSecundario} onClick={() => setVista('cash')}>Cash flow</button>
        <select style={{ ...s.input, width: 'auto', marginLeft: 'auto' }} value={cantMeses} onChange={e => setCantMeses(Number(e.target.value))}>
          <option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option>
        </select>
        {vista === 'resultados' && <button style={s.btnSecundario} onClick={exportar}><Download size={13} style={{ verticalAlign: '-2px' }} /> Exportar</button>}
      </div>

      {vista === 'resultados' && (<>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {kpi('Ventas netas', ars(tot.v), `${cantMeses} meses`)}
          {kpi('Margen bruto', pct(margenBruto), 'ventas − insumos')}
          {kpi('Margen operativo', pct(margenOper), 'tras sueldos y fijos', tot.oper < 0 ? '#dc2626' : '#059669')}
          {kpi('Costo directo / ventas', pct(costoDirecto), 'insumos + sueldos')}
          {kpi('Crecimiento mensual', pct(crecimiento), 'último mes vs. anterior')}
          {kpi('Top 3 clientes', pct(top3), 'concentración de ventas')}
          {kpi('Punto de equilibrio', ars(equilibrio), 'ventas mensuales necesarias')}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.tabla}>
            <thead><tr><th style={s.tablaCabecera('#1e40af')}>Concepto</th>{meses.map(m => <th key={m} style={{ ...s.tablaCabecera('#1e40af'), textAlign: 'right' }}>{etiqueta(m)}</th>)}<th style={{ ...s.tablaCabecera('#1e40af'), textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {fila('Ventas netas', 'v', { fuerte: true })}
              {fila('Insumos', 'ins', { neg: true, sangria: true })}
              {fila('Utilidad bruta', 'bruto', { fuerte: true })}
              {fila('Sueldos', 'su', { neg: true, sangria: true })}
              {fila('Gastos fijos', 'fi', { neg: true, sangria: true })}
              {fila('Resultado operativo', 'oper', { fuerte: true })}
              <tr><td style={s.tablaCell}>Margen operativo %</td>{filas.map(f => <td key={f.m} style={{ ...s.tablaCell, textAlign: 'right' }}>{pct(f.v ? (f.oper / f.v) * 100 : NaN)}</td>)}<td style={{ ...s.tablaCell, textAlign: 'right' }}>{pct(margenOper)}</td></tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Base devengado: ventas por fecha de factura (sin IVA), insumos por fecha de factura de compra, sueldos por período de liquidación y gastos fijos por mes cargado (los anuales se prorratean en 12).</p>
        {calc.ranking.length > 0 && (
          <div style={{ ...s.card, padding: 14, marginTop: 12 }}>
            <strong style={{ fontSize: 14 }}>Ventas por cliente</strong>
            {calc.ranking.slice(0, 8).map(([n, v]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13 }}>
                <span style={{ flex: '0 0 180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span>
                <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 4, height: 8 }}><div style={{ width: `${(v / calc.ranking[0][1]) * 100}%`, background: '#1e40af', height: 8, borderRadius: 4 }} /></div>
                <span style={{ flex: '0 0 130px', textAlign: 'right' }}>{ars(v)} · {pct((v / tot.v) * 100)}</span>
              </div>
            ))}
          </div>
        )}
      </>)}

      {vista === 'cash' && (<>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {kpi('Saldo hoy (cuentas)', ars(saldoCajas))}
          {kpi('Cobros vencidos', ars(cobrosVencidos), 'facturas pasadas de fecha', cobrosVencidos > 0 ? '#dc2626' : undefined)}
          {kpi('Por cobrar total', ars(calc.porCobrar.reduce((a, f) => a + f.saldo, 0)))}
          {kpi('Por pagar total', ars(calc.porPagar.reduce((a, f) => a + Number(f.total || 0), 0)))}
        </div>
        <h4 style={{ margin: '8px 0' }}>Real (movimientos de caja)</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.tabla}>
            <thead><tr><th style={s.tablaCabecera('#1e40af')}>Mes</th><th style={{ ...s.tablaCabecera('#1e40af'), textAlign: 'right' }}>Ingresos</th><th style={{ ...s.tablaCabecera('#1e40af'), textAlign: 'right' }}>Egresos</th><th style={{ ...s.tablaCabecera('#1e40af'), textAlign: 'right' }}>Neto</th></tr></thead>
            <tbody>{cajaFilas.map(f => <tr key={f.m}><td style={s.tablaCell}>{etiqueta(f.m)}</td>{celda(f.ing)}{celda(-f.egr, true)}{celda(f.neto, true)}</tr>)}</tbody>
          </table>
        </div>
        <h4 style={{ margin: '16px 0 8px' }}>Proyección próximos 3 meses</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.tabla}>
            <thead><tr><th style={s.tablaCabecera('#1e40af')}>Mes</th><th style={{ ...s.tablaCabecera('#1e40af'), textAlign: 'right' }}>Cobros previstos</th><th style={{ ...s.tablaCabecera('#1e40af'), textAlign: 'right' }}>Pagos previstos</th><th style={{ ...s.tablaCabecera('#1e40af'), textAlign: 'right' }}>Neto</th><th style={{ ...s.tablaCabecera('#1e40af'), textAlign: 'right' }}>Saldo estimado</th></tr></thead>
            <tbody>{proy.map(f => <tr key={f.m}><td style={s.tablaCell}>{etiqueta(f.m)}</td>{celda(f.cobros)}{celda(-f.pagos, true)}{celda(f.neto, true)}{celda(f.saldo, true)}</tr>)}</tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Cobros: saldo de facturas abiertas por fecha de vencimiento (lo vencido cuenta en el mes actual). Pagos: facturas de compra pendientes más un gasto fijo estimado con el promedio de los últimos 3 meses (sueldos y fijos).</p>
      </>)}
    </div>
  )
}
